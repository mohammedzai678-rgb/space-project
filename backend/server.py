import math
import os
import threading
import time
from datetime import datetime

import requests
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from sgp4.api import Satrec, jday

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
FRONTEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

STATE_DEFAULTS = {
    "satellites": [],
    "launches": [],
    "catastrophes": [],
    "changeAlerts": [],
    "theme": "dark",
}
ALLOWED_CHAT_QUESTIONS = [
    "How many satellites are currently tracked?",
    "Which region is busiest right now?",
    "How many high-priority collision alerts are active?",
    "Which two satellites are currently closest?",
    "Is live API tracking connected?",
]
ALLOWED_CHAT_QUESTION_MAP = {
    " ".join(question.lower().split()): question for question in ALLOWED_CHAT_QUESTIONS
}
FALLBACK_TRACKING_SATELLITES = [
    {
        "id": "TRACK-1001",
        "name": "HRC MONOBLOCK CAMERA",
        "operator": "Fallback",
        "latitude": 23.11,
        "longitude": -38.2,
        "altitude": 540,
        "status": "Operational",
        "region": "North Atlantic",
        "velocity": 7.64,
        "inclination": 53.2,
        "mission": "Observation",
    },
    {
        "id": "TRACK-1002",
        "name": "E-KAGAKU-1",
        "operator": "Fallback",
        "latitude": 46.2,
        "longitude": 22.5,
        "altitude": 620,
        "status": "Operational",
        "region": "Europe",
        "velocity": 7.58,
        "inclination": 51.7,
        "mission": "Communication",
    },
    {
        "id": "TRACK-1003",
        "name": "ISS OBJECT XK",
        "operator": "Fallback",
        "latitude": -10.7,
        "longitude": -88.5,
        "altitude": 415,
        "status": "Monitoring",
        "region": "South Pacific",
        "velocity": 7.67,
        "inclination": 51.6,
        "mission": "Research",
    },
    {
        "id": "TRACK-1004",
        "name": "ISS (ZARYA)",
        "operator": "Fallback",
        "latitude": -7.9,
        "longitude": -13.4,
        "altitude": 417,
        "status": "Operational",
        "region": "South Atlantic",
        "velocity": 7.67,
        "inclination": 51.6,
        "mission": "Research",
    },
    {
        "id": "TRACK-1005",
        "name": "NAUKA",
        "operator": "Fallback",
        "latitude": -8.1,
        "longitude": -13.1,
        "altitude": 416,
        "status": "Operational",
        "region": "South Atlantic",
        "velocity": 7.67,
        "inclination": 51.6,
        "mission": "Research",
    },
    {
        "id": "TRACK-1006",
        "name": "POISK",
        "operator": "Fallback",
        "latitude": -7.7,
        "longitude": -12.8,
        "altitude": 416,
        "status": "Operational",
        "region": "South Atlantic",
        "velocity": 7.67,
        "inclination": 51.6,
        "mission": "Research",
    },
    {
        "id": "TRACK-1007",
        "name": "RASSVET",
        "operator": "Fallback",
        "latitude": -8.3,
        "longitude": -12.5,
        "altitude": 417,
        "status": "Operational",
        "region": "South Atlantic",
        "velocity": 7.67,
        "inclination": 51.6,
        "mission": "Research",
    },
    {
        "id": "TRACK-1008",
        "name": "PRICHAL",
        "operator": "Fallback",
        "latitude": -7.6,
        "longitude": -12.2,
        "altitude": 418,
        "status": "Operational",
        "region": "South Atlantic",
        "velocity": 7.67,
        "inclination": 51.6,
        "mission": "Research",
    },
    {
        "id": "TRACK-1009",
        "name": "PROGRESS-MS 31",
        "operator": "Fallback",
        "latitude": -8.8,
        "longitude": -12.4,
        "altitude": 418,
        "status": "Operational",
        "region": "South Atlantic",
        "velocity": 7.66,
        "inclination": 51.6,
        "mission": "Cargo",
    },
    {
        "id": "TRACK-1010",
        "name": "PROGRESS-MS 32",
        "operator": "Fallback",
        "latitude": -8.6,
        "longitude": -12.1,
        "altitude": 419,
        "status": "Operational",
        "region": "South Atlantic",
        "velocity": 7.66,
        "inclination": 51.6,
        "mission": "Cargo",
    },
    {
        "id": "TRACK-1011",
        "name": "CYGNUS NG-23",
        "operator": "Fallback",
        "latitude": -8.5,
        "longitude": -11.9,
        "altitude": 420,
        "status": "Monitoring",
        "region": "South Atlantic",
        "velocity": 7.64,
        "inclination": 51.6,
        "mission": "Cargo",
    },
    {
        "id": "TRACK-1012",
        "name": "HTV-X1",
        "operator": "Fallback",
        "latitude": -8.2,
        "longitude": -11.7,
        "altitude": 419,
        "status": "Monitoring",
        "region": "South Atlantic",
        "velocity": 7.63,
        "inclination": 51.6,
        "mission": "Cargo",
    },
    {
        "id": "TRACK-1013",
        "name": "SOYUZ-MS 28",
        "operator": "Fallback",
        "latitude": -8.4,
        "longitude": -11.5,
        "altitude": 418,
        "status": "Operational",
        "region": "South Atlantic",
        "velocity": 7.66,
        "inclination": 51.6,
        "mission": "Crew",
    },
    {
        "id": "TRACK-1014",
        "name": "CSS (WENTIAN)",
        "operator": "Fallback",
        "latitude": -18.4,
        "longitude": 46.8,
        "altitude": 389,
        "status": "Operational",
        "region": "Africa",
        "velocity": 7.66,
        "inclination": 41.5,
        "mission": "Station Module",
    },
    {
        "id": "TRACK-1015",
        "name": "CSS (MENGTIAN)",
        "operator": "Fallback",
        "latitude": -18.5,
        "longitude": 47.1,
        "altitude": 390,
        "status": "Operational",
        "region": "Africa",
        "velocity": 7.66,
        "inclination": 41.5,
        "mission": "Station Module",
    },
    {
        "id": "TRACK-1016",
        "name": "TIANZHOU-9",
        "operator": "Fallback",
        "latitude": -21.2,
        "longitude": 35.8,
        "altitude": 390,
        "status": "Operational",
        "region": "Africa",
        "velocity": 7.66,
        "inclination": 41.5,
        "mission": "Cargo",
    },
    {
        "id": "TRACK-1017",
        "name": "SHENZHOU-22",
        "operator": "Fallback",
        "latitude": -11.2,
        "longitude": 57.9,
        "altitude": 387,
        "status": "Operational",
        "region": "Africa",
        "velocity": 7.66,
        "inclination": 41.5,
        "mission": "Crew",
    },
    {
        "id": "TRACK-1018",
        "name": "STARLINK-30001",
        "operator": "Fallback",
        "latitude": 11.9,
        "longitude": 73.4,
        "altitude": 550,
        "status": "Operational",
        "region": "South Asia",
        "velocity": 7.59,
        "inclination": 53.0,
        "mission": "Communication",
    },
    {
        "id": "TRACK-1019",
        "name": "STARLINK-30002",
        "operator": "Fallback",
        "latitude": 12.3,
        "longitude": 73.8,
        "altitude": 552,
        "status": "Operational",
        "region": "South Asia",
        "velocity": 7.59,
        "inclination": 53.0,
        "mission": "Communication",
    },
    {
        "id": "TRACK-1020",
        "name": "FREGAT DEB",
        "operator": "Fallback",
        "latitude": -52.1,
        "longitude": 72.3,
        "altitude": 860,
        "status": "Monitoring",
        "region": "South Indian Ocean",
        "velocity": 7.35,
        "inclination": 62.1,
        "mission": "Debris",
    },
]

OPEN_SOURCE_PROVIDER = os.getenv("OPEN_SOURCE_PROVIDER", "auto").strip().lower()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct")
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY", "").strip()
HUGGINGFACE_MODEL = os.getenv("HUGGINGFACE_MODEL", "mistralai/Mistral-7B-Instruct-v0.3")
LIVE_SYNC_INTERVAL_SECONDS = int(os.getenv("LIVE_SYNC_INTERVAL_SECONDS", "90"))
LIVE_SYNC_RETRY_SECONDS = int(os.getenv("LIVE_SYNC_RETRY_SECONDS", "20"))

data_storage = dict(STATE_DEFAULTS)
live_satellite_storage = []
last_live_sync_utc = ""


def is_live_satellite_entry(satellite):
    sat_id = str(satellite.get("id", "")).strip().upper()
    return sat_id.startswith("NASA-")


def merge_satellite_lists(manual_satellites, live_satellites):
    merged = []
    seen_ids = set()
    seen_names = set()

    for satellite in [*(manual_satellites or []), *(live_satellites or [])]:
        if not isinstance(satellite, dict):
            continue

        sat_id = str(satellite.get("id", "")).strip().lower()
        sat_name = str(satellite.get("name", "")).strip().lower()

        if sat_id and sat_id in seen_ids:
            continue
        if sat_name and sat_name in seen_names:
            continue

        merged.append(satellite)
        if sat_id:
            seen_ids.add(sat_id)
        if sat_name:
            seen_names.add(sat_name)

    return merged


def current_backend_state():
    merged_satellites = merge_satellite_lists(
        data_storage.get("satellites", []),
        live_satellite_storage,
    )
    using_fallback = False
    if not merged_satellites:
        merged_satellites = [dict(item) for item in FALLBACK_TRACKING_SATELLITES]
        using_fallback = True

    return {
        **data_storage,
        "satellites": merged_satellites,
        "liveTracking": {
            "available": bool(live_satellite_storage),
            "count": len(live_satellite_storage),
            "lastSyncUtc": last_live_sync_utc or None,
            "source": "live" if live_satellite_storage else ("fallback" if using_fallback else "manual"),
        },
    }


def get_live_satellite_data():
    try:
        url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle"
        response = requests.get(url, timeout=12)
        response.raise_for_status()
        lines = response.text.splitlines()

        new_satellites = []
        for index in range(0, len(lines[:60]), 3):
            name = lines[index].strip()
            satellite = Satrec.twoline2rv(lines[index + 1], lines[index + 2])
            jd, fr = jday(*datetime.utcnow().timetuple()[:6])
            error_code, position, _velocity = satellite.sgp4(jd, fr)

            if error_code != 0:
                continue

            altitude = math.sqrt(position[0] ** 2 + position[1] ** 2 + position[2] ** 2) - 6371
            latitude = math.degrees(math.asin(position[2] / (altitude + 6371)))
            longitude = math.degrees(math.atan2(position[1], position[0])) - ((datetime.utcnow().hour * 15) % 360)
            if longitude < -180:
                longitude += 360

            new_satellites.append(
                {
                    "id": f"NASA-{index}",
                    "name": name,
                    "operator": "NASA",
                    "latitude": round(latitude, 2),
                    "longitude": round(longitude, 2),
                    "altitude": int(altitude),
                    "status": "Operational",
                    "region": "International",
                    "velocity": 7.66,
                }
            )

        return new_satellites
    except Exception:
        return []


def background_sync():
    global live_satellite_storage
    global last_live_sync_utc
    while True:
        live_satellites = get_live_satellite_data()
        if live_satellites:
            live_satellite_storage = live_satellites
            last_live_sync_utc = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
            print(f"NASA Sync: {len(live_satellites)} sats live.")
            time.sleep(max(15, LIVE_SYNC_INTERVAL_SECONDS))
            continue

        print("NASA Sync: source unavailable, keeping last known live satellites.")
        time.sleep(max(10, LIVE_SYNC_RETRY_SECONDS))


def detect_collision_alerts(payload):
    satellites = payload.get("satellites", [])
    generated_alerts = []

    if len(satellites) < 2:
        return generated_alerts

    for i in range(len(satellites)):
        for j in range(i + 1, len(satellites)):
            sat_a = satellites[i]
            sat_b = satellites[j]
            distance = (
                (sat_a["latitude"] - sat_b["latitude"]) ** 2
                + (sat_a["longitude"] - sat_b["longitude"]) ** 2
                + ((sat_a["altitude"] - sat_b["altitude"]) / 100) ** 2
            ) ** 0.5

            if distance < 0.5:
                generated_alerts.append(
                    {
                        "id": f"alert-{sat_a['id']}-{sat_b['id']}",
                        "satelliteId": sat_a["id"],
                        "satelliteName": sat_a["name"],
                        "field": "Collision Risk",
                        "severity": "high",
                        "title": "CRITICAL PROXIMITY",
                        "message": (
                            f"Conflict between {sat_a['name']} and {sat_b['name']}. "
                            "Suggesting 5km altitude adjustment."
                        ),
                        "timestamp": "Now",
                    }
                )
    return generated_alerts


