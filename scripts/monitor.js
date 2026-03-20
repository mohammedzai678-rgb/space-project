import { buildAnalysis, buildRecentEvents, getLaunchCountdown, processState } from "../shared/mission-core.js";
import { getState, startPolling } from "./shared/client-api.js";
import { escapeHtml, renderCollection, setTheme } from "./shared/dom.js";

const WORLD_ATLAS_PATH = "/vendor/countries-110m.json";
const GLOBE_GRATICULE_STEP = 15;

const elements = {
  status: document.getElementById("page-status"),
  lastUpdated: document.getElementById("last-updated"),
  metricTotal: document.getElementById("metric-total"),
  metricCrowded: document.getElementById("metric-crowded"),
  metricAlerts: document.getElementById("metric-alerts"),
  overviewCards: document.getElementById("overview-cards"),
  recentEvents: document.getElementById("recent-events"),
  selectedSatellite: document.getElementById("selected-satellite-card"),
  regionChart: document.getElementById("region-chart"),
  satelliteTableBody: document.getElementById("satellite-table-body"),
  distanceList: document.getElementById("distance-list"),
  crowdingList: document.getElementById("crowding-list"),
  riskList: document.getElementById("risk-list"),
  timelineSummary: document.getElementById("timeline-summary"),
  timelineChart: document.getElementById("timeline-chart"),
  launchList: document.getElementById("launch-list"),
  catastropheList: document.getElementById("catastrophe-list"),
  globeCanvas: document.getElementById("globe-canvas"),
  globeStatus: document.getElementById("globe-status"),
  globeTooltip: document.getElementById("globe-tooltip")
};

let currentState = null;
let selectedSatelliteId = null;

const globeState = {
  rotationY: -0.7,
  rotationX: -0.25,
  dragging: false,
  pointerX: 0,
  pointerY: 0,
  visibleMarkers: [],
  animationFrame: null,
  countryFeatures: null,
  countryGeometryLoaded: false,
  loadError: ""
};

function setStatus(text) {
  if (elements.status) {
    elements.status.textContent = text;
  }
}

function setLastUpdated(value) {
  if (!elements.lastUpdated) {
    return;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    elements.lastUpdated.textContent = "Unknown";
    return;
  }

  elements.lastUpdated.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function renderMetrics(analysis) {
  elements.metricTotal.textContent = analysis.state.satellites.length;
  elements.metricCrowded.textContent = analysis.regions.filter((region) => region.crowded).length;
  elements.metricAlerts.textContent =
    analysis.riskEntries.filter((entry) => entry.risk.level === "High").length +
    analysis.state.changeAlerts.length +
    analysis.state.catastrophes.length;
}

function renderOverview(analysis) {
  const satelliteCount = analysis.state.satellites.length;
  const avgAltitude = satelliteCount
    ? analysis.state.satellites.reduce((sum, item) => sum + item.altitude, 0) / satelliteCount
    : 0;
  const avgVelocity = satelliteCount
    ? analysis.state.satellites.reduce((sum, item) => sum + item.velocity, 0) / satelliteCount
    : 0;
  const topRegion = analysis.regions[0];
  const topRisk = analysis.riskEntries[0];

  elements.overviewCards.innerHTML = [
    {
      value: `${satelliteCount}`,
      label: "Live satellites tracked across the shared mission workspace."
    },
    {
      value: `${avgAltitude.toFixed(0)} km`,
      label: "Average orbital altitude across the current fleet."
    },
    {
      value: topRegion ? topRegion.region : "No active region",
      label: topRegion ? `Highest regional pressure at ${topRegion.pressureScore}/100.` : "Add satellites to see regional pressure."
    },
    {
      value: `${avgVelocity.toFixed(2)} km/s`,
      label: topRisk ? `Top collision watch item is ${topRisk.satellite.name}.` : "Average velocity across the current fleet."
    }
  ].map((item) => `
    <article class="overview-card">
      <strong>${escapeHtml(item.value)}</strong>
      <p>${escapeHtml(item.label)}</p>
    </article>
  `).join("");
}

function renderRecent(analysis) {
  const items = buildRecentEvents(analysis.state, analysis);
  renderCollection(
    elements.recentEvents,
    items.map((item) => `
      <article class="stack-item">
        <strong>${escapeHtml(item.title)} <span class="badge ${escapeHtml(item.level)}">${escapeHtml(item.kind)}</span></strong>
        <p>${escapeHtml(item.text)}</p>
        <p class="stack-meta">${escapeHtml(item.meta)}</p>
      </article>
    `).join(""),
    "No live events yet",
    "Shared activity will appear here as administrators update the mission state."
  );
}

function renderSelected(analysis) {
  const entry = analysis.selectedEntry;
  if (!entry) {
    renderCollection(elements.selectedSatellite, "", "No satellite selected", "Choose a row in the registry to inspect one satellite in detail.");
    return;
  }

  elements.selectedSatellite.innerHTML = `
    <h3>${escapeHtml(entry.satellite.name)}</h3>
    <p>${escapeHtml(entry.satellite.id)} | ${escapeHtml(entry.satellite.operator)}</p>
    <div class="selected-meta">
      <div class="meta-item">
        <span>Mission</span>
        <strong>${escapeHtml(entry.satellite.mission)}</strong>
      </div>
      <div class="meta-item">
        <span>Risk Level</span>
        <strong>${escapeHtml(entry.risk.level)} (${entry.risk.score}/100)</strong>
      </div>
      <div class="meta-item">
        <span>Region</span>
        <strong>${escapeHtml(entry.satellite.region)}</strong>
      </div>
      <div class="meta-item">
        <span>Nearest Object</span>
        <strong>${entry.nearest ? `${escapeHtml(entry.nearest.target.name)} (${entry.nearest.distance.toFixed(0)} km)` : "None"}</strong>
      </div>
      <div class="meta-item">
        <span>Orbit</span>
        <strong>${entry.satellite.altitude} km | ${entry.satellite.inclination.toFixed(1)} deg</strong>
      </div>
      <div class="meta-item">
        <span>Signal</span>
        <strong>${escapeHtml(entry.risk.signals[0])}</strong>
      </div>
    </div>
  `;
}

function renderRegionChart(analysis) {
  if (!analysis.regions.length) {
    renderCollection(elements.regionChart, "", "No region data", "Region distribution appears after the first shared satellite is added.");
    return;
  }

  const maxCount = Math.max(...analysis.regions.map((region) => region.count), 1);
  elements.regionChart.innerHTML = analysis.regions.map((region) => `
    <div class="bar-row">
      <div class="bar-label">${escapeHtml(region.region)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(region.count / maxCount) * 100}%"></div></div>
      <div>${region.count}</div>
    </div>
  `).join("");
}

function renderRegistry(analysis) {
  if (!analysis.riskEntries.length) {
    elements.satelliteTableBody.innerHTML = '<tr><td colspan="8">No satellites registered yet.</td></tr>';
    return;
  }

  elements.satelliteTableBody.innerHTML = analysis.riskEntries.map((entry) => `
    <tr class="${entry.satellite.id === selectedSatelliteId ? "is-selected" : ""}">
      <td>${escapeHtml(entry.satellite.id)}</td>
      <td><button class="table-row-button" data-select-satellite="${escapeHtml(entry.satellite.id)}" type="button">${escapeHtml(entry.satellite.name)}</button></td>
      <td>${escapeHtml(entry.satellite.operator)}</td>
      <td>${escapeHtml(entry.satellite.mission)}</td>
      <td>${escapeHtml(entry.satellite.region)}</td>
      <td>${entry.satellite.altitude} km</td>
      <td>${escapeHtml(entry.satellite.status)}</td>
      <td><span class="badge ${entry.risk.level.toLowerCase()}">${escapeHtml(entry.risk.level)}</span></td>
    </tr>
  `).join("");
}

function renderDistances(analysis) {
  renderCollection(
    elements.distanceList,
    analysis.closest.map((entry) => `
      <article class="stack-item">
        <strong>${escapeHtml(entry.satellite.name)} <span class="badge low">${escapeHtml(entry.satellite.id)}</span></strong>
        <p>${entry.neighbors.map((neighbor) => `${escapeHtml(neighbor.target.name)}: ${neighbor.distance.toFixed(0)} km, alt gap ${neighbor.altitudeGap.toFixed(0)} km`).join(" | ")}</p>
      </article>
    `).join(""),
    "No distance data",
    "Add at least two satellites from the admin page to compare nearby orbital spacing."
  );
}

function renderCrowding(analysis) {
  renderCollection(
    elements.crowdingList,
    analysis.regions.map((region) => `
      <article class="stack-item">
        <strong>${escapeHtml(region.region)} <span class="badge ${region.crowded ? "high" : "low"}">${region.crowded ? "Crowded" : "Stable"}</span></strong>
        <p>Pressure ${region.pressureScore}/100. ${escapeHtml(region.reasons.join(". "))}.</p>
      </article>
    `).join(""),
    "No regions active",
    "Regional pressure appears once the shared mission state contains satellites."
  );
}

function renderRisks(analysis) {
  renderCollection(
    elements.riskList,
    analysis.riskEntries.map((entry) => `
      <article class="stack-item">
        <strong>${escapeHtml(entry.satellite.name)} <span class="badge ${entry.risk.level.toLowerCase()}">${escapeHtml(entry.risk.level)} Risk</span></strong>
        <p>AI score ${entry.risk.score}/100. Nearest object at ${entry.nearestDistance ? entry.nearestDistance.toFixed(0) : "N/A"} km. Main trigger: ${escapeHtml(entry.risk.signals[0])}.</p>
      </article>
    `).join(""),
    "No collision alerts",
    "Shared collision analysis will appear automatically after administrators add satellites."
  );
}

function renderTimeline(analysis) {
  const busiestRegions = analysis.regions.slice(0, 6);
  elements.timelineSummary.textContent = busiestRegions.length
    ? `${busiestRegions[0].region} has the highest activity right now with ${busiestRegions[0].count} satellite(s).`
    : "No regional activity yet.";

  renderCollection(
    elements.timelineChart,
    busiestRegions.map((region) => `
      <article class="stack-item">
        <strong>${escapeHtml(region.region)} <span class="badge ${region.count >= 3 ? "high" : region.count === 2 ? "medium" : "low"}">${region.count} satellite(s)</span></strong>
        <p>Pressure ${region.pressureScore}/100. ${escapeHtml(region.reasons[0])}.</p>
      </article>
    `).join(""),
    "No busy regions yet",
    "Shared satellites will automatically populate the busiest-region view."
  );
}

function renderLaunches(analysis) {
  const html = analysis.state.launches
    .slice()
    .sort((left, right) => new Date(left.launchDate) - new Date(right.launchDate))
    .map((launch) => `
      <article class="stack-item">
        <strong>${escapeHtml(launch.name)} <span class="badge low">${escapeHtml(launch.id)}</span></strong>
        <p>${escapeHtml(launch.operator)} | ${escapeHtml(launch.launchSite)} | ${escapeHtml(launch.region)}</p>
        <p class="stack-meta">Planned for ${escapeHtml(launch.launchDate)}. ${escapeHtml(getLaunchCountdown(launch.launchDate))}. Mission: ${escapeHtml(launch.mission)}.</p>
      </article>
    `).join("");

  renderCollection(
    elements.launchList,
    html,
    "No future launches tracked",
    "Upcoming launches added by administrators will appear here."
  );
}

function renderCatastrophes(analysis) {
  const html = analysis.state.catastrophes
    .slice()
    .sort((left, right) => new Date(right.date) - new Date(left.date))
    .map((event) => `
      <article class="stack-item">
        <strong>${escapeHtml(event.name)} <span class="badge ${escapeHtml(event.severity)}">${escapeHtml(event.type)}</span></strong>
        <p>${escapeHtml(event.date)} | Severity ${escapeHtml(event.severity)}</p>
        <p class="stack-meta">${escapeHtml(event.notes)}</p>
      </article>
    `).join("");

  renderCollection(
    elements.catastropheList,
    html,
    "No incidents recorded",
    "Incident updates from the administrator control room will appear here."
  );
}

function getGlobePalette(theme) {
  if (theme === "light") {
    return {
      atmosphereStart: "rgba(86, 166, 230, 0.48)",
      atmosphereEnd: "rgba(214, 235, 252, 0)",
      oceanStart: "#dff0fb",
      oceanMid: "#78b5e3",
      oceanEnd: "#2f6d99",
      landFill: "rgba(114, 170, 123, 0.72)",
      landStroke: "rgba(247, 252, 255, 0.82)",
      graticule: "rgba(28, 72, 118, 0.18)",
      axis: "rgba(11, 104, 170, 0.34)",
      outline: "rgba(16, 35, 58, 0.22)",
      label: "#10233a"
    };
  }

  return {
    atmosphereStart: "rgba(30, 118, 191, 0.86)",
    atmosphereEnd: "rgba(3, 12, 28, 0)",
    oceanStart: "#61d1ff",
    oceanMid: "#195d88",
    oceanEnd: "#081d34",
    landFill: "rgba(94, 178, 130, 0.66)",
    landStroke: "rgba(225, 245, 255, 0.34)",
    graticule: "rgba(167, 222, 255, 0.18)",
    axis: "rgba(102, 224, 255, 0.28)",
    outline: "rgba(186, 229, 255, 0.28)",
    label: "rgba(239, 246, 255, 0.94)"
  };
}

function hideTooltip() {
  if (!elements.globeTooltip) {
    return;
  }

  elements.globeTooltip.classList.add("hidden");
}

function showTooltip(marker, event) {
  if (!elements.globeTooltip) {
    return;
  }

  elements.globeTooltip.classList.remove("hidden");
  elements.globeTooltip.innerHTML = `
    <strong>${escapeHtml(marker.satellite.name)}</strong>
    <span>${escapeHtml(marker.satellite.region)} | ${escapeHtml(marker.risk.level)} risk</span>
    <span>Lat ${marker.satellite.latitude.toFixed(2)} | Lon ${marker.satellite.longitude.toFixed(2)}</span>
    <span>Alt ${marker.satellite.altitude} km | Vel ${marker.satellite.velocity.toFixed(2)} km/s</span>
  `;

  const rect = elements.globeCanvas.getBoundingClientRect();
  elements.globeTooltip.style.left = `${event.clientX - rect.left + 16}px`;
  elements.globeTooltip.style.top = `${event.clientY - rect.top + 16}px`;
}

function resizeGlobeCanvas() {
  const rect = elements.globeCanvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width * pixelRatio));
  const height = Math.max(320, Math.floor(rect.height * pixelRatio));

  if (elements.globeCanvas.width !== width || elements.globeCanvas.height !== height) {
    elements.globeCanvas.width = width;
    elements.globeCanvas.height = height;
  }
}

function buildGlobeProjection(width, height) {
  return window.d3.geoOrthographic()
    .translate([width / 2, height / 2])
    .scale(Math.min(width, height) * 0.31)
    .rotate([
      (-globeState.rotationY * 180) / Math.PI,
      (-globeState.rotationX * 180) / Math.PI
    ])
    .clipAngle(90)
    .precision(0.35);
}

function projectMarker(projection, satellite, centerX, centerY) {
  const surfacePoint = projection([satellite.longitude, satellite.latitude]);
  if (!surfacePoint) {
    return null;
  }

  const visibleCenter = projection.invert([centerX, centerY]);
  if (!visibleCenter) {
    return null;
  }

  const angularDistance = window.d3.geoDistance([satellite.longitude, satellite.latitude], visibleCenter);
  if (angularDistance > (Math.PI / 2) - 0.0001) {
    return null;
  }

  return { x: surfacePoint[0], y: surfacePoint[1] };
}

function drawGlobe(analysis) {
  if (!elements.globeCanvas || !window.d3) {
    return;
  }

  resizeGlobeCanvas();
  const context = elements.globeCanvas.getContext("2d");
  const width = elements.globeCanvas.width;
  const height = elements.globeCanvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.31;
  const palette = getGlobePalette(analysis.state.theme);

  context.clearRect(0, 0, width, height);
  const background = context.createRadialGradient(centerX * 0.82, centerY * 0.76, radius * 0.24, centerX, centerY, radius * 1.9);
  background.addColorStop(0, palette.atmosphereStart);
  background.addColorStop(0.58, analysis.state.theme === "light" ? "rgba(132, 184, 227, 0.26)" : "rgba(11, 42, 81, 0.95)");
  background.addColorStop(1, palette.atmosphereEnd);
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  if (!globeState.countryGeometryLoaded || !globeState.countryFeatures?.length) {
    if (elements.globeStatus) {
      elements.globeStatus.textContent = globeState.loadError || "Loading globe geometry...";
    }
    return;
  }

  const projection = buildGlobeProjection(width, height);
  const path = window.d3.geoPath(projection, context);
  const sphere = { type: "Sphere" };
  const graticule = window.d3.geoGraticule().step([GLOBE_GRATICULE_STEP, GLOBE_GRATICULE_STEP])();

  const oceanGradient = context.createRadialGradient(centerX - radius * 0.24, centerY - radius * 0.34, radius * 0.12, centerX, centerY, radius * 1.02);
  oceanGradient.addColorStop(0, palette.oceanStart);
  oceanGradient.addColorStop(0.45, palette.oceanMid);
  oceanGradient.addColorStop(1, palette.oceanEnd);

  context.beginPath();
  path(sphere);
  context.fillStyle = oceanGradient;
  context.fill();

  context.save();
  context.beginPath();
  path(sphere);
  context.clip();

  context.beginPath();
  path({ type: "FeatureCollection", features: globeState.countryFeatures });
  context.fillStyle = palette.landFill;
  context.fill();
  context.strokeStyle = palette.landStroke;
  context.lineWidth = Math.max(0.8, radius * 0.006);
  context.stroke();

  context.beginPath();
  path(graticule);
  context.strokeStyle = palette.graticule;
  context.lineWidth = Math.max(0.8, radius * 0.0042);
  context.stroke();
  context.restore();

  const renderedSatellites = analysis.riskEntries
    .map((entry) => ({
      entry,
      radius: entry.satellite.id === selectedSatelliteId ? 7.5 : 5.2,
      marker: projectMarker(projection, entry.satellite, centerX, centerY)
    }))
    .filter((item) => item.marker);

  globeState.visibleMarkers = renderedSatellites.map(({ entry, marker, radius: markerRadius }) => ({
    satellite: entry.satellite,
    risk: entry.risk,
    x: marker.x,
    y: marker.y,
    radius: markerRadius
  }));

  renderedSatellites.forEach(({ entry, marker, radius: markerRadius }) => {
    const color = entry.risk.level === "High"
      ? "#ff6b7d"
      : entry.risk.level === "Medium"
        ? "#ffbf69"
        : "#66e0ff";

    context.beginPath();
    context.arc(marker.x, marker.y, markerRadius, 0, Math.PI * 2);
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = 18;
    context.fill();
    context.shadowBlur = 0;
  });

  context.beginPath();
  path(sphere);
  context.lineWidth = Math.max(1.5, radius * 0.01);
  context.strokeStyle = palette.outline;
  context.stroke();

  if (elements.globeStatus) {
    elements.globeStatus.textContent = analysis.selectedEntry
      ? `${analysis.selectedEntry.satellite.name} is selected. Drag to rotate the shared globe.`
      : "Drag to rotate the shared globe and inspect orbital positions.";
  }
}

async function loadGlobeGeometry() {
  if (!window.d3 || !window.topojson) {
    globeState.loadError = "The globe renderer could not load.";
    return;
  }

  try {
    const response = await fetch(WORLD_ATLAS_PATH, { cache: "force-cache" });
    const topology = await response.json();
    globeState.countryFeatures = window.topojson.feature(topology, topology.objects.countries).features;
    globeState.countryGeometryLoaded = true;
  } catch (error) {
    globeState.loadError = "Country-outline geometry could not be loaded.";
  }
}

function findHoveredMarker(event) {
  const rect = elements.globeCanvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const x = (event.clientX - rect.left) * pixelRatio;
  const y = (event.clientY - rect.top) * pixelRatio;

  return globeState.visibleMarkers.find((marker) => {
    const dx = marker.x - x;
    const dy = marker.y - y;
    return Math.sqrt(dx * dx + dy * dy) <= marker.radius + 6;
  }) || null;
}

function animateGlobe() {
  if (!globeState.dragging && elements.globeCanvas && !elements.globeCanvas.matches(":hover") && currentState) {
    globeState.rotationY -= 0.0008;
    render();
  }
  globeState.animationFrame = requestAnimationFrame(animateGlobe);
}

function render() {
  if (!currentState) {
    return;
  }

  const analysis = buildAnalysis({
    ...currentState,
    selectedSatelliteId
  });
  setTheme(analysis.state.theme);
  renderMetrics(analysis);
  renderOverview(analysis);
  renderRecent(analysis);
  renderSelected(analysis);
  renderRegionChart(analysis);
  renderRegistry(analysis);
  renderDistances(analysis);
  renderCrowding(analysis);
  renderRisks(analysis);
  renderTimeline(analysis);
  renderLaunches(analysis);
  renderCatastrophes(analysis);
  drawGlobe(analysis);
}

