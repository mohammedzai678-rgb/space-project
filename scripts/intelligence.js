import { buildAnalysis } from "../shared/mission-core.js";
import { getAuditLog, getNasaFeed, getState, sendChatMessage, startPolling } from "./shared/client-api.js";
import { escapeHtml, formatAuditTime, renderCollection, setTheme } from "./shared/dom.js";

const elements = {
  status: document.getElementById("intel-status"),
  stateSummary: document.getElementById("state-summary"),
  apod: document.getElementById("apod-card"),
  neoList: document.getElementById("neo-list"),
  auditList: document.getElementById("intel-audit-list"),
  chatThread: document.getElementById("chat-thread"),
  chatForm: document.getElementById("chat-form"),
  chatInput: document.getElementById("chat-input"),
  chatSend: document.getElementById("chat-send")
};

const chatMessages = [
  {
    role: "assistant",
    content: "Gemini mission assistant is ready. Ask about collision risk, busiest regions, launches, or incidents."
  }
];

function setStatus(text) {
  if (elements.status) {
    elements.status.textContent = text;
  }
}

function renderChat() {
  elements.chatThread.innerHTML = chatMessages.map((message) => `
    <article class="chatbot-message ${escapeHtml(message.role)}">
      <p class="chatbot-role">${message.role === "assistant" ? "Mission Assistant" : "Operator"}</p>
      <p>${escapeHtml(message.content)}</p>
    </article>
  `).join("");
  elements.chatThread.scrollTop = elements.chatThread.scrollHeight;
}

async function refreshStateSummary() {
  const payload = await getState();
  const analysis = buildAnalysis(payload.state);
  setTheme(analysis.state.theme);
  elements.stateSummary.innerHTML = `
    <article class="overview-card">
      <strong>${analysis.state.satellites.length}</strong>
      <p>Satellites in the shared mission state.</p>
    </article>
    <article class="overview-card">
      <strong>${analysis.riskEntries[0] ? `${analysis.riskEntries[0].satellite.name} ${analysis.riskEntries[0].risk.score}/100` : "No active risk"}</strong>
      <p>Top collision watch item right now.</p>
    </article>
    <article class="overview-card">
      <strong>${analysis.regions[0] ? analysis.regions[0].region : "No region data"}</strong>
      <p>Most active corridor across the live workspace.</p>
    </article>
  `;
}

async function refreshNasa() {
  const payload = await getNasaFeed();
  const apod = payload.apod;
  elements.apod.innerHTML = `
    ${apod.imageUrl ? `<img class="media-cover" src="${escapeHtml(apod.imageUrl)}" alt="${escapeHtml(apod.title)}">` : ""}
    <div class="media-copy">
      <p class="eyebrow">NASA APOD</p>
      <h2>${escapeHtml(apod.title)}</h2>
      <p class="stack-meta">${escapeHtml(apod.date)}</p>
      <p>${escapeHtml(apod.explanation)}</p>
    </div>
  `;

  renderCollection(
    elements.neoList,
    payload.nearEarthObjects.map((item) => `
      <article class="stack-item">
        <strong>${escapeHtml(item.name)} <span class="badge ${item.hazardous ? "high" : "low"}">${item.hazardous ? "Hazard watch" : "Tracked"}</span></strong>
        <p>Close approach ${escapeHtml(item.closeApproachDate)}. Miss distance ${escapeHtml(item.missDistanceKm)} km. Relative velocity ${escapeHtml(item.velocityKph)} km/h.</p>
        <p class="stack-meta">Estimated max diameter ${escapeHtml(item.diameterMaxKm)} km.</p>
      </article>
    `).join(""),
    "No NASA feed available",
    "The NASA intelligence feed will appear here once the API responds."
  );
}

async function refreshAudit() {
  const payload = await getAuditLog();
  renderCollection(
    elements.auditList,
    payload.entries.slice(0, 8).map((entry) => `
      <article class="stack-item">
        <strong>${escapeHtml(entry.action)}</strong>
        <p>${escapeHtml(entry.actor)} updated the shared workspace.</p>
        <p class="stack-meta">${escapeHtml(formatAuditTime(entry.created_at))}</p>
      </article>
    `).join(""),
    "No audit activity yet",
    "Administrator changes will appear here for read-only users."
  );
}

elements.chatForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = elements.chatInput.value.trim();
  if (!message) {
    return;
  }

  chatMessages.push({ role: "user", content: message });
  elements.chatInput.value = "";
  renderChat();
  elements.chatSend.disabled = true;

  try {
    const payload = await sendChatMessage(message);
    chatMessages.push({
      role: "assistant",
      content: payload.reply || "No response received."
    });
  } catch (error) {
    chatMessages.push({
      role: "assistant",
      content: "The mission assistant is unavailable right now."
    });
  } finally {
    elements.chatSend.disabled = false;
    renderChat();
  }
});

renderChat();
await Promise.all([refreshStateSummary(), refreshNasa(), refreshAudit()]);
setStatus("NASA and Gemini intelligence panels are synced.");
startPolling(async () => {
  await Promise.all([refreshStateSummary(), refreshAudit()]);
}, 7000);