def state_summary(frontend_state, backend_state, ui_snapshot):
    front_satellites = frontend_state.get("satellites", [])
    backend_satellites = backend_state.get("satellites", [])
    front_alerts = frontend_state.get("changeAlerts", [])
    backend_alerts = backend_state.get("changeAlerts", [])
    launches = backend_state.get("launches", frontend_state.get("launches", []))
    catastrophes = backend_state.get("catastrophes", frontend_state.get("catastrophes", []))

    return (
        f"Frontend satellites: {len(front_satellites)}. "
        f"Backend satellites: {len(backend_satellites)}. "
        f"Frontend change alerts: {len(front_alerts)}. "
        f"Backend change alerts: {len(backend_alerts)}. "
        f"Launches: {len(launches)}. "
        f"Catastrophes: {len(catastrophes)}. "
        f"UI metrics: {ui_snapshot.get('metrics', {})}. "
        f"Selected panel snapshot: {ui_snapshot.get('selectedSatelliteCard', '')[:260]}. "
        f"Corridor criteria snapshot: {ui_snapshot.get('corridorCriteria', '')[:260]}."
    )


def normalise_question(message):
    return " ".join(str(message or "").lower().split())


def safe_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def to_radians(value):
    return math.radians(safe_float(value))


def approx_distance_km(sat_a, sat_b):
    lat1 = to_radians(sat_a.get("latitude", 0))
    lon1 = to_radians(sat_a.get("longitude", 0))
    lat2 = to_radians(sat_b.get("latitude", 0))
    lon2 = to_radians(sat_b.get("longitude", 0))

    dlat = lat2 - lat1
    dlon = lon2 - lon1
    hav = (math.sin(dlat / 2) ** 2) + (math.cos(lat1) * math.cos(lat2) * (math.sin(dlon / 2) ** 2))
    central_angle = 2 * math.atan2(math.sqrt(hav), math.sqrt(max(1e-12, 1 - hav)))
    altitude_a = safe_float(sat_a.get("altitude", 0))
    altitude_b = safe_float(sat_b.get("altitude", 0))
    avg_radius = 6371 + ((altitude_a + altitude_b) / 2)
    surface_distance = avg_radius * central_angle
    altitude_gap = abs(altitude_a - altitude_b)
    return (surface_distance**2 + altitude_gap**2) ** 0.5


def answer_restricted_chat(question, frontend_state, backend_state):
    satellites = frontend_state.get("satellites") or backend_state.get("satellites") or []
    alerts = frontend_state.get("changeAlerts") or backend_state.get("changeAlerts") or []

    if question == ALLOWED_CHAT_QUESTIONS[0]:
        return f"The dashboard is currently tracking {len(satellites)} satellite(s)."

    if question == ALLOWED_CHAT_QUESTIONS[1]:
        if not satellites:
            return "No satellites are tracked yet, so there is no busiest region right now."

        region_counts = {}
        for satellite in satellites:
            region = str(satellite.get("region") or "Unknown")
            region_counts[region] = region_counts.get(region, 0) + 1

        top_region, top_count = sorted(
            region_counts.items(),
            key=lambda item: (-item[1], item[0]),
        )[0]
        return f"The busiest region right now is {top_region} with {top_count} satellite(s)."

    if question == ALLOWED_CHAT_QUESTIONS[2]:
        high_alerts = [
            alert for alert in alerts if str(alert.get("severity", "")).strip().lower() == "high"
        ]
        return f"There are {len(high_alerts)} high-priority collision-related alert(s) active."

    if question == ALLOWED_CHAT_QUESTIONS[3]:
        if len(satellites) < 2:
            return "At least two satellites are required before I can compute the closest pair."

        closest_pair = None
        closest_distance = float("inf")
        for i in range(len(satellites)):
            for j in range(i + 1, len(satellites)):
                sat_a = satellites[i]
                sat_b = satellites[j]
                distance = approx_distance_km(sat_a, sat_b)
                if distance < closest_distance:
                    closest_distance = distance
                    closest_pair = (sat_a, sat_b)

        if not closest_pair:
            return "I could not determine the closest satellites from the current data."

        sat_a, sat_b = closest_pair
        return (
            f"The closest satellites are {sat_a.get('name', 'Unknown')} and "
            f"{sat_b.get('name', 'Unknown')} at about {closest_distance:.0f} km apart."
        )

    if question == ALLOWED_CHAT_QUESTIONS[4]:
        live_tracking = backend_state.get("liveTracking") or {}
        is_available = bool(live_tracking.get("available"))
        count = int(live_tracking.get("count") or 0)
        last_sync = live_tracking.get("lastSyncUtc")

        if is_available:
            sync_text = f" Last sync: {last_sync}." if last_sync else ""
            return f"Yes, live API tracking is connected with {count} live satellite(s).{sync_text}"

        return "Live API tracking is not connected right now."

    return "Please choose one of the supported questions from the dropdown list."


def local_chat_response(message, frontend_state, backend_state):
    text = message.lower()
    satellites = frontend_state.get("satellites") or backend_state.get("satellites") or []
    alerts = frontend_state.get("changeAlerts") or backend_state.get("changeAlerts") or []

    if any(word in text for word in ["hello", "hi", "hey", "yo"]):
        return (
            "Hi. I can answer both general questions and app-specific questions. "
            "Ask anything, and I will use live dashboard state when relevant."
        )

    if "count" in text or "how many" in text:
        return f"The stack is currently tracking {len(satellites)} satellites."

    if "risk" in text or "danger" in text or "close" in text:
        return (
            f"There are {len(alerts)} tracked change/collision-related alerts. "
            "Review the top risk cards and corridor criteria panel for current triggers."
        )

    if satellites:
        top_names = ", ".join(item.get("name", "Unknown") for item in satellites[:3])
        return f"I can read live stack data. Current satellite sample: {top_names}."

    return (
        "I can analyze your app state, but no satellites are currently tracked yet. "
        "For unrestricted general Q&A, set OPENROUTER_API_KEY or HUGGINGFACE_API_KEY."
    )


def build_ai_prompt(message, frontend_state, backend_state, ui_snapshot):
    return (
        "You are a high-quality assistant that can answer any type of question. "
        "If the user asks about the dashboard, satellite risk, corridors, or tracked objects, "
        "use the live app state below as source of truth. "
        "If the user asks general knowledge, coding, writing, or other topics, answer normally.\n"
        f"Live app state summary: {state_summary(frontend_state, backend_state, ui_snapshot)}\n"
        f"User question: {message}\n"
        "Keep answers clear and practical."
    )


def call_openrouter(prompt):
    endpoint = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.getenv("OPENROUTER_REFERER", "https://openrouter.ai"),
        "X-Title": os.getenv("OPENROUTER_APP_TITLE", "Orbital Traffic Dashboard"),
    }
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": "You are a helpful, accurate assistant that can answer any type of question."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 700,
    }
    response = requests.post(endpoint, headers=headers, json=payload, timeout=22)
    response.raise_for_status()
    body = response.json()
    text = (
        body.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
        .strip()
    )
    if not text:
        raise RuntimeError("OpenRouter returned an empty response.")
    return text


def call_huggingface(prompt):
    endpoint = f"https://api-inference.huggingface.co/models/{HUGGINGFACE_MODEL}"
    headers = {
        "Authorization": f"Bearer {HUGGINGFACE_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "inputs": prompt,
        "parameters": {
            "temperature": 0.2,
            "max_new_tokens": 700,
            "return_full_text": False,
        },
    }
    response = requests.post(endpoint, headers=headers, json=payload, timeout=22)
    response.raise_for_status()
    body = response.json()

    text = ""
    if isinstance(body, list) and body:
        item = body[0]
        if isinstance(item, dict):
            text = str(item.get("generated_text", "")).strip()
    elif isinstance(body, dict):
        text = str(body.get("generated_text", "")).strip()

    if not text:
        raise RuntimeError("Hugging Face returned an empty response.")
    return text


def available_providers():
    providers = []
    if OPENROUTER_API_KEY:
        providers.append("openrouter")
    if HUGGINGFACE_API_KEY:
        providers.append("huggingface")
    return providers


def ordered_provider_attempts():
    providers = available_providers()
    valid = {"openrouter", "huggingface"}
    if OPEN_SOURCE_PROVIDER and OPEN_SOURCE_PROVIDER != "auto" and OPEN_SOURCE_PROVIDER in valid:
        return [OPEN_SOURCE_PROVIDER] + [provider for provider in providers if provider != OPEN_SOURCE_PROVIDER]
    return providers


