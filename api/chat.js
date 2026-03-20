import { GoogleGenAI } from "@google/genai";
import { buildFallbackChatResponse, createDefaultState, summarizeState } from "../shared/mission-core.js";
import { handleOptions, readJsonBody, sendJson } from "./_lib/http.js";
import { readMissionState } from "./_lib/store.js";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

function buildMissionPrompt(message, state) {
  const summary = summarizeState(state);
  const satellitePreview = state.satellites
    .slice(0, 6)
    .map((satellite) => `${satellite.name} in ${satellite.region}, ${satellite.altitude} km, ${satellite.status}`)
    .join("; ") || "No satellites tracked";
  const launchPreview = state.launches
    .slice(0, 4)
    .map((launch) => `${launch.name} on ${launch.launchDate} from ${launch.launchSite}`)
    .join("; ") || "No launches queued";
  const incidentPreview = state.catastrophes
    .slice(0, 4)
    .map((event) => `${event.name} on ${event.date} (${event.severity})`)
    .join("; ") || "No incidents logged";

  return [
    "You are the mission assistant for a shared orbital traffic operations dashboard.",
    "Answer only from the provided mission state and be concise, direct, and useful for operators.",
    "If the data does not support a claim, say that clearly.",
    "",
    `Mission summary: ${summary.satelliteCount} satellites, ${summary.launchCount} launches, ${summary.catastropheCount} incidents, ${summary.changeCount} change alerts.`,
    `Top risk: ${summary.topRisk}.`,
    `Top region: ${summary.topRegion}.`,
    `Tracked satellites: ${satellitePreview}.`,
    `Queued launches: ${launchPreview}.`,
    `Incident log: ${incidentPreview}.`,
    "",
    `User question: ${message}`
  ].join("\n");
}

export default async function handler(req, res) {
  if (handleOptions(req, res, ["POST", "OPTIONS"])) {
    return;
  }

  let message = "";
  let fallbackState = createDefaultState();

  try {
    if (req.method !== "POST") {
      sendJson(res, 405, {
        ok: false,
        error: "Method Not Allowed"
      }, {
        Allow: "POST, OPTIONS"
      });
      return;
    }

    const payload = await readJsonBody(req);
    message = String(payload.message || "").trim();

    if (!message) {
      sendJson(res, 400, {
        ok: false,
        error: "Message is required."
      });
      return;
    }

    const snapshot = await readMissionState();
    const currentState = snapshot.state;
    fallbackState = currentState;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      sendJson(res, 200, buildFallbackChatResponse(message, currentState));
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: buildMissionPrompt(message, currentState)
    });

    const reply = String(response.text || "").trim();
    if (!reply) {
      sendJson(res, 200, buildFallbackChatResponse(message, currentState));
      return;
    }

    sendJson(res, 200, {
      ok: true,
      reply,
      source: "gemini-google",
      model: DEFAULT_MODEL,
      suggestions: ["Show collision risk", "Which region is busiest?", "Summarise launches"]
    });
  } catch (error) {
    sendJson(res, 200, buildFallbackChatResponse(message, fallbackState));
  }
}
