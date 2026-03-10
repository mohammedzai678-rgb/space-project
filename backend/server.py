from flask import Flask, request, jsonify
from flask_cors import CORS
from sgp4.api import Satrec, jday
import os

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
FRONTEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

STATE_DEFAULTS = {
    "satellites": [],
    "launches": [],
    "catastrophes": [],
    "changeAlerts": [],
    "theme": "dark"
}

@app.route('/api/state', methods=['GET'])
def get_state():
    return jsonify(data_storage)

@app.route('/api/state', methods=['PUT'])
def update_state():
    global data_storage
    new_data = request.json
    
    satellites = new_data.get("satellites", [])
    
    # 1. CORE BACKEND LOGIC: Collision Detection
    # If there are at least 2 satellites, check their distance
    if len(satellites) >= 2:
        for i in range(len(satellites)):
            for j in range(i + 1, len(satellites)):
                s1 = satellites[i]
                s2 = satellites[j]
                
                # Math: Simple Euclidean distance (Lat/Lon/Alt)
                # In a real scenario, use Haversine, but this works great for a demo!
                dist = ((s1['latitude'] - s2['latitude'])**2 + 
                        (s1['longitude'] - s2['longitude'])**2 + 
                        ((s1['altitude'] - s2['altitude'])/100)**2)**0.5
                
                # 2. AUTOMATIC OPTIMIZATION: If too close, flag it!
                if dist < 0.5:  # Threshold for "Danger"
                    print(f"⚠️ BACKEND ALERT: {s1['name']} & {s2['name']} conflict detected!")
                    
                    # Create a new alert object to show on your friend's UI
                    new_alert = {
                        "id": f"alert-{i}-{j}",
                        "satelliteId": s1['id'],
                        "satelliteName": s1['name'],
                        "field": "Collision Risk",
                        "severity": "high",
                        "title": "CRITICAL PROXIMITY",
                        "message": f"Conflict between {s1['name']} and {s2['name']}. Suggesting 5km altitude adjustment.",
                        "timestamp": "Now"
                    }
                    
                    # Add to the changeAlerts list so the frontend displays it
                    if "changeAlerts" not in new_data:
                        new_data["changeAlerts"] = []
                    new_data["changeAlerts"].insert(0, new_alert)

    data_storage = new_data
    return jsonify({"status": "success"}), 200