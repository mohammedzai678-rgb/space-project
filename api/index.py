import json
import threading
import time
import requests
import math
import os
import warnings
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from sgp4.api import Satrec, jday
import google.generativeai as genai

# Silence warnings for a clean console
warnings.filterwarnings("ignore", category=FutureWarning)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# --- 1. CONFIGURATION ---
api_key = os.environ.get("GEMINI_API_KEY")
genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-2.5-flash')

data_storage = {
    "satellites": [],
    "launches": [],
    "catastrophes": [],
    "changeAlerts": [],
    "theme": "dark"
}

# The data you provided - only used if the LIVE internet fetch fails!
FALLBACK_TLE = """CALSPHERE 1             
1 00900U 64063C   26070.97950905  .00000709  00000+0  71399-3 0  9994
2 00900  90.2161  69.5022 0023870 223.3653 190.0376 13.76500967 58056
CALSPHERE 2             
1 00902U 64063E   26070.99577627  .00000053  00000+0  66918-4 0  9998
2 00902  90.2283  73.4878 0019675 144.5984 274.6670 13.52891852843121
ISS (ZARYA)             
1 25544U 98067A   26071.15917149  .00009166  00000+0  17667-3 0  9994
2 25544  51.6325  60.1463 0007984 183.4136 176.6799 15.48595269556375"""

# --- 2. MULTI-SOURCE LIVE FETCH ---
def fetch_live_satellites():
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/plain'
    })

    # Try Primary source first
    sources = [
        "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
        "https://www.celestrak.com/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
    ]
    
    raw_text = None
    for url in sources:
        try:
            print(f"📡 Attempting live fetch from: {url}")
            r = session.get(url, timeout=15)
            if r.status_code == 200 and len(r.text) > 100:
                raw_text = r.text
                print("✅ Live Data Secured!")
                break
        except:
            continue

    if not raw_text:
        print("❌ All live sources blocked. Using local storage to keep globe alive.")
        raw_text = FALLBACK_TLE

    lines = raw_text.splitlines()
    sats = []
    
    for i in range(0, len(lines) - 2, 3):
        if len(sats) >= 60: break # Increased to 60 for better visuals
        
        try:
            name, l1, l2 = lines[i].strip(), lines[i+1], lines[i+2]
            satellite = Satrec.twoline2rv(l1, l2)
            now = datetime.utcnow()
            jd, fr = jday(now.year, now.month, now.day, now.hour, now.minute, now.second)
            e, r, v = satellite.sgp4(jd, fr)
            
            if e == 0:
                alt = math.sqrt(r[0]**2 + r[1]**2 + r[2]**2) - 6371
                lat = math.degrees(math.asin(r[2] / (alt + 6371)))
                lon = math.degrees(math.atan2(r[1], r[0]))
                
                sats.append({
                    "id": f"S-{i}", "name": name, 
                    "latitude": round(lat, 4), "longitude": round(lon, 4), 
                    "altitude": int(alt), "status": "Operational"
                })
        except: continue
    return sats

def sync_loop():
    global data_storage
    while True:
        live_sats = fetch_live_satellites()
        if live_sats:
            data_storage["satellites"] = live_sats
        # On Vercel, we sync every 5 mins to keep it fresh without getting banned
        time.sleep(300) 

# --- 3. API ROUTES ---

@app.route('/api/chat', methods=['POST'])
def chat_with_ai():
    req_data = request.json
    msg = req_data.get("message", "")
    stats = f"Tracking {len(data_storage['satellites'])} satellites."
    try:
        res = model.generate_content(f"Context: {stats}\nUser: {msg}")
        return jsonify({"response": res.text})
    except Exception as e:
        return jsonify({"response": f"AI Error: {e}"})

@app.route('/api/state', methods=['GET'])
def get_state():
    return jsonify(data_storage)

@app.route('/api/state', methods=['PUT'])
def update_state():
    global data_storage
    data_storage = request.json
    return jsonify({"status": "success"})

# --- 4. LAUNCH ---
if __name__ == '__main__':
    threading.Thread(target=sync_loop, daemon=True).start()
    # 0.0.0.0 is critical for cloud visibility
    app.run(host='0.0.0.0', port=5000, debug=False)