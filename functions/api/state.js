const MAX_CHANGE_ALERTS = 25;

function createDefaultState() {
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

function normaliseState(candidate) {
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

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function methodNotAllowed() {
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

  return normaliseState({
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
  const state = normaliseState(candidate);
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

    if (context.request.method === "GET") {
      return jsonResponse(await readState(db));
    }

    if (context.request.method !== "PUT" && context.request.method !== "POST") {
      return methodNotAllowed();
    }

    const payload = await context.request.json();
    const state = await writeState(db, payload);
    return jsonResponse({
      ok: true,
      counts: {
        satellites: state.satellites.length,
        launches: state.launches.length,
        catastrophes: state.catastrophes.length,
        changeAlerts: state.changeAlerts.length
      }
    });
  } catch (error) {
    console.error("State API error", error);

    const message = error instanceof Error ? error.message : "The state API failed.";
    const status = /json/i.test(message) ? 400 : 500;
    return jsonResponse({ error: message }, status);
  }
}
