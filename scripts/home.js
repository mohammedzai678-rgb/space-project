import { buildAnalysis } from "../shared/mission-core.js";
import { getState, startPolling } from "./shared/client-api.js";
import { setTheme } from "./shared/dom.js";

const elements = {
  total: document.getElementById("metric-total"),
  crowded: document.getElementById("metric-crowded"),
  alerts: document.getElementById("metric-alerts"),
  topRisk: document.getElementById("top-risk"),
  topRegion: document.getElementById("top-region"),
  status: document.getElementById("home-status")
};

async function refresh() {
  const payload = await getState();
  const analysis = buildAnalysis(payload.state);
  setTheme(analysis.state.theme);
  elements.total.textContent = analysis.state.satellites.length;
  elements.crowded.textContent = analysis.regions.filter((region) => region.crowded).length;
  elements.alerts.textContent =
    analysis.riskEntries.filter((entry) => entry.risk.level === "High").length +
    analysis.state.catastrophes.length +
    analysis.state.changeAlerts.length;
  elements.topRisk.textContent = analysis.riskEntries[0]
    ? `${analysis.riskEntries[0].satellite.name} at ${analysis.riskEntries[0].risk.score}/100`
    : "No active collision pressure";
  elements.topRegion.textContent = analysis.regions[0]
    ? `${analysis.regions[0].region} at ${analysis.regions[0].pressureScore}/100`
    : "No regional pressure yet";
  elements.status.textContent = "Landing page synced to the shared mission state.";
}

await refresh();
startPolling(refresh, 6000);
