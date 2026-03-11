import math

EARTH_RADIUS_KM = 6371.0
HIGH_RISK_DISTANCE_KM = 75.0
MEDIUM_RISK_DISTANCE_KM = 180.0


def _get_number(satellite, field_name):
    value = satellite.get(field_name, 0)
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def to_cartesian(satellite):
    latitude = math.radians(_get_number(satellite, "latitude"))
    longitude = math.radians(_get_number(satellite, "longitude"))
    radius = EARTH_RADIUS_KM + _get_number(satellite, "altitude")

    return (
        radius * math.cos(latitude) * math.cos(longitude),
        radius * math.cos(latitude) * math.sin(longitude),
        radius * math.sin(latitude),
    )


def distance_km(first_satellite, second_satellite):
    first_x, first_y, first_z = to_cartesian(first_satellite)
    second_x, second_y, second_z = to_cartesian(second_satellite)

    return math.sqrt(
        (first_x - second_x) ** 2
        + (first_y - second_y) ** 2
        + (first_z - second_z) ** 2
    )


def classify_risk(distance):
    if distance < HIGH_RISK_DISTANCE_KM:
        return "high"

    if distance < MEDIUM_RISK_DISTANCE_KM:
        return "medium"

    return "low"


def recommended_altitude_adjustment_km(severity, altitude_gap):
    if severity == "high":
        return max(5, round((20 - min(altitude_gap, 20)) / 2))

    if severity == "medium":
        return 2

    return 0


def analyse_pair(first_satellite, second_satellite):
    distance = distance_km(first_satellite, second_satellite)
    severity = classify_risk(distance)
    altitude_gap = abs(
        _get_number(first_satellite, "altitude")
        - _get_number(second_satellite, "altitude")
    )
    velocity_gap = abs(
        _get_number(first_satellite, "velocity")
        - _get_number(second_satellite, "velocity")
    )
    inclination_gap = abs(
        _get_number(first_satellite, "inclination")
        - _get_number(second_satellite, "inclination")
    )

    return {
        "satellites": [first_satellite, second_satellite],
        "distance_km": round(distance, 2),
        "altitude_gap_km": round(altitude_gap, 2),
        "velocity_gap_km_s": round(velocity_gap, 2),
        "inclination_gap_deg": round(inclination_gap, 2),
        "severity": severity,
        "recommended_altitude_adjustment_km": recommended_altitude_adjustment_km(
            severity,
            altitude_gap,
        ),
    }


def detect_conflicts(satellites):
    conflicts = []

    for index, first_satellite in enumerate(satellites):
        for second_satellite in satellites[index + 1:]:
            analysis = analyse_pair(first_satellite, second_satellite)
            if analysis["severity"] != "low":
                conflicts.append(analysis)

    conflicts.sort(
        key=lambda item: (
            0 if item["severity"] == "high" else 1,
            item["distance_km"],
            item["altitude_gap_km"],
        )
    )
    return conflicts