def generate_best_ai_response(message, frontend_state, backend_state, ui_snapshot):
    prompt = build_ai_prompt(message, frontend_state, backend_state, ui_snapshot)
    attempts = ordered_provider_attempts()

    if not attempts:
        return local_chat_response(message, frontend_state, backend_state), "fallback"

    for provider in attempts:
        try:
            if provider == "openrouter" and OPENROUTER_API_KEY:
                return call_openrouter(prompt), "openrouter"
            if provider == "huggingface" and HUGGINGFACE_API_KEY:
                return call_huggingface(prompt), "huggingface"
        except Exception:
            continue

    return local_chat_response(message, frontend_state, backend_state), "fallback"


@app.route("/api/state", methods=["GET", "PUT"])
def handle_state():
    global data_storage

    if request.method == "PUT":
        incoming_raw = request.get_json(silent=True) or {}
        incoming = incoming_raw if isinstance(incoming_raw, dict) else {}

        incoming_satellites = incoming.get("satellites", [])
        manual_satellites = [
            satellite
            for satellite in incoming_satellites
            if isinstance(satellite, dict) and not is_live_satellite_entry(satellite)
        ]

        alerts_from_detection = detect_collision_alerts(
            {
                **incoming,
                "satellites": merge_satellite_lists(manual_satellites, live_satellite_storage),
            }
        )
        existing_alerts = list(incoming.get("changeAlerts", []))

        # Put generated alerts at the top while avoiding duplicate IDs.
        seen_ids = {alert.get("id") for alert in existing_alerts}
        for alert in reversed(alerts_from_detection):
            if alert["id"] not in seen_ids:
                existing_alerts.insert(0, alert)
                seen_ids.add(alert["id"])

        incoming["changeAlerts"] = existing_alerts[:60]
        data_storage = {**STATE_DEFAULTS, **incoming}
        data_storage["satellites"] = manual_satellites

        return jsonify(
            {
                "status": "success",
                "manualSatellites": len(manual_satellites),
                "liveSatellites": len(live_satellite_storage),
            }
        ), 200

    return jsonify(current_backend_state())


@app.route("/api/chat", methods=["POST"])
def handle_chat():
    payload = request.get_json(silent=True) or {}
    message = (payload.get("message") or "").strip()

    if not message:
        return jsonify({"error": "Message is required."}), 400

    frontend_state = payload.get("frontendState") or {}
    backend_state = payload.get("backendState") or current_backend_state()
    normalised = normalise_question(message)
    canonical_question = ALLOWED_CHAT_QUESTION_MAP.get(normalised)

    if not canonical_question:
        return jsonify(
            {
                "response": "Please select one of the supported questions from the dropdown list.",
                "source": "restricted",
                "allowedQuestions": ALLOWED_CHAT_QUESTIONS,
            }
        )

    try:
        response_text = answer_restricted_chat(
            canonical_question, frontend_state, backend_state
        )
        return jsonify(
            {
                "response": response_text,
                "source": "restricted",
                "allowedQuestions": ALLOWED_CHAT_QUESTIONS,
            }
        )
    except Exception:
        fallback = "Please select one of the supported questions from the dropdown list."
        return jsonify(
            {
                "response": fallback,
                "source": "restricted",
                "allowedQuestions": ALLOWED_CHAT_QUESTIONS,
            }
        )


@app.route("/api/chat/options", methods=["GET"])
def handle_chat_options():
    return jsonify({"questions": ALLOWED_CHAT_QUESTIONS})


@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def serve_frontend(path):
    if path.startswith("api/"):
        return jsonify({"error": "Not found"}), 404

    safe_path = os.path.normpath(path).lstrip("/\\")
    absolute_path = os.path.abspath(os.path.join(FRONTEND_ROOT, safe_path))
    if not absolute_path.startswith(FRONTEND_ROOT):
        return jsonify({"error": "Forbidden"}), 403

    if not os.path.exists(absolute_path):
        return jsonify({"error": "Not found"}), 404

    return send_from_directory(FRONTEND_ROOT, safe_path)


if __name__ == "__main__":
    threading.Thread(target=background_sync, daemon=True).start()
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
