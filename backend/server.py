from flask import Flask, request, jsonify
from flask_cors import CORS
import json

app = Flask(__name__)
CORS(app) # This allows your friend's HTML to talk to this Python script

# This is where we store the data in the backend
data_storage = {
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
    
    # YOUR BACKEND LOGIC GOES HERE
    # Example: Check if any new satellite is too close to another
    if "satellites" in new_data:
        print(f"Backend received {len(new_data['satellites'])} satellites. Calculating risks...")
        # You can add your math logic here later!

    data_storage = new_data # Save the data
    return jsonify({"status": "success"}), 200

if __name__ == '__main__':
    app.run(port=5000, debug=True)