const MAX_CHANGE_ALERTS = 25;
const BACKEND_ALERT_SOURCE = "python-backend";
const EARTH_RADIUS_KM = 6371.0;
const HIGH_RISK_DISTANCE_KM = 75.0;
const MEDIUM_RISK_DISTANCE_KM = 180.0;
const SCHEMA_STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS satellites (id TEXT PRIMARY KEY, sort_index INTEGER NOT NULL, payload_json TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_satellites_sort_index ON satellites(sort_index)",
  "CREATE TABLE IF NOT EXISTS launches (id TEXT PRIMARY KEY, sort_index INTEGER NOT NULL, payload_json TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_launches_sort_index ON launches(sort_index)",
  "CREATE TABLE IF NOT EXISTS catastrophes (id TEXT PRIMARY KEY, sort_index INTEGER NOT NULL, payload_json TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_catastrophes_sort_index ON catastrophes(sort_index)",
  "CREATE TABLE IF NOT EXISTS change_alerts (id TEXT PRIMARY KEY, sort_index INTEGER NOT NULL, payload_json TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_change_alerts_sort_index ON change_alerts(sort_index)",
  "CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL)"
];

export function createDefaultState() {
  return {
    nextId: 1001,
    nextLaunchId: 1,
    nextCatastropheId: 1,
    selectedSatelliteId: null,
    satellites: [],
    launches: [],
    catastrophes: [],
    changeAlerts: [],
    theme: "dark"
  };
}

export function normaliseState(candidate) {
  const fallback = createDefaultState();
  if (!candidate || typeof candidate !== "object") {
    return fallback;
  }

  const satellites = Array.isArray(candidate.satellites) ? candidate.satellites : fallback.satellites;

  return {
    nextId: typeof candidate.nextId === "number" ? candidate.nextId : fallback.nextId,
    nextLaunchId: typeof candidate.nextLaunchId === "number" ? candidate.nextLaunchId : fallback.nextLaunchId,
    nextCatastropheId: typeof candidate.nextCatastropheId === "number" ? candidate.nextCatastropheId : fallback.nextCatastropheId,
    selectedSatelliteId: candidate.selectedSatelliteId || satellites[0]?.id || fallback.selectedSatelliteId,
    satellites,
    launches: Array.isArray(candidate.launches) ? candidate.launches : fallback.launches,
    catastrophes: Array.isArray(candidate.catastrophes) ? candidate.catastrophes : fallback.catastrophes,
    changeAlerts: Array.isArray(candidate.changeAlerts) ? candidate.changeAlerts.slice(0, MAX_CHANGE_ALERTS) : fallback.changeAlerts,
    theme: candidate.theme === "light" ? "light" : "dark"
  };
}

export function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export function methodNotAllowed() {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: {
      Allow: "GET, PUT, POST, OPTIONS"
    }
  });
}

function parseJsonValue(rawValue, fallbackValue) {
  try {
    return JSON.parse(rawValue);
  } catch (error) {
    return fallbackValue;
  }
}

function getNumber(satellite, fieldName) {
  const value = satellite?.[fieldName];
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function roundTo(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function formatPythonFloat(value) {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

function toCartesian(satellite) {
  const latitude = (getNumber(satellite, "latitude") * Math.PI) / 180;
  const longitude = (getNumber(satellite, "longitude") * Math.PI) / 180;
  const radius = EARTH_RADIUS_KM + getNumber(satellite, "altitude");

  return {
    x: radius * Math.cos(latitude) * Math.cos(longitude),
    y: radius * Math.cos(latitude) * Math.sin(longitude),
    z: radius * Math.sin(latitude)
  };
}

function distanceKm(firstSatellite, secondSatellite) {
  const firstPoint = toCartesian(firstSatellite);
  const secondPoint = toCartesian(secondSatellite);

  return Math.sqrt(
    (firstPoint.x - secondPoint.x) ** 2 +
    (firstPoint.y - secondPoint.y) ** 2 +
    (firstPoint.z - secondPoint.z) ** 2
  );
}

function classifyRisk(distance) {
  if (distance < HIGH_RISK_DISTANCE_KM) {
    return "high";
  }

  if (distance < MEDIUM_RISK_DISTANCE_KM) {
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

function analysePair(firstSatellite, secondSatellite) {
  const distance = distanceKm(firstSatellite, secondSatellite);
  const severity = classifyRisk(distance);
  const altitudeGap = Math.abs(
    getNumber(firstSatellite, "altitude") - getNumber(secondSatellite, "altitude")
  );
  const velocityGap = Math.abs(
    getNumber(firstSatellite, "velocity") - getNumber(secondSatellite, "velocity")
  );
  const inclinationGap = Math.abs(
    getNumber(firstSatellite, "inclination") - getNumber(secondSatellite, "inclination")
  );

  return {
    satellites: [firstSatellite, secondSatellite],
    distance_km: roundTo(distance),
    altitude_gap_km: roundTo(altitudeGap),
    velocity_gap_km_s: roundTo(velocityGap),
    inclination_gap_deg: roundTo(inclinationGap),
    severity,
    recommended_altitude_adjustment_km: recommendedAltitudeAdjustmentKm(severity, altitudeGap)
  };
}

export function detectConflicts(satellites) {
  const conflicts = [];

  satellites.forEach((firstSatellite, index) => {
    satellites.slice(index + 1).forEach((secondSatellite) => {
      const analysis = analysePair(firstSatellite, secondSatellite);
      if (analysis.severity !== "low") {
        conflicts.push(analysis);
      }
    });
  });

  conflicts.sort((left, right) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };

    return (
      severityOrder[left.severity] - severityOrder[right.severity] ||
      left.distance_km - right.distance_km ||
      left.altitude_gap_km - right.altitude_gap_km
    );
  });

  return conflicts;
}

function buildBackendAlert(conflict) {
  const [firstSatellite, secondSatellite] = conflict.satellites;
  const severity = conflict.severity;
  const pairKey = [
    String(firstSatellite?.id || firstSatellite?.name || "unknown-a"),
    String(secondSatellite?.id || secondSatellite?.name || "unknown-b")
  ].sort().join("::");

  return {
    id: `${BACKEND_ALERT_SOURCE}::${pairKey}`,
    satelliteId: firstSatellite?.id,
    satelliteName: firstSatellite?.name || "Unknown satellite",
    field: "Collision Risk",
    severity,
    title: severity === "high" ? "Critical Proximity" : "Traffic Advisory",
    message: `${firstSatellite?.name || "Unknown"} and ${secondSatellite?.name || "Unknown"} are ${formatPythonFloat(conflict.distance_km)} km apart. Suggested altitude adjustment: ${conflict.recommended_altitude_adjustment_km} km.`,
    timestamp: "Python backend analysis",
    source: BACKEND_ALERT_SOURCE
  };
}

function mergeChangeAlerts(existingAlerts, backendAlerts) {
  const preservedAlerts = existingAlerts.filter((alert) => alert?.source !== BACKEND_ALERT_SOURCE);
  return [...backendAlerts, ...preservedAlerts].slice(0, MAX_CHANGE_ALERTS);
}

export function processState(candidate) {
  const state = normaliseState(candidate);
  const conflicts = detectConflicts(state.satellites);
  const backendAlerts = conflicts.map((conflict) => buildBackendAlert(conflict));

  return {
    ...state,
    changeAlerts: mergeChangeAlerts(state.changeAlerts, backendAlerts),
    backendInsights: {
      engine: "python",
      conflictCount: backendAlerts.length
    }
  };
}

async function ensureSchema(db) {
  await db.batch(
    SCHEMA_STATEMENTS.map((statement) => db.prepare(statement))
  );
}

async function readCollection(db, tableName) {
  const result = await db.prepare(`SELECT payload_json FROM ${tableName} ORDER BY sort_index ASC`).all();

  return result.results
    .map((row) => parseJsonValue(row.payload_json, null))
    .filter(Boolean);
}

async function readState(db) {
  const satellites = await readCollection(db, "satellites");
  const launches = await readCollection(db, "launches");
  const catastrophes = await readCollection(db, "catastrophes");
  const changeAlerts = await readCollection(db, "change_alerts");
  const settingsResult = await db.prepare("SELECT key, value_json FROM app_settings").all();

  const settings = Object.fromEntries(
    settingsResult.results.map((row) => [row.key, parseJsonValue(row.value_json, null)])
  );

  return processState({
    nextId: settings.nextId,
    nextLaunchId: settings.nextLaunchId,
    nextCatastropheId: settings.nextCatastropheId,
    selectedSatelliteId: settings.selectedSatelliteId,
    satellites,
    launches,
    catastrophes,
    changeAlerts,
    theme: settings.theme
  });
}

function replaceCollectionStatements(db, tableName, items) {
  return [
    db.prepare(`DELETE FROM ${tableName}`),
    ...items.map((item, index) =>
      db.prepare(
        `INSERT INTO ${tableName} (id, sort_index, payload_json) VALUES (?, ?, ?)`
      ).bind(item.id, index, JSON.stringify(item))
    )
  ];
}

function replaceSettingsStatements(db, state) {
  const settings = [
    ["nextId", state.nextId],
    ["nextLaunchId", state.nextLaunchId],
    ["nextCatastropheId", state.nextCatastropheId],
    ["selectedSatelliteId", state.selectedSatelliteId],
    ["theme", state.theme]
  ];

  return [
    db.prepare("DELETE FROM app_settings"),
    ...settings.map(([key, value]) =>
      db.prepare("INSERT INTO app_settings (key, value_json) VALUES (?, ?)").bind(key, JSON.stringify(value))
    )
  ];
}

async function writeState(db, candidate) {
  const state = processState(candidate);
  const statements = [
    ...replaceCollectionStatements(db, "satellites", state.satellites),
    ...replaceCollectionStatements(db, "launches", state.launches),
    ...replaceCollectionStatements(db, "catastrophes", state.catastrophes),
    ...replaceCollectionStatements(db, "change_alerts", state.changeAlerts),
    ...replaceSettingsStatements(db, state)
  ];

  await db.batch(statements);
  return state;
}

export async function onRequest(context) {
  try {
    if (context.request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          Allow: "GET, PUT, POST, OPTIONS"
        }
      });
    }

    const db = context.env.SPACE_PROJECT_DB;
    if (!db) {
      return jsonResponse({ error: "The SPACE_PROJECT_DB binding is missing." }, 500);
    }

    await ensureSchema(db);

    if (context.request.method === "GET") {
      return jsonResponse(await readState(db));
    }

    if (context.request.method !== "PUT" && context.request.method !== "POST") {
      return methodNotAllowed();
    }

    const payload = await context.request.json();
    const state = await writeState(db, payload);
    return jsonResponse(state);
  } catch (error) {
    console.error("State API error", error);

    const message = error instanceof Error ? error.message : "The state API failed.";
    const status = /json/i.test(message) ? 400 : 500;
    return jsonResponse({ error: message }, status);
  }
}
