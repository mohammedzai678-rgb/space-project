import { detectConflicts, jsonResponse, processState } from "./state.js";

const DEFAULT_SUGGESTIONS = [
  "Show collision risk",
  "Which region is busiest?",
  "Summarise launches"
];
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function normaliseMessage(message) {
  if (typeof message !== "string") {
    return "";
  }

  return message.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildRegionCounts(satellites) {
  return satellites.reduce((counts, satellite) => {
    const region = satellite?.region || "Unknown";
    counts[region] = (counts[region] || 0) + 1;
    return counts;
  }, {});
}

function findTargetSatellite(state, message) {
  const satellites = state.satellites || [];
  if (!satellites.length) {
    return null;
  }

  if (message.includes("selected") || message.includes("current")) {
    const selected = satellites.find((satellite) => satellite.id === state.selectedSatelliteId);
    if (selected) {
      return selected;
    }
  }

  return satellites.find((satellite) => {
    const name = String(satellite?.name || "").toLowerCase();
    return name && message.includes(name);
  }) || null;
}

function formatLaunchSummary(launch) {
  return `${launch?.name || "Unnamed launch"} on ${launch?.launchDate || "an unknown date"} from ${launch?.launchSite || "an unknown site"}`;
}

function formatIncidentSummary(event) {
  return `${event?.name || "Unnamed incident"} on ${event?.date || "an unknown date"} (${event?.severity || "unknown"} severity)`;
}

function formatPythonFloat(value) {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

function buildSatelliteReply(targetSatellite, conflicts) {
  const relatedConflict = conflicts.find((conflict) =>
    conflict.satellites.some((satellite) => satellite?.id === targetSatellite.id)
  );

  const baseReply = `${targetSatellite.name || "Unknown satellite"} is in ${targetSatellite.region || "Unknown"} at ${targetSatellite.altitude || 0} km altitude, moving at ${targetSatellite.velocity || 0} km/s, with status ${targetSatellite.status || "Unknown"}.`;

  if (!relatedConflict) {
    return `${baseReply} No active conflict is currently attached to this satellite.`;
  }

  const partner = relatedConflict.satellites.find((satellite) => satellite?.id !== targetSatellite.id) || relatedConflict.satellites[0];
  return `${baseReply} Closest conflict is with ${partner?.name || "Unknown"} at ${formatPythonFloat(relatedConflict.distance_km)} km, and the recommended altitude adjustment is ${relatedConflict.recommended_altitude_adjustment_km} km.`;
}

function buildContextPayload(state, conflicts) {
  return {
    satelliteCount: state.satellites.length,
    conflictCount: conflicts.length,
    launchCount: state.launches.length,
    catastropheCount: state.catastrophes.length
  };
}

function buildFallbackResponse(message, state) {
  const messageNormalised = normaliseMessage(message);
  const satellites = state.satellites || [];
  const launches = state.launches || [];
  const catastrophes = state.catastrophes || [];
  const conflicts = detectConflicts(satellites);
  const regionCounts = buildRegionCounts(satellites);
  const busiestRegion = Object.entries(regionCounts).sort((left, right) => (
    right[1] - left[1] || left[0].localeCompare(right[0])
  ))[0];

  let reply = "";
  let intent = "summary";

  if (!messageNormalised || /(hello|hi|hey|help)/.test(messageNormalised)) {
    reply = "Mission assistant online. Gemini will answer when it is configured. Ask about collision risk, busiest regions, launches, incidents, or a satellite by name.";
    intent = "help";
  } else if (/(risk|collision|conflict|close|alert|danger)/.test(messageNormalised)) {
    if (conflicts.length) {
      const topConflict = conflicts[0];
      const [firstSatellite, secondSatellite] = topConflict.satellites;
      reply = `I found ${conflicts.length} active conflict(s). Highest priority is ${firstSatellite?.name || "Unknown"} versus ${secondSatellite?.name || "Unknown"} at ${formatPythonFloat(topConflict.distance_km)} km, with a suggested altitude adjustment of ${topConflict.recommended_altitude_adjustment_km} km.`;
    } else {
      reply = `There are no active collision conflicts. I currently see ${satellites.length} tracked satellite(s).`;
    }
    intent = "risk";
  } else if (/(region|corridor|busiest|crowded)/.test(messageNormalised)) {
    if (busiestRegion) {
      reply = `The busiest region is ${busiestRegion[0]} with ${busiestRegion[1]} tracked satellite(s).`;
    } else {
      reply = "No satellites are tracked yet, so there is no busiest region.";
    }
    intent = "regions";
  } else if (/(launch|future mission|queue)/.test(messageNormalised)) {
    if (launches.length) {
      reply = `There are ${launches.length} future launch(es) tracked: ${launches.slice(0, 3).map((launch) => formatLaunchSummary(launch)).join(", ")}.`;
    } else {
      reply = "No future launches are currently tracked.";
    }
    intent = "launches";
  } else if (/(incident|catastrophe|event)/.test(messageNormalised)) {
    if (catastrophes.length) {
      reply = `There are ${catastrophes.length} incident record(s): ${catastrophes.slice(0, 3).map((event) => formatIncidentSummary(event)).join(", ")}.`;
    } else {
      reply = "No catastrophe or incident records are currently tracked.";
    }
    intent = "incidents";
  } else {
    const targetSatellite = findTargetSatellite(state, messageNormalised);

    if (targetSatellite) {
      reply = buildSatelliteReply(targetSatellite, conflicts);
      intent = "satellite";
    } else if (conflicts.length) {
      const topConflict = conflicts[0];
      const [firstSatellite, secondSatellite] = topConflict.satellites;
      reply = `I currently see ${satellites.length} satellite(s), ${launches.length} launch(es), ${catastrophes.length} incident(s), and ${conflicts.length} active conflict(s). The highest-priority pair is ${firstSatellite?.name || "Unknown"} and ${secondSatellite?.name || "Unknown"} at ${formatPythonFloat(topConflict.distance_km)} km.`;
      intent = "summary";
    } else {
      reply = `I currently see ${satellites.length} satellite(s), ${launches.length} launch(es), and ${catastrophes.length} incident(s). Ask me about collision risk, busy regions, launches, or a satellite by name.`;
      intent = "summary";
    }
  }

  return {
    ok: true,
    reply,
    intent,
    suggestions: DEFAULT_SUGGESTIONS,
    context: buildContextPayload(state, conflicts),
    source: "gemini-fallback"
  };
}

function serialiseHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history.slice(-8).map((entry) => {
    const text = String(entry?.content || "").trim();
    if (!text) {
      return null;
    }

    return {
      role: entry?.role === "assistant" || entry?.role === "model" ? "model" : "user",
      parts: [{ text }]
    };
  }).filter(Boolean);
}

function buildStateSummary(state, conflicts) {
  const regions = buildRegionCounts(state.satellites || []);
  const regionLines = Object.entries(regions)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([region, count]) => `${region}: ${count}`)
    .join(", ") || "No active regions";

  let topConflictLine = "No active conflicts.";
  if (conflicts.length) {
    const [firstSatellite, secondSatellite] = conflicts[0].satellites;
    topConflictLine = `Top conflict: ${firstSatellite?.name || "Unknown"} vs ${secondSatellite?.name || "Unknown"} at ${formatPythonFloat(conflicts[0].distance_km)} km. Suggested altitude adjustment: ${conflicts[0].recommended_altitude_adjustment_km} km.`;
  }

  return [
    "You are the Gemini mission assistant for an orbital traffic dashboard.",
    "Answer only from the provided mission state.",
    "Be concise, specific, and operationally useful.",
    "If the data does not support something, say that clearly.",
    "Do not invent satellites, launches, incidents, or measurements.",
    "",
    `Selected satellite id: ${state.selectedSatelliteId || "None"}`,
    `Tracked satellites: ${state.satellites.length}`,
    `Future launches: ${state.launches.length}`,
    `Incidents: ${state.catastrophes.length}`,
    `Active conflicts: ${conflicts.length}`,
    `Region distribution: ${regionLines}`,
    topConflictLine
  ].join("\n");
}

function extractGeminiText(payload) {
  const candidate = payload?.candidates?.[0];
  if (!candidate) {
    return "";
  }

  return (candidate.content?.parts || [])
    .map((part) => part?.text || "")
    .join("\n")
    .trim();
}

async function generateGeminiResponse(message, state, history, env) {
  const apiKey = String(env?.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return null;
  }

  const model = String(env?.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL;
  const conflicts = detectConflicts(state.satellites || []);
  let response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
          "x-goog-api-client": "space-project-chatbot/1.0"
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: buildStateSummary(state, conflicts) }]
          },
          contents: [
            ...serialiseHistory(history),
            {
              role: "user",
              parts: [{ text: message }]
            }
          ],
          generation_config: {
            temperature: 0,
            max_output_tokens: 400
          }
        })
      }
    );
  } catch (error) {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    return null;
  }

  const text = extractGeminiText(payload);
  if (!text) {
    return null;
  }

  return {
    ok: true,
    reply: text,
    intent: "gemini",
    suggestions: DEFAULT_SUGGESTIONS,
    context: buildContextPayload(state, conflicts),
    source: "gemini-chatbot",
    model
  };
}

async function generateChatResponse(message, candidateState, history, env) {
  const state = processState(candidateState);
  const geminiResponse = await generateGeminiResponse(message, state, history, env);
  if (geminiResponse) {
    return geminiResponse;
  }

  return buildFallbackResponse(message, state);
}

export async function onRequest(context) {
  try {
    if (context.request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          Allow: "POST, OPTIONS"
        }
      });
    }

    if (context.request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          Allow: "POST, OPTIONS"
        }
      });
    }

    const payload = await context.request.json();
    return jsonResponse(
      await generateChatResponse(
        payload.message,
        payload.state,
        payload.history,
        context.env
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The chat API failed.";
    const status = /json/i.test(message) ? 400 : 500;
    return jsonResponse({ error: message }, status);
  }
}
