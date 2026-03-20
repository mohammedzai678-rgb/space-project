import {
  CATASTROPHE_TYPES,
  MISSION_OPTIONS,
  REGION_OPTIONS,
  SATELLITE_STATUSES,
  collectSatelliteChanges,
  generateCatastropheId,
  generateLaunchId,
  generateSatelliteId,
  getWorldRegion,
  mergeManualAlerts,
  processState
} from "../shared/mission-core.js";
import {
  clearAdminSession,
  createAdminSession,
  getAdminSession,
  getAuditLog,
  getState,
  startPolling,
  updateState
} from "./shared/client-api.js";
import { escapeHtml, formatAuditTime, renderCollection, setTheme } from "./shared/dom.js";

const elements = {
  status: document.getElementById("admin-status"),
  authForm: document.getElementById("admin-auth-form"),
  passwordInput: document.getElementById("admin-password"),
  authNote: document.getElementById("admin-auth-note"),
  logoutButton: document.getElementById("admin-logout"),
  panels: document.getElementById("admin-panels"),
  satelliteForm: document.getElementById("satellite-form"),
  launchForm: document.getElementById("launch-form"),
  catastropheForm: document.getElementById("catastrophe-form"),
  themeForm: document.getElementById("theme-form"),
  themeSelect: document.getElementById("theme-select"),
  satelliteList: document.getElementById("admin-satellite-list"),
  launchList: document.getElementById("admin-launch-list"),
  catastropheList: document.getElementById("admin-catastrophe-list"),
  changeList: document.getElementById("admin-change-list"),
  auditList: document.getElementById("audit-list"),
  clearAlertsButton: document.getElementById("clear-change-alerts")
};

let currentState = null;
let stopPolling = null;

function setStatus(text) {
  if (elements.status) {
    elements.status.textContent = text;
  }
}

function getFieldValue(id) {
  return document.getElementById(id)?.value || "";
}

function renderCollections() {
  if (!currentState) {
    return;
  }

  setTheme(currentState.theme);
  if (elements.themeSelect) {
    elements.themeSelect.value = currentState.theme;
  }

  renderCollection(
    elements.satelliteList,
    currentState.satellites.map((satellite) => `
      <article class="stack-item">
        <div class="item-header">
          <div>
            <strong>${escapeHtml(satellite.name)} <span class="badge low">${escapeHtml(satellite.id)}</span></strong>
            <p>${escapeHtml(satellite.operator)} | ${escapeHtml(satellite.region)} | ${escapeHtml(satellite.status)}</p>
          </div>
          <button class="item-delete-btn" data-delete-satellite="${escapeHtml(satellite.id)}" type="button">Delete</button>
        </div>
        <p class="stack-meta">Alt ${satellite.altitude} km | Vel ${satellite.velocity} km/s | Inclination ${satellite.inclination.toFixed(1)} deg | ${escapeHtml(satellite.mission)}</p>
      </article>
    `).join(""),
    "No satellites yet",
    "Add the first shared satellite to start the mission state."
  );

  renderCollection(
    elements.launchList,
    currentState.launches.map((launch) => `
      <article class="stack-item">
        <div class="item-header">
          <div>
            <strong>${escapeHtml(launch.name)} <span class="badge low">${escapeHtml(launch.id)}</span></strong>
            <p>${escapeHtml(launch.launchDate)} | ${escapeHtml(launch.launchSite)} | ${escapeHtml(launch.region)}</p>
          </div>
          <button class="item-delete-btn" data-delete-launch="${escapeHtml(launch.id)}" type="button">Delete</button>
        </div>
        <p class="stack-meta">${escapeHtml(launch.operator)} | Mission ${escapeHtml(launch.mission)}</p>
      </article>
    `).join(""),
    "No launches queued",
    "Future launches created here will appear for every user."
  );

  renderCollection(
    elements.catastropheList,
    currentState.catastrophes.map((event) => `
      <article class="stack-item">
        <div class="item-header">
          <div>
            <strong>${escapeHtml(event.name)} <span class="badge ${escapeHtml(event.severity)}">${escapeHtml(event.type)}</span></strong>
            <p>${escapeHtml(event.date)} | Severity ${escapeHtml(event.severity)}</p>
          </div>
          <button class="item-delete-btn" data-delete-catastrophe="${escapeHtml(event.id)}" type="button">Delete</button>
        </div>
        <p class="stack-meta">${escapeHtml(event.notes)}</p>
      </article>
    `).join(""),
    "No incidents tracked",
    "Log collisions, debris fields, and storms here."
  );

  renderCollection(
    elements.changeList,
    currentState.changeAlerts.map((alert) => `
      <article class="stack-item">
        <strong>${escapeHtml(alert.title)} <span class="badge ${escapeHtml(alert.severity)}">${escapeHtml(alert.source === "manual" ? "Manual" : "System")}</span></strong>
        <p>${escapeHtml(alert.message)}</p>
        <p class="stack-meta">${escapeHtml(alert.timestamp)}</p>
      </article>
    `).join(""),
    "No change alerts",
    "Update an existing satellite to create an audit-style change alert."
  );
}

async function refreshAudit() {
  const payload = await getAuditLog();
  renderCollection(
    elements.auditList,
    payload.entries.map((entry) => `
      <article class="stack-item">
        <strong>${escapeHtml(entry.action)}</strong>
        <p>${escapeHtml(entry.actor)} changed the shared mission state.</p>
        <p class="stack-meta">${escapeHtml(formatAuditTime(entry.created_at))}</p>
      </article>
    `).join(""),
    "No audit entries",
    "Audit history will appear once the first administrator change is saved."
  );
}

async function refreshState() {
  const payload = await getState();
  currentState = processState(payload.state);
  renderCollections();
}

async function persistState(action, details) {
  const payload = await updateState(currentState, action, details);
  currentState = processState(payload.state);
  renderCollections();
  await refreshAudit();
}

async function initialiseSession() {
  const payload = await getAdminSession();
  const configured = payload.configured;
  const authenticated = payload.authenticated;

  if (!configured) {
    elements.authNote.textContent = "Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Vercel before using the control room.";
  } else {
    elements.authNote.textContent = authenticated
      ? "Administrator session is active."
      : "Enter the administrator password to unlock write access.";
  }

  elements.panels.hidden = !authenticated;
  elements.logoutButton.hidden = !authenticated;

  if (!authenticated) {
    if (stopPolling) {
      stopPolling();
      stopPolling = null;
    }
    return;
  }

  await refreshState();
  await refreshAudit();
  setStatus("Administrator session verified. Changes here update the shared mission workspace for everyone.");

  if (!stopPolling) {
    stopPolling = startPolling(async () => {
      await refreshState();
      await refreshAudit();
    }, 7000);
  }
}

elements.authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await createAdminSession(elements.passwordInput.value);
    elements.passwordInput.value = "";
    await initialiseSession();
  } catch (error) {
    elements.authNote.textContent = error.message;
  }
});

elements.logoutButton?.addEventListener("click", async () => {
  await clearAdminSession();
  setStatus("Administrator session cleared.");
  await initialiseSession();
});

elements.themeForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  currentState.theme = elements.themeSelect.value === "light" ? "light" : "dark";
  await persistState("theme.updated", { theme: currentState.theme });
});

elements.satelliteForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const latitude = Number(getFieldValue("sat-lat"));
  const longitude = Number(getFieldValue("sat-lon"));
  const submittedName = getFieldValue("sat-name").trim();
  const satellite = {
    id: "",
    name: submittedName,
    operator: getFieldValue("sat-operator").trim(),
    latitude,
    longitude,
    altitude: Number(getFieldValue("sat-alt")),
    velocity: Number(getFieldValue("sat-velocity")),
    region: getWorldRegion(latitude, longitude),
    status: getFieldValue("sat-status"),
    inclination: Number(getFieldValue("sat-inclination")),
    mission: getFieldValue("sat-mission")
  };

  const existingSatellite = currentState.satellites.find((item) => item.name.trim().toLowerCase() === submittedName.toLowerCase());

  if (existingSatellite) {
    const alerts = collectSatelliteChanges(existingSatellite, satellite);
    Object.assign(existingSatellite, satellite, { id: existingSatellite.id });
    currentState.changeAlerts = mergeManualAlerts(currentState.changeAlerts, alerts);
    currentState.selectedSatelliteId = existingSatellite.id;
  } else {
    satellite.id = generateSatelliteId(currentState);
    currentState.satellites.unshift(satellite);
    currentState.selectedSatelliteId = satellite.id;
  }

  elements.satelliteForm.reset();
  await persistState("satellite.upserted", { satelliteName: satellite.name });
});

elements.launchForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  currentState.launches.unshift({
    id: generateLaunchId(currentState),
    name: getFieldValue("launch-name").trim(),
    operator: getFieldValue("launch-operator").trim(),
    launchDate: getFieldValue("launch-date"),
    launchSite: getFieldValue("launch-site").trim(),
    region: getFieldValue("launch-region"),
    mission: getFieldValue("launch-mission")
  });

  elements.launchForm.reset();
  await persistState("launch.created", { count: currentState.launches.length });
});

elements.catastropheForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  currentState.catastrophes.unshift({
    id: generateCatastropheId(currentState),
    name: getFieldValue("catastrophe-name").trim(),
    date: getFieldValue("catastrophe-date"),
    type: getFieldValue("catastrophe-type"),
    severity: getFieldValue("catastrophe-severity"),
    notes: getFieldValue("catastrophe-notes").trim()
  });

  elements.catastropheForm.reset();
  await persistState("incident.created", { count: currentState.catastrophes.length });
});

elements.clearAlertsButton?.addEventListener("click", async () => {
  currentState.changeAlerts = [];
  await persistState("change-alerts.cleared", {});
});

document.addEventListener("click", async (event) => {
  const deleteSatellite = event.target.closest("[data-delete-satellite]");
  if (deleteSatellite) {
    currentState.satellites = currentState.satellites.filter((item) => item.id !== deleteSatellite.dataset.deleteSatellite);
    currentState.changeAlerts = currentState.changeAlerts.filter((item) => item.satelliteId !== deleteSatellite.dataset.deleteSatellite);
    await persistState("satellite.deleted", { satelliteId: deleteSatellite.dataset.deleteSatellite });
    return;
  }

  const deleteLaunch = event.target.closest("[data-delete-launch]");
  if (deleteLaunch) {
    currentState.launches = currentState.launches.filter((item) => item.id !== deleteLaunch.dataset.deleteLaunch);
    await persistState("launch.deleted", { launchId: deleteLaunch.dataset.deleteLaunch });
    return;
  }

  const deleteCatastrophe = event.target.closest("[data-delete-catastrophe]");
  if (deleteCatastrophe) {
    currentState.catastrophes = currentState.catastrophes.filter((item) => item.id !== deleteCatastrophe.dataset.deleteCatastrophe);
    await persistState("incident.deleted", { incidentId: deleteCatastrophe.dataset.deleteCatastrophe });
  }
});

function populateOptions() {
  const regionOptions = REGION_OPTIONS.map((region) => `<option value="${escapeHtml(region)}">${escapeHtml(region)}</option>`).join("");
  const missionOptions = MISSION_OPTIONS.map((mission) => `<option value="${escapeHtml(mission)}">${escapeHtml(mission)}</option>`).join("");
  const statusOptions = SATELLITE_STATUSES.map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join("");
  const catastropheOptions = CATASTROPHE_TYPES.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("");

  document.getElementById("sat-status").innerHTML = statusOptions;
  document.getElementById("sat-mission").innerHTML = missionOptions;
  document.getElementById("launch-mission").innerHTML = missionOptions;
  document.getElementById("launch-region").innerHTML = `<option value="">Select region</option>${regionOptions}`;
  document.getElementById("catastrophe-type").innerHTML = catastropheOptions;
}

populateOptions();
await initialiseSession();
