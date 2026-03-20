export const REGION_OPTIONS = [
  "North America",
  "South America",
  "Europe",
  "Africa",
  "Middle East",
  "South Asia",
  "East Asia",
  "Southeast Asia",
  "Central Asia",
  "Oceania",
  "Arctic",
  "Antarctica",
  "North Atlantic",
  "South Atlantic",
  "North Pacific",
  "South Pacific"
];

export const SATELLITE_STATUSES = [
  "Operational",
  "Monitoring",
  "Maintenance"
];

export const MISSION_OPTIONS = [
  "Communication",
  "Navigation",
  "Observation",
  "Defense"
];

export const CATASTROPHE_TYPES = [
  "Collision",
  "Debris Field",
  "Fragmentation",
  "Solar Storm",
  "Communication Loss",
  "Re-entry Hazard"
];

const EARTH_RADIUS_KM = 6371;
const MAX_CHANGE_ALERTS = 25;
const BACKEND_ALERT_SOURCE = "system-risk";

const WORLD_REGIONS = [
  { name: "North America", latMin: 15, latMax: 85, lonMin: -170, lonMax: -50 },
  { name: "South America", latMin: -60, latMax: 15, lonMin: -90, lonMax: -30 },
  { name: "Europe", latMin: 35, latMax: 72, lonMin: -25, lonMax: 45 },
  { name: "Africa", latMin: -35, latMax: 37, lonMin: -20, lonMax: 55 },
  { name: "Middle East", latMin: 12, latMax: 42, lonMin: 30, lonMax: 66 },
  { name: "South Asia", latMin: 5, latMax: 37, lonMin: 60, lonMax: 95 },
  { name: "East Asia", latMin: 18, latMax: 55, lonMin: 95, lonMax: 150 },
  { name: "Southeast Asia", latMin: -12, latMax: 22, lonMin: 94, lonMax: 141 },
  { name: "Central Asia", latMin: 35, latMax: 56, lonMin: 45, lonMax: 95 },
  { name: "Oceania", latMin: -50, latMax: 5, lonMin: 110, lonMax: 180 },
  { name: "Arctic", latMin: 72, latMax: 90, lonMin: -180, lonMax: 180 },
  { name: "Antarctica", latMin: -90, latMax: -60, lonMin: -180, lonMax: 180 }
];

function numberOr(value, fallback = 0) {
  const candidate = Number(value);
  return Number.isFinite(candidate) ? candidate : fallback;
}

function stringOr(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function roundTo(value, digits = 2) {
  return Number(Number(value).toFixed(digits));
}

function getIsoDateOffset(daysFromToday) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

function formatPythonFloat(value) {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createDefaultState() {
  const satellites = [
    {
      id: "SAT-1001",
      name: "Aurora Net-7",
      operator: "Orbital Dynamics",
      latitude: 12.5,
      longitude: 78.3,
      altitude: 540,
      velocity: 7.65,
      status: "Operational",
      inclination: 53.2,
      mission: "Communication"
    },
    {
      id: "SAT-1002",
      name: "Horizon Watch-2",
      operator: "Orbital Dynamics",
      latitude: 12.88,
      longitude: 78.94,
      altitude: 548,
      velocity: 7.63,
      status: "Monitoring",
      inclination: 53.6,
      mission: "Observation"
    },
    {
      id: "SAT-1003",
      name: "Sentinel Mesh-1",
      operator: "Celestial Defense",
      latitude: 25.2,
      longitude: 55.27,
      altitude: 560,
      velocity: 7.58,
      status: "Operational",
      inclination: 97.4,
      mission: "Defense"
    },
    {
      id: "SAT-1004",
      name: "Polaris Relay-9",
      operator: "Atlas Comms",
      latitude: 37.77,
      longitude: -122.42,
      altitude: 535,
      velocity: 7.67,
      status: "Maintenance",
      inclination: 51.9,
      mission: "Navigation"
    }
  ];

  return {
    nextId: 1005,
    nextLaunchId: 3,
    nextCatastropheId: 2,
    selectedSatelliteId: "SAT-1001",
    satellites: satellites.map((satellite) => ({
      ...satellite,
      region: getWorldRegion(satellite.latitude, satellite.longitude)
    })),
    launches: [
      {
        id: "LAUNCH-1",
        name: "Aurora Net-8",
        operator: "Orbital Dynamics",
        launchDate: getIsoDateOffset(9),
        launchSite: "Satish Dhawan Space Centre",
        region: "South Asia",
        mission: "Communication"
      },
      {
        id: "LAUNCH-2",
        name: "Sentinel Mesh-2",
        operator: "Celestial Defense",
        launchDate: getIsoDateOffset(21),
        launchSite: "Cape Canaveral",
        region: "North America",
        mission: "Defense"
      }
    ],
    catastrophes: [
      {
        id: "EVENT-1",
        name: "Debris Fragmentation Watch",
        date: getIsoDateOffset(-4),
        type: "Debris Field",
        severity: "medium",
        notes: "A fragmented object cluster is being tracked near the South Asia corridor."
      }
    ],
    changeAlerts: [],
    theme: "dark"
  };
}

export function generateSatelliteId(state) {
  const id = `SAT-${state.nextId}`;
  state.nextId += 1;
  return id;
}

export function generateLaunchId(state) {
  const id = `LAUNCH-${state.nextLaunchId}`;
  state.nextLaunchId += 1;
  return id;
}

export function generateCatastropheId(state) {
  const id = `EVENT-${state.nextCatastropheId}`;
  state.nextCatastropheId += 1;
  return id;
}

export function getWorldRegion(latitude, longitude) {
  const region = WORLD_REGIONS.find((candidate) =>
    latitude >= candidate.latMin &&
    latitude < candidate.latMax &&
    longitude >= candidate.lonMin &&
    longitude < candidate.lonMax
  );

  if (region) {
    return region.name;
  }

  if (latitude >= 0) {
    return longitude < 0 ? "North Atlantic" : "North Pacific";
  }

  return longitude < 20 ? "South Atlantic" : "South Pacific";
}

function normaliseSatellite(satellite) {
  const latitude = numberOr(satellite?.latitude);
  const longitude = numberOr(satellite?.longitude);
  return {
    id: stringOr(satellite?.id, ""),
    name: stringOr(satellite?.name, "Unnamed satellite"),
    operator: stringOr(satellite?.operator, "Unknown operator"),
    latitude,
    longitude,
    altitude: numberOr(satellite?.altitude),
    velocity: numberOr(satellite?.velocity),
    region: getWorldRegion(latitude, longitude),
    status: SATELLITE_STATUSES.includes(satellite?.status) ? satellite.status : SATELLITE_STATUSES[0],
    inclination: numberOr(satellite?.inclination),
    mission: MISSION_OPTIONS.includes(satellite?.mission) ? satellite.mission : MISSION_OPTIONS[0]
  };
}

function normaliseLaunch(launch) {
  return {
    id: stringOr(launch?.id, ""),
    name: stringOr(launch?.name, "Unnamed launch"),
    operator: stringOr(launch?.operator, "Unknown operator"),
    launchDate: stringOr(launch?.launchDate, ""),
    launchSite: stringOr(launch?.launchSite, "Unknown launch site"),
    region: REGION_OPTIONS.includes(launch?.region) ? launch.region : "North Atlantic",
    mission: MISSION_OPTIONS.includes(launch?.mission) ? launch.mission : MISSION_OPTIONS[0]
  };
}

function normaliseCatastrophe(event) {
  return {
    id: stringOr(event?.id, ""),
    name: stringOr(event?.name, "Unnamed incident"),
    date: stringOr(event?.date, ""),
    type: CATASTROPHE_TYPES.includes(event?.type) ? event.type : CATASTROPHE_TYPES[0],
    severity: ["high", "medium", "low"].includes(event?.severity) ? event.severity : "medium",
    notes: stringOr(event?.notes, "No notes recorded.")
  };
}

function normaliseAlert(alert) {
  return {
    id: stringOr(alert?.id, ""),
    satelliteId: stringOr(alert?.satelliteId, ""),
    satelliteName: stringOr(alert?.satelliteName, "Unknown satellite"),
    field: stringOr(alert?.field, "update"),
    severity: ["high", "medium", "low"].includes(alert?.severity) ? alert.severity : "medium",
    title: stringOr(alert?.title, "Mission update"),
    message: stringOr(alert?.message, "A mission update was recorded."),
    timestamp: stringOr(alert?.timestamp, "Unknown time"),
    source: stringOr(alert?.source, "manual")
  };
}

export function normaliseState(candidate) {
  const fallback = createDefaultState();
  if (!candidate || typeof candidate !== "object") {
    return fallback;
  }

  const satellites = Array.isArray(candidate.satellites)
    ? candidate.satellites.map(normaliseSatellite).filter((item) => item.id || item.name)
    : [];

  const launches = Array.isArray(candidate.launches)
    ? candidate.launches.map(normaliseLaunch).filter((item) => item.id || item.name)
    : [];

  const catastrophes = Array.isArray(candidate.catastrophes)
    ? candidate.catastrophes.map(normaliseCatastrophe).filter((item) => item.id || item.name)
    : [];

  const changeAlerts = Array.isArray(candidate.changeAlerts)
    ? candidate.changeAlerts.map(normaliseAlert).slice(0, MAX_CHANGE_ALERTS)
    : [];

  return {
    nextId: numberOr(candidate.nextId, fallback.nextId),
    nextLaunchId: numberOr(candidate.nextLaunchId, fallback.nextLaunchId),
    nextCatastropheId: numberOr(candidate.nextCatastropheId, fallback.nextCatastropheId),
    selectedSatelliteId: stringOr(candidate.selectedSatelliteId, satellites[0]?.id || null),
    satellites,
    launches,
    catastrophes,
    changeAlerts,
    theme: candidate.theme === "light" ? "light" : "dark"
  };
}

export function toCartesian(satellite) {
  const latitude = (numberOr(satellite.latitude) * Math.PI) / 180;
  const longitude = (numberOr(satellite.longitude) * Math.PI) / 180;
  const radius = EARTH_RADIUS_KM + numberOr(satellite.altitude);

  return {
    x: radius * Math.cos(latitude) * Math.cos(longitude),
    y: radius * Math.cos(latitude) * Math.sin(longitude),
    z: radius * Math.sin(latitude)
  };
}

export function getDistanceKm(firstSatellite, secondSatellite) {
  const firstPoint = toCartesian(firstSatellite);
  const secondPoint = toCartesian(secondSatellite);

  return Math.sqrt(
    (firstPoint.x - secondPoint.x) ** 2 +
    (firstPoint.y - secondPoint.y) ** 2 +
    (firstPoint.z - secondPoint.z) ** 2
  );
}

function classifyConflictSeverity(distance) {
  if (distance < 75) {
    return "high";
  }

  if (distance < 180) {
    return "medium";
  }

  return "low";
}

function recommendedAltitudeAdjustmentKm(severity, altitudeGap) {
  if (severity === "high") {
    return Math.max(5, Math.round((20 - Math.min(altitudeGap, 20)) / 2));
  }

  if (severity === "medium") {
    return 2;
  }

  return 0;
}

export function detectConflicts(satellites) {
  const conflicts = [];

  satellites.forEach((firstSatellite, index) => {
    satellites.slice(index + 1).forEach((secondSatellite) => {
      const distance = roundTo(getDistanceKm(firstSatellite, secondSatellite));
      const altitudeGap = roundTo(Math.abs(firstSatellite.altitude - secondSatellite.altitude));
      const velocityGap = roundTo(Math.abs(firstSatellite.velocity - secondSatellite.velocity));
      const inclinationGap = roundTo(Math.abs(firstSatellite.inclination - secondSatellite.inclination));
      const severity = classifyConflictSeverity(distance);

      if (severity === "low") {
        return;
      }

      conflicts.push({
        satellites: [firstSatellite, secondSatellite],
        distance_km: distance,
        altitude_gap_km: altitudeGap,
        velocity_gap_km_s: velocityGap,
        inclination_gap_deg: inclinationGap,
        severity,
        recommended_altitude_adjustment_km: recommendedAltitudeAdjustmentKm(severity, altitudeGap)
      });
    });
  });

  return conflicts.sort((left, right) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return (
      severityOrder[left.severity] - severityOrder[right.severity] ||
      left.distance_km - right.distance_km ||
      left.altitude_gap_km - right.altitude_gap_km
    );
  });
}

function buildBackendAlert(conflict) {
  const [firstSatellite, secondSatellite] = conflict.satellites;
  const pairKey = [firstSatellite.id, secondSatellite.id].sort().join("::");

  return {
    id: `${BACKEND_ALERT_SOURCE}::${pairKey}`,
    satelliteId: firstSatellite.id,
    satelliteName: firstSatellite.name,
    field: "Collision Risk",
    severity: conflict.severity,
    title: conflict.severity === "high" ? "Critical Proximity" : "Traffic Advisory",
    message: `${firstSatellite.name} and ${secondSatellite.name} are ${formatPythonFloat(conflict.distance_km)} km apart. Suggested altitude adjustment: ${conflict.recommended_altitude_adjustment_km} km.`,
    timestamp: "Automated analysis",
    source: BACKEND_ALERT_SOURCE
  };
}

function mergeChangeAlerts(existingAlerts, backendAlerts) {
  const preservedAlerts = existingAlerts.filter((alert) => alert.source !== BACKEND_ALERT_SOURCE);
  return [...backendAlerts, ...preservedAlerts].slice(0, MAX_CHANGE_ALERTS);
}

export function processState(candidate) {
  const state = normaliseState(candidate);
  const conflicts = detectConflicts(state.satellites);
  const backendAlerts = conflicts.map(buildBackendAlert);

  return {
    ...state,
    changeAlerts: mergeChangeAlerts(state.changeAlerts, backendAlerts),
    backendInsights: {
      engine: "neon-shared",
      conflictCount: conflicts.length
    }
  };
}

export function getClosestSatellites(state) {
  return state.satellites.map((satellite) => {
    const neighbors = state.satellites
      .filter((candidate) => candidate.id !== satellite.id)
      .map((candidate) => ({
        target: candidate,
        distance: getDistanceKm(satellite, candidate),
        altitudeGap: Math.abs(satellite.altitude - candidate.altitude),
        inclinationGap: Math.abs(satellite.inclination - candidate.inclination),
        velocityGap: Math.abs(satellite.velocity - candidate.velocity)
      }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 3);

    return { satellite, neighbors };
  });
}

export function analyseRegions(state) {
  const regionMap = new Map();

  state.satellites.forEach((satellite) => {
    if (!regionMap.has(satellite.region)) {
      regionMap.set(satellite.region, []);
    }

    regionMap.get(satellite.region).push(satellite);
  });

  return Array.from(regionMap.entries()).map(([region, satellites]) => {
    const altitudes = satellites.map((item) => item.altitude);
    const velocities = satellites.map((item) => item.velocity);
    const inclinations = satellites.map((item) => item.inclination);
    const altitudeSpread = Math.max(...altitudes) - Math.min(...altitudes);
    const velocitySpread = Math.max(...velocities) - Math.min(...velocities);
    const inclinationSpread = Math.max(...inclinations) - Math.min(...inclinations);
    const nonOperationalCount = satellites.filter((item) => item.status !== "Operational").length;
    const crowded = satellites.length >= 3 || altitudeSpread < 40 || inclinationSpread < 3;

    const reasons = [];
    if (satellites.length >= 3) reasons.push(`${satellites.length} satellites share this corridor`);
    if (altitudeSpread < 40) reasons.push(`altitude separation is only ${altitudeSpread.toFixed(0)} km`);
    if (inclinationSpread < 3) reasons.push(`orbital inclination spread is only ${inclinationSpread.toFixed(1)} deg`);
    if (velocitySpread < 0.12) reasons.push(`velocity band is tightly packed at ${velocitySpread.toFixed(2)} km/s spread`);
    if (nonOperationalCount > 0) reasons.push(`${nonOperationalCount} satellite(s) need monitoring or maintenance`);

    const pressureScore = Math.min(
      100,
      satellites.length * 18 +
      Math.max(0, 30 - altitudeSpread) +
      Math.max(0, 12 - inclinationSpread * 3) +
      nonOperationalCount * 8
    );

    return {
      region,
      count: satellites.length,
      crowded,
      reasons: reasons.length ? reasons : ["traffic is currently distributed safely"],
      pressureScore,
      satellites
    };
  }).sort((left, right) => right.pressureScore - left.pressureScore);
}

function classifyRisk(score) {
  if (score >= 75) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

function calculateRisk(satellite, regionInsight, nearest) {
  const distance = nearest?.distance ?? 99999;
  const altitudeGap = nearest?.altitudeGap ?? 999;
  const inclinationGap = nearest?.inclinationGap ?? 180;
  const velocityGap = nearest?.velocityGap ?? 10;

  let score = 8;
  const signals = [];

  if (distance < 700) {
    score += 42;
    signals.push("critical proximity to nearest satellite");
  } else if (distance < 1400) {
    score += 28;
    signals.push("close orbital approach detected");
  } else if (distance < 2400) {
    score += 14;
  }

  if (altitudeGap < 18) {
    score += 18;
    signals.push("very low altitude separation");
  } else if (altitudeGap < 40) {
    score += 10;
  }

  if (inclinationGap < 1.6) {
    score += 14;
    signals.push("nearly matching orbital inclination");
  } else if (inclinationGap < 4) {
    score += 8;
  }

  if (velocityGap < 0.06) {
    score += 10;
    signals.push("similar relative velocity increases conflict window");
  }

  if (regionInsight?.pressureScore > 70) {
    score += 14;
    signals.push("regional traffic pressure is elevated");
  } else if ((regionInsight?.pressureScore || 0) > 45) {
    score += 8;
  }

  if (satellite.status !== "Operational") {
    score += 10;
    signals.push("satellite is not in full operational state");
  }

  if (satellite.mission === "Defense") score += 4;
  if (satellite.mission === "Observation") score += 2;

  return {
    score: Math.min(100, Math.round(score)),
    level: classifyRisk(score),
    signals: signals.length ? signals : ["normal separation envelope"]
  };
}

export function buildAnalysis(candidateState) {
  const state = processState(candidateState);
  const closest = getClosestSatellites(state);
  const regions = analyseRegions(state);

  const riskEntries = closest.map((item) => {
    const regionInsight = regions.find((region) => region.region === item.satellite.region);
    const nearest = item.neighbors[0] || null;
    const risk = calculateRisk(item.satellite, regionInsight, nearest);

    return {
      satellite: item.satellite,
      neighbors: item.neighbors,
      nearest,
      nearestDistance: nearest ? nearest.distance : null,
      regionInsight,
      risk
    };
  }).sort((left, right) => right.risk.score - left.risk.score);

  const selectedEntry = riskEntries.find((entry) => entry.satellite.id === state.selectedSatelliteId) || riskEntries[0] || null;

  return {
    state,
    closest,
    regions,
    riskEntries,
    selectedEntry
  };
}

export function formatChangeValue(key, value) {
  if (["latitude", "longitude", "velocity", "inclination"].includes(key)) {
    return Number(value).toFixed(2);
  }

  if (key === "altitude") {
    return `${value} km`;
  }

  return String(value);
}

export function collectSatelliteChanges(existingSatellite, submittedSatellite) {
  const fields = [
    { key: "operator", label: "operator" },
    { key: "latitude", label: "latitude" },
    { key: "longitude", label: "longitude" },
    { key: "altitude", label: "altitude" },
    { key: "velocity", label: "velocity" },
    { key: "region", label: "region" },
    { key: "status", label: "status" },
    { key: "inclination", label: "inclination" },
    { key: "mission", label: "mission" }
  ];

  const changedFields = fields.filter(({ key }) => existingSatellite[key] !== submittedSatellite[key]);
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return changedFields.map(({ key, label }) => ({
    id: `${existingSatellite.id}-${key}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    satelliteId: existingSatellite.id,
    satelliteName: existingSatellite.name,
    field: key,
    severity: key === "altitude" || key === "status" ? "high" : "medium",
    title: `${existingSatellite.name} ${label} changed`,
    message: `${label} changed from ${formatChangeValue(key, existingSatellite[key])} to ${formatChangeValue(key, submittedSatellite[key])}.`,
    timestamp,
    source: "manual"
  }));
}

export function mergeManualAlerts(existingAlerts, newAlerts) {
  const backendAlerts = existingAlerts.filter((alert) => alert.source === BACKEND_ALERT_SOURCE);
  const manualAlerts = existingAlerts.filter((alert) => alert.source !== BACKEND_ALERT_SOURCE);
  return [...newAlerts, ...manualAlerts, ...backendAlerts].slice(0, MAX_CHANGE_ALERTS);
}

export function getLaunchCountdown(dateString) {
  const target = new Date(`${dateString}T00:00:00`);
  const now = new Date();
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));

  if (!Number.isFinite(diff)) return "Unknown schedule";
  if (diff > 1) return `${diff} days remaining`;
  if (diff === 1) return "Launches tomorrow";
  if (diff === 0) return "Launches today";
  return `${Math.abs(diff)} days overdue`;
}

export function buildRecentEvents(state, analysis) {
  const items = [];

  state.catastrophes
    .slice()
    .sort((left, right) => new Date(right.date) - new Date(left.date))
    .slice(0, 2)
    .forEach((event) => {
      items.push({
        kind: "Incident",
        level: event.severity,
        title: event.name,
        meta: event.date,
        text: `${event.type}. ${event.notes}`
      });
    });

  analysis.riskEntries.slice(0, 2).forEach((entry) => {
    items.push({
      kind: "Live Alert",
      level: entry.risk.level.toLowerCase(),
      title: `${entry.satellite.name} risk ${entry.risk.score}/100`,
      meta: "Now",
      text: `${entry.risk.signals[0]}. Nearest object at ${entry.nearestDistance ? entry.nearestDistance.toFixed(0) : "N/A"} km.`
    });
  });

  state.launches
    .slice()
    .sort((left, right) => new Date(left.launchDate) - new Date(right.launchDate))
    .slice(0, 2)
    .forEach((launch) => {
      items.push({
        kind: "Launch",
        level: "low",
        title: `${launch.name} scheduled`,
        meta: getLaunchCountdown(launch.launchDate),
        text: `${launch.launchDate} from ${launch.launchSite} for a ${launch.mission.toLowerCase()} mission in ${launch.region}.`
      });
    });

  return items.slice(0, 6);
}

export function summarizeState(state) {
  const analysis = buildAnalysis(state);
  const topRisk = analysis.riskEntries[0];
  const topRegion = analysis.regions[0];

  return {
    satelliteCount: state.satellites.length,
    launchCount: state.launches.length,
    catastropheCount: state.catastrophes.length,
    changeCount: state.changeAlerts.length,
    topRisk: topRisk
      ? `${topRisk.satellite.name} at ${topRisk.risk.score}/100`
      : "No active collision pressure",
    topRegion: topRegion
      ? `${topRegion.region} at ${topRegion.pressureScore}/100`
      : "No active region pressure"
  };
}

export function buildFallbackChatResponse(message, candidateState) {
  const state = processState(candidateState);
  const analysis = buildAnalysis(state);
  const prompt = String(message || "").trim().toLowerCase();
  const topRisk = analysis.riskEntries[0];
  const topRegion = analysis.regions[0];

  if (!prompt || /(hello|hi|hey|help)/.test(prompt)) {
    return {
      ok: true,
      reply: "Mission assistant online. Ask about collision risk, busiest regions, launches, incidents, or a satellite by name.",
      source: "fallback-assistant",
      suggestions: ["Show collision risk", "Which region is busiest?", "Summarise launches"]
    };
  }

  if (/(risk|collision|conflict|danger|close)/.test(prompt)) {
    if (!topRisk) {
      return {
        ok: true,
        reply: "No active collision conflicts are detected right now.",
        source: "fallback-assistant",
        suggestions: ["Summarise launches", "Show incidents", "How many satellites are active?"]
      };
    }

    const nearestLabel = topRisk.nearest
      ? `${topRisk.nearest.target.name} at ${topRisk.nearest.distance.toFixed(0)} km`
      : "no nearby object";

    return {
      ok: true,
      reply: `${topRisk.satellite.name} is the highest-priority watch item at ${topRisk.risk.score}/100. Main signal: ${topRisk.risk.signals[0]}. Nearest object: ${nearestLabel}.`,
      source: "fallback-assistant",
      suggestions: ["Show busiest region", "Summarise launches", "List incidents"]
    };
  }

  if (/(region|corridor|busiest|crowded)/.test(prompt)) {
    return {
      ok: true,
      reply: topRegion
        ? `${topRegion.region} is currently the busiest region with ${topRegion.count} satellite(s) and pressure ${topRegion.pressureScore}/100.`
        : "No region pressure has been recorded yet because there are no tracked satellites.",
      source: "fallback-assistant",
      suggestions: ["Show collision risk", "Summarise launches", "How many satellites are active?"]
    };
  }

  if (/(launch|future mission|queue)/.test(prompt)) {
    if (!state.launches.length) {
      return {
        ok: true,
        reply: "No future launches are currently queued.",
        source: "fallback-assistant",
        suggestions: ["Show incidents", "Show collision risk", "Which region is busiest?"]
      };
    }

    const preview = state.launches
      .slice()
      .sort((left, right) => new Date(left.launchDate) - new Date(right.launchDate))
      .slice(0, 3)
      .map((launch) => `${launch.name} on ${launch.launchDate} from ${launch.launchSite}`)
      .join(", ");

    return {
      ok: true,
      reply: `There are ${state.launches.length} future launch(es) tracked: ${preview}.`,
      source: "fallback-assistant",
      suggestions: ["Show incidents", "Show collision risk", "How many satellites are active?"]
    };
  }

  if (/(incident|catastrophe|event)/.test(prompt)) {
    if (!state.catastrophes.length) {
      return {
        ok: true,
        reply: "No catastrophe or incident records are currently tracked.",
        source: "fallback-assistant",
        suggestions: ["Summarise launches", "Show collision risk", "Which region is busiest?"]
      };
    }

    const preview = state.catastrophes
      .slice()
      .sort((left, right) => new Date(right.date) - new Date(left.date))
      .slice(0, 3)
      .map((event) => `${event.name} on ${event.date} (${event.severity} severity)`)
      .join(", ");

    return {
      ok: true,
      reply: `There are ${state.catastrophes.length} incident record(s): ${preview}.`,
      source: "fallback-assistant",
      suggestions: ["Show collision risk", "Summarise launches", "Which region is busiest?"]
    };
  }

  const matchedSatellite = state.satellites.find((satellite) =>
    new RegExp(`\\b${escapeRegExp(satellite.name.toLowerCase())}\\b`).test(prompt)
  );

  if (matchedSatellite) {
    const matchedRisk = analysis.riskEntries.find((entry) => entry.satellite.id === matchedSatellite.id);
    return {
      ok: true,
      reply: `${matchedSatellite.name} is in ${matchedSatellite.region} at ${matchedSatellite.altitude} km altitude, moving at ${matchedSatellite.velocity} km/s, with status ${matchedSatellite.status}. ${matchedRisk ? `Risk level is ${matchedRisk.risk.level} at ${matchedRisk.risk.score}/100.` : "No elevated risk is currently attached to this satellite."}`,
      source: "fallback-assistant",
      suggestions: ["Show collision risk", "Which region is busiest?", "Summarise launches"]
    };
  }

  const summary = summarizeState(state);
  return {
    ok: true,
    reply: `The mission currently tracks ${summary.satelliteCount} satellite(s), ${summary.launchCount} future launch(es), and ${summary.catastropheCount} incident(s). Top risk: ${summary.topRisk}. Top region: ${summary.topRegion}.`,
    source: "fallback-assistant",
    suggestions: ["Show collision risk", "Which region is busiest?", "Summarise launches"]
  };
}
