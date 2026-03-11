import json
import os
import urllib.error
import urllib.request

from optimizer import detect_conflicts
from traffic_engine import process_state

DEFAULT_SUGGESTIONS = [
    "Show collision risk",
    "Which region is busiest?",
    "Summarise launches",
]
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_API_URL_TEMPLATE = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:generateContent"
)


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
            "Mission assistant online. Gemini will answer when it is configured. "
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
        "source": "gemini-fallback",
    }


def _serialise_history(history):
    if not isinstance(history, list):
        return []

    contents = []
    for entry in history[-8:]:
        if not isinstance(entry, dict):
            continue

        text = str(entry.get("content", "")).strip()
        if not text:
            continue

        role = entry.get("role")
        model_role = "model" if role in ("assistant", "model") else "user"
        contents.append({
            "role": model_role,
            "parts": [{"text": text}],
        })

    return contents


def _build_state_summary(state, conflicts):
    satellites = state.get("satellites", [])
    launches = state.get("launches", [])
    catastrophes = state.get("catastrophes", [])
    regions = _build_region_counts(satellites)
    region_lines = ", ".join(
        f"{region}: {count}" for region, count in sorted(regions.items(), key=lambda item: (-item[1], item[0]))[:6]
    ) or "No active regions"
    selected_id = state.get("selectedSatelliteId") or "None"

    top_conflict_line = "No active conflicts."
    if conflicts:
        top_conflict = conflicts[0]
        first_satellite, second_satellite = top_conflict["satellites"]
        top_conflict_line = (
            f"Top conflict: {first_satellite.get('name', 'Unknown')} vs "
            f"{second_satellite.get('name', 'Unknown')} at "
            f"{top_conflict['distance_km']} km. Suggested altitude adjustment: "
            f"{top_conflict['recommended_altitude_adjustment_km']} km."
        )

    return (
        "You are the Gemini mission assistant for an orbital traffic dashboard. "
        "Answer only from the provided mission state. Be concise, specific, and "
        "operationally useful. If the data does not support something, say that "
        "clearly. Do not invent satellites, launches, incidents, or measurements.\n\n"
        f"Selected satellite id: {selected_id}\n"
        f"Tracked satellites: {len(satellites)}\n"
        f"Future launches: {len(launches)}\n"
        f"Incidents: {len(catastrophes)}\n"
        f"Active conflicts: {len(conflicts)}\n"
        f"Region distribution: {region_lines}\n"
        f"{top_conflict_line}"
    )


def _extract_gemini_text(payload):
    candidates = payload.get("candidates", [])
    if not candidates:
        return ""

    parts = candidates[0].get("content", {}).get("parts", [])
    text_parts = [part.get("text", "").strip() for part in parts if part.get("text")]
    return "\n".join(text_parts).strip()


def _generate_gemini_response(message, state, history):
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    model = os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL).strip() or DEFAULT_GEMINI_MODEL
    conflicts = detect_conflicts(state.get("satellites", []))
    request_payload = {
        "system_instruction": {
            "parts": [{"text": _build_state_summary(state, conflicts)}]
        },
        "contents": _serialise_history(history) + [{
            "role": "user",
            "parts": [{"text": message}],
        }],
        "generation_config": {
            "temperature": 0,
            "max_output_tokens": 400,
        },
    }
    request_data = json.dumps(request_payload).encode("utf-8")
    request = urllib.request.Request(
        GEMINI_API_URL_TEMPLATE.format(model=model),
        data=request_data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
            "x-goog-api-client": "space-project-chatbot/1.0",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (
        OSError,
        urllib.error.URLError,
        urllib.error.HTTPError,
        json.JSONDecodeError,
    ):
        return None

    text = _extract_gemini_text(payload)
    if not text:
        return None

    return {
        "ok": True,
        "reply": text,
        "intent": "gemini",
        "suggestions": DEFAULT_SUGGESTIONS,
        "context": _build_context_payload(state, conflicts),
        "source": "gemini-chatbot",
        "model": model,
    }


def generate_chat_response(message, candidate_state, history=None):
    state = process_state(candidate_state)
    gemini_response = _generate_gemini_response(message, state, history or [])
    if gemini_response:
        return gemini_response

    return _build_fallback_response(message, state)