async function refreshState() {
  const payload = await getState();
  currentState = processState(payload.state);
  if (!selectedSatelliteId || !currentState.satellites.some((satellite) => satellite.id === selectedSatelliteId)) {
    selectedSatelliteId = currentState.selectedSatelliteId || currentState.satellites[0]?.id || null;
  }

  setLastUpdated(payload.meta?.updatedAt);
  setStatus(payload.meta?.access === "admin"
    ? "Viewer dashboard synced. Administrator controls are available on the admin page."
    : "Viewer dashboard synced from the shared Supabase mission state.");
  render();
}

document.addEventListener("click", (event) => {
  const selectButton = event.target.closest("[data-select-satellite]");
  if (!selectButton) {
    return;
  }

  selectedSatelliteId = selectButton.dataset.selectSatellite;
  render();
});

if (elements.globeCanvas) {
  elements.globeCanvas.addEventListener("pointerdown", (event) => {
    globeState.dragging = true;
    globeState.pointerX = event.clientX;
    globeState.pointerY = event.clientY;
    hideTooltip();
    elements.globeCanvas.setPointerCapture(event.pointerId);
  });

  elements.globeCanvas.addEventListener("pointermove", (event) => {
    if (!globeState.dragging) {
      const marker = findHoveredMarker(event);
      if (marker) {
        showTooltip(marker, event);
      } else {
        hideTooltip();
      }
      return;
    }

    const deltaX = event.clientX - globeState.pointerX;
    const deltaY = event.clientY - globeState.pointerY;
    globeState.pointerX = event.clientX;
    globeState.pointerY = event.clientY;
    globeState.rotationY -= deltaX * 0.006;
    globeState.rotationX = Math.max(-1.2, Math.min(1.2, globeState.rotationX + deltaY * 0.006));
    hideTooltip();
    render();
  });

  elements.globeCanvas.addEventListener("pointerup", (event) => {
    globeState.dragging = false;
    hideTooltip();
    elements.globeCanvas.releasePointerCapture(event.pointerId);
  });

  elements.globeCanvas.addEventListener("pointerleave", () => {
    globeState.dragging = false;
    hideTooltip();
  });
}

window.addEventListener("resize", () => render());

await loadGlobeGeometry();
await refreshState();
animateGlobe();
startPolling(refreshState, 5000);
