from optimizer import detect_conflicts

MAX_CHANGE_ALERTS = 25
BACKEND_ALERT_SOURCE = "python-backend"


def create_default_state():
    return {
        "nextId": 1001,
        "nextLaunchId": 1,
        "nextCatastropheId": 1,
        "selectedSatelliteId": None,
        "satellites": [],
        "launches": [],
        "catastrophes": [],
        "changeAlerts": [],
        "theme": "dark",
    }


def normalise_state(candidate):
    fallback = create_default_state()
    if not isinstance(candidate, dict):
        return fallback

    satellites = candidate.get("satellites", [])
    launches = candidate.get("launches", [])
    catastrophes = candidate.get("catastrophes", [])
    change_alerts = candidate.get("changeAlerts", [])
    selected_satellite_id = candidate.get("selectedSatelliteId")

    if not isinstance(satellites, list):
        satellites = []
    if not isinstance(launches, list):
        launches = []
    if not isinstance(catastrophes, list):
        catastrophes = []
    if not isinstance(change_alerts, list):
        change_alerts = []

    return {
        "nextId": candidate.get("nextId", fallback["nextId"]),
        "nextLaunchId": candidate.get("nextLaunchId", fallback["nextLaunchId"]),
        "nextCatastropheId": candidate.get(
            "nextCatastropheId",
            fallback["nextCatastropheId"],
        ),
        "selectedSatelliteId": selected_satellite_id
        or (satellites[0].get("id") if satellites else None),
        "satellites": satellites,
        "launches": launches,
        "catastrophes": catastrophes,
        "changeAlerts": change_alerts[:MAX_CHANGE_ALERTS],
        "theme": "light" if candidate.get("theme") == "light" else "dark",
    }


def build_backend_alert(conflict):
    first_satellite, second_satellite = conflict["satellites"]
    severity = conflict["severity"]
    pair_key = "::".join(
        sorted(
            [
                str(first_satellite.get("id", first_satellite.get("name", "unknown-a"))),
                str(second_satellite.get("id", second_satellite.get("name", "unknown-b"))),
            ]
        )
    )

    return {
        "id": f"{BACKEND_ALERT_SOURCE}::{pair_key}",
        "satelliteId": first_satellite.get("id"),
        "satelliteName": first_satellite.get("name", "Unknown satellite"),
        "field": "Collision Risk",
        "severity": severity,
        "title": "Critical Proximity" if severity == "high" else "Traffic Advisory",
        "message": (
            f"{first_satellite.get('name', 'Unknown')} and "
            f"{second_satellite.get('name', 'Unknown')} are {conflict['distance_km']} km apart. "
            f"Suggested altitude adjustment: "
            f"{conflict['recommended_altitude_adjustment_km']} km."
        ),
        "timestamp": "Python backend analysis",
        "source": BACKEND_ALERT_SOURCE,
    }


def merge_change_alerts(existing_alerts, backend_alerts):
    preserved_alerts = [
        alert for alert in existing_alerts if alert.get("source") != BACKEND_ALERT_SOURCE
    ]
    return (backend_alerts + preserved_alerts)[:MAX_CHANGE_ALERTS]


def process_state(candidate):
    state = normalise_state(candidate)
    conflicts = detect_conflicts(state["satellites"])
    backend_alerts = [build_backend_alert(conflict) for conflict in conflicts]

    state["changeAlerts"] = merge_change_alerts(
        state["changeAlerts"],
        backend_alerts,
    )
    state["backendInsights"] = {
        "engine": "python",
        "conflictCount": len(backend_alerts),
    }
    return state
