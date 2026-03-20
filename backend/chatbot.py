from optimizer import detect_conflicts
from traffic_engine import process_state

DEFAULT_SUGGESTIONS = [
    "Show collision risk",
    "Which region is busiest?",
    "Summarise launches",
]


def _normalise_message(message):
    if not isinstance(message, str):
        return ""

    return " ".join(message.strip().lower().split())


def _build_region_counts(satellites):
    counts = {}

    for satellite in satellites:
        region = satellite.get("region") or "Unknown"
        counts[region] = counts.get(region, 0) + 1

    return counts


def _find_target_satellite(state, message):
    satellites = state.get("satellites", [])
    if not satellites:
        return None

    if "selected" in message or "current" in message:
        selected_id = state.get("selectedSatelliteId")
        for satellite in satellites:
            if satellite.get("id") == selected_id:
                return satellite

    for satellite in satellites:
        satellite_name = str(satellite.get("name", "")).lower()
        if satellite_name and satellite_name in message:
            return satellite

    return None


def _format_launch_summary(launch):
    return (
        f"{launch.get('name', 'Unnamed launch')} on "
        f"{launch.get('launchDate', 'an unknown date')} from "
        f"{launch.get('launchSite', 'an unknown site')}"
    )


def _format_incident_summary(event):
    return (
        f"{event.get('name', 'Unnamed incident')} on "
        f"{event.get('date', 'an unknown date')} "
        f"({event.get('severity', 'unknown')} severity)"
    )


def _build_satellite_reply(target_satellite, conflicts):
    related_conflict = None

    for conflict in conflicts:
        first_satellite, second_satellite = conflict["satellites"]
        if target_satellite.get("id") in {
            first_satellite.get("id"),
            second_satellite.get("id"),
        }:
            related_conflict = conflict
            break

    base_reply = (
        f"{target_satellite.get('name', 'Unknown satellite')} is in "
        f"{target_satellite.get('region', 'Unknown')} at "
        f"{target_satellite.get('altitude', 0)} km altitude, moving at "
        f"{target_satellite.get('velocity', 0)} km/s, with status "
        f"{target_satellite.get('status', 'Unknown')}."
    )

    if related_conflict:
        first_satellite, second_satellite = related_conflict["satellites"]
        partner = (
            second_satellite
            if first_satellite.get("id") == target_satellite.get("id")
            else first_satellite
        )
        return (
            f"{base_reply} Closest conflict is with "
            f"{partner.get('name', 'Unknown')} at "
            f"{related_conflict['distance_km']} km, and the recommended "
            f"altitude adjustment is "
            f"{related_conflict['recommended_altitude_adjustment_km']} km."
        )

    return f"{base_reply} No active conflict is currently attached to this satellite."


def _build_context_payload(state, conflicts):
    satellites = state.get("satellites", [])
    launches = state.get("launches", [])
    catastrophes = state.get("catastrophes", [])

    return {
        "satelliteCount": len(satellites),
        "conflictCount": len(conflicts),
        "launchCount": len(launches),
        "catastropheCount": len(catastrophes),
    }


def _build_fallback_response(message, state):
    message_normalised = _normalise_message(message)
    satellites = state.get("satellites", [])
    launches = state.get("launches", [])
    catastrophes = state.get("catastrophes", [])
    conflicts = detect_conflicts(satellites)
    region_counts = _build_region_counts(satellites)
    busiest_region = None

    if region_counts:
        busiest_region = sorted(
            region_counts.items(),
            key=lambda item: (-item[1], item[0]),
        )[0]

    if (
        not message_normalised
        or any(word in message_normalised for word in ("hello", "hi", "hey", "help"))
    ):
        reply = (
            "Mission assistant online. "
            "Ask about collision risk, busiest regions, launches, incidents, or "
            "a satellite by name."
        )
        intent = "help"
    elif any(
        word in message_normalised
        for word in ("risk", "collision", "conflict", "close", "alert", "danger")
    ):
        if conflicts:
            top_conflict = conflicts[0]
            first_satellite, second_satellite = top_conflict["satellites"]
            reply = (
                f"I found {len(conflicts)} active conflict(s). Highest priority "
                f"is {first_satellite.get('name', 'Unknown')} versus "
                f"{second_satellite.get('name', 'Unknown')} at "
                f"{top_conflict['distance_km']} km, with a suggested altitude "
                f"adjustment of "
                f"{top_conflict['recommended_altitude_adjustment_km']} km."
            )
        else:
            reply = (
                f"There are no active collision conflicts. I currently see "
                f"{len(satellites)} tracked satellite(s)."
            )
        intent = "risk"
    elif any(
        word in message_normalised for word in ("region", "corridor", "busiest", "crowded")
    ):
        if busiest_region:
            region_name, region_count = busiest_region
            reply = (
                f"The busiest region is {region_name} with {region_count} "
                f"tracked satellite(s)."
            )
        else:
            reply = "No satellites are tracked yet, so there is no busiest region."
        intent = "regions"
    elif any(word in message_normalised for word in ("launch", "future mission", "queue")):
        if launches:
            preview = ", ".join(
                _format_launch_summary(launch) for launch in launches[:3]
            )
            reply = (
                f"There are {len(launches)} future launch(es) tracked: {preview}."
            )
        else:
            reply = "No future launches are currently tracked."
        intent = "launches"
    elif any(word in message_normalised for word in ("incident", "catastrophe", "event")):
        if catastrophes:
            preview = ", ".join(
                _format_incident_summary(event) for event in catastrophes[:3]
            )
            reply = (
                f"There are {len(catastrophes)} incident record(s): {preview}."
            )
        else:
            reply = "No catastrophe or incident records are currently tracked."
        intent = "incidents"
    else:
        target_satellite = _find_target_satellite(state, message_normalised)

        if target_satellite:
            reply = _build_satellite_reply(target_satellite, conflicts)
            intent = "satellite"
        elif conflicts:
            top_conflict = conflicts[0]
            first_satellite, second_satellite = top_conflict["satellites"]
            reply = (
                f"I currently see {len(satellites)} satellite(s), "
                f"{len(launches)} launch(es), {len(catastrophes)} incident(s), "
                f"and {len(conflicts)} active conflict(s). The highest-priority "
                f"pair is {first_satellite.get('name', 'Unknown')} and "
                f"{second_satellite.get('name', 'Unknown')} at "
                f"{top_conflict['distance_km']} km."
            )
            intent = "summary"
        else:
            reply = (
                f"I currently see {len(satellites)} satellite(s), "
                f"{len(launches)} launch(es), and {len(catastrophes)} incident(s). "
                "Ask me about collision risk, busy regions, launches, or a "
                "satellite by name."
            )
            intent = "summary"

    return {
        "ok": True,
        "reply": reply,
        "intent": intent,
        "suggestions": DEFAULT_SUGGESTIONS,
        "context": _build_context_payload(state, conflicts),
        "source": "python-chatbot",
    }
def generate_chat_response(message, candidate_state):
    state = process_state(candidate_state)
    return _build_fallback_response(message, state)
