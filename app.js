const STORAGE_KEY = "orbital-traffic-state-v4";
const earthRadiusKm = 6371;
const IST_TIME_ZONE = "Asia/Kolkata";
const WORLD_ATLAS_PATH = "vendor/countries-110m.json";
const GLOBE_GRATICULE_STEP = 15;
const API_STATE_PATH = "http://127.0.0.1:5000/api/state";
const REMOTE_SYNC_DELAY_MS = 350;

const regionOptions = [
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

function createPolygon(coordinates) {
  return {
    type: "Polygon",
    coordinates: [coordinates]
  };
}

function createMultiPolygon(polygons) {
  return {
    type: "MultiPolygon",
    coordinates: polygons.map((polygon) => [polygon])
  };
}

const worldRegionPolygons = [
  {
    name: "Arctic",
    geometry: createPolygon([[-180, 72], [180, 72], [180, 90], [-180, 90], [-180, 72]])
  },
  {
    name: "Antarctica",
    geometry: createPolygon([[-180, -90], [180, -90], [180, -60], [-180, -60], [-180, -90]])
  },
  {
    name: "Middle East",
    geometry: createPolygon([[28, 12], [66, 12], [66, 42], [50, 42], [44, 38], [36, 36], [30, 30], [28, 12]])
  },
  {
    name: "South Asia",
    geometry: createPolygon([[60, 5], [95, 5], [95, 37], [76, 37], [68, 31], [60, 24], [60, 5]])
  },
  {
    name: "Southeast Asia",
    geometry: createPolygon([[94, -12], [141, -12], [141, 22], [126, 22], [117, 20], [108, 18], [100, 14], [94, 8], [94, -12]])
  },
  {
    name: "East Asia",
    geometry: createPolygon([[95, 18], [150, 18], [150, 55], [130, 55], [120, 50], [110, 49], [95, 44], [95, 18]])
  },
  {
    name: "Central Asia",
    geometry: createPolygon([[45, 35], [95, 35], [95, 56], [45, 56], [45, 35]])
  },
  {
    name: "Europe",
    geometry: createPolygon([[-25, 34], [-10, 35], [5, 35], [24, 35], [45, 40], [50, 55], [35, 72], [0, 72], [-25, 60], [-25, 34]])
  },
  {
    name: "Africa",
    geometry: createPolygon([[-19, 37], [10, 37], [35, 34], [52, 12], [52, -35], [18, -35], [-18, 0], [-19, 37]])
  },
  {
    name: "North America",
    geometry: createMultiPolygon([
      [[-168, 7], [-168, 72], [-150, 83], [-95, 84], [-52, 60], [-60, 18], [-78, 7], [-105, 7], [-130, 15], [-150, 20], [-168, 7]],
      [[-74, 58], [-74, 84], [-12, 84], [-12, 58], [-40, 58], [-55, 60], [-74, 58]]
    ])
  },
  {
    name: "South America",
    geometry: createPolygon([[-82, 13], [-34, 13], [-34, -56], [-81, -56], [-82, 13]])
  },
  {
    name: "Oceania",
    geometry: createPolygon([[110, -50], [180, -50], [180, 5], [145, 5], [130, 0], [110, -10], [110, -50]])
  }
];

const state = loadState();
const persistence = {
  apiAvailable: false,
  initialised: false,
  syncTimer: null,
  syncInFlight: false,
  lastSavedSerialised: "",
  lastRemoteSerialised: ""
};

const form = document.getElementById("satellite-form");
const satelliteTableBody = document.getElementById("satellite-table-body");
const overviewCards = document.getElementById("overview-cards");
const heroHighlights = document.getElementById("hero-highlights");
const coverNewsFeed = document.getElementById("cover-news-feed");
const coverSignalGrid = document.getElementById("cover-signal-grid");
const distanceList = document.getElementById("distance-list");
const crowdingList = document.getElementById("crowding-list");
const riskList = document.getElementById("risk-list");
const changeAlertList = document.getElementById("change-alert-list");
const operationsWatchlist = document.getElementById("operations-watchlist");
const launchList = document.getElementById("launch-list");
const catastropheList = document.getElementById("catastrophe-list");
const globeCanvas = document.getElementById("globe-canvas");
const globeTooltip = document.getElementById("globe-tooltip");
const globeStage = globeCanvas?.parentElement || null;
const globeStatus = document.getElementById("globe-status");
const globeInfoTrigger = document.getElementById("globe-info-trigger");
const globeModal = document.getElementById("globe-modal");
const globeModalClose = document.getElementById("globe-modal-close");
const globeModalBody = document.getElementById("globe-modal-body");
const metricTotal = document.getElementById("metric-total");
const metricCrowded = document.getElementById("metric-crowded");
const metricAlerts = document.getElementById("metric-alerts");
const corridorList = document.getElementById("corridor-list");
const istClockDay = document.getElementById("ist-clock-day");
const istClockTime = document.getElementById("ist-clock-time");
const istClockDate = document.getElementById("ist-clock-date");
const selectedSatelliteCard = document.getElementById("selected-satellite-card");
const regionChart = document.getElementById("region-chart");
const altitudeChart = document.getElementById("altitude-chart");
const timelineChart = document.getElementById("timeline-chart");
const timelineSummary = document.getElementById("timeline-summary");
const themeToggleButton = document.getElementById("theme-toggle");
const clearSatellitesButton = document.getElementById("clear-satellites");
const clearChangeAlertsButton = document.getElementById("clear-change-alerts");
const clearLaunchesButton = document.getElementById("clear-launches");
const clearCatastrophesButton = document.getElementById("clear-catastrophes");
const regionInput = document.getElementById("sat-region");
const launchRegionInput = document.getElementById("launch-region");
const satelliteForm = document.getElementById("satellite-form");
const launchForm = document.getElementById("launch-form");
const catastropheForm = document.getElementById("catastrophe-form");

const worldRegions = [
  { name: "North America", latMin: 15, latMax: 85, lonMin: -170, lonMax: -50 },
  { name: "South America", latMin: -60, latMax: 15, lonMin: -90, lonMax: -30 },
  { name: "Europe", latMin: 35, latMax: 72, lonMin: -25, lonMax: 45 },
  { name: "Africa", latMin: -35, latMax: 37, lonMin: -20, lonMax: 55 },
  { name: "Middle East", latMin: 12, latMax: 42, lonMin: 30, lonMax: 65 },
  { name: "South Asia", latMin: 5, latMax: 37, lonMin: 65, lonMax: 95 },
  { name: "East Asia", latMin: 18, latMax: 55, lonMin: 95, lonMax: 150 },
  { name: "Southeast Asia", latMin: -12, latMax: 22, lonMin: 95, lonMax: 141 },
  { name: "Central Asia", latMin: 35, latMax: 56, lonMin: 45, lonMax: 95 },
  { name: "Oceania", latMin: -50, latMax: 5, lonMin: 110, lonMax: 180 },
  { name: "Arctic", latMin: 72, latMax: 90, lonMin: -180, lonMax: 180 },
  { name: "Antarctica", latMin: -90, latMax: -60, lonMin: -180, lonMax: 180 }
];

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

function normaliseSatellite(satellite) {
  return {
    ...satellite,
    inclination: typeof satellite.inclination === "number" ? satellite.inclination : 0,
    mission: satellite.mission || "Communication",
    region: getWorldRegion(satellite.latitude, satellite.longitude)
  };
}

function normaliseState(candidate) {
  const fallback = createDefaultState();
  if (!candidate || typeof candidate !== "object") {
    return fallback;
  }

  const satellites = Array.isArray(candidate.satellites)
    ? candidate.satellites.map(normaliseSatellite)
    : fallback.satellites;

  return {
    nextId: typeof candidate.nextId === "number" ? candidate.nextId : fallback.nextId,
    nextLaunchId: typeof candidate.nextLaunchId === "number" ? candidate.nextLaunchId : fallback.nextLaunchId,
    nextCatastropheId: typeof candidate.nextCatastropheId === "number" ? candidate.nextCatastropheId : fallback.nextCatastropheId,
    selectedSatelliteId: candidate.selectedSatelliteId || satellites[0]?.id || fallback.selectedSatelliteId,
    satellites,
    launches: Array.isArray(candidate.launches) ? candidate.launches : fallback.launches,
    catastrophes: Array.isArray(candidate.catastrophes) ? candidate.catastrophes : fallback.catastrophes,
    changeAlerts: Array.isArray(candidate.changeAlerts) ? candidate.changeAlerts.slice(0, 25) : fallback.changeAlerts,
    theme: candidate.theme === "light" ? "light" : "dark"
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultState();
    }

    return normaliseState(JSON.parse(raw));
  } catch (error) {
    return createDefaultState();
  }
}

function getSerializableState() {
  return {
    nextId: state.nextId,
    nextLaunchId: state.nextLaunchId,
    nextCatastropheId: state.nextCatastropheId,
    selectedSatelliteId: state.selectedSatelliteId,
    satellites: state.satellites,
    launches: state.launches,
    catastrophes: state.catastrophes,
    changeAlerts: state.changeAlerts.slice(0, 25),
    theme: state.theme
  };
}

function replaceState(nextState) {
  Object.assign(state, normaliseState(nextState));
}

function hasStoredActivity(candidate) {
  return Boolean(
    candidate.satellites.length ||
    candidate.launches.length ||
    candidate.catastrophes.length ||
    candidate.changeAlerts.length ||
    candidate.selectedSatelliteId ||
    candidate.theme !== "dark" ||
    candidate.nextId !== 1001 ||
    candidate.nextLaunchId !== 1 ||
    candidate.nextCatastropheId !== 1
  );
}

function saveState(options = {}) {
  const serialisedState = JSON.stringify(getSerializableState());

  if (serialisedState !== persistence.lastSavedSerialised) {
    localStorage.setItem(STORAGE_KEY, serialisedState);
    persistence.lastSavedSerialised = serialisedState;
  }

  if (!options.skipRemote && persistence.apiAvailable && persistence.initialised) {
    queueRemoteSync(serialisedState);
  }
}

async function pushStateToApi(serialisedState) {
  if (!persistence.apiAvailable || persistence.syncInFlight) {
    return;
  }

  persistence.syncInFlight = true;

  try {
    const response = await fetch(API_STATE_PATH, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: serialisedState
    });

    if (!response.ok) {
      throw new Error(`Cloud sync failed with status ${response.status}.`);
    }

    persistence.lastRemoteSerialised = serialisedState;
  } catch (error) {
    persistence.apiAvailable = false;
    console.error(error);
  } finally {
    persistence.syncInFlight = false;
    const latestSerialisedState = JSON.stringify(getSerializableState());
    if (persistence.apiAvailable && latestSerialisedState !== persistence.lastRemoteSerialised) {
      queueRemoteSync(latestSerialisedState);
    }
  }
}

function queueRemoteSync(serialisedState = JSON.stringify(getSerializableState())) {
  if (serialisedState === persistence.lastRemoteSerialised) {
    return;
  }

  if (persistence.syncTimer) {
    window.clearTimeout(persistence.syncTimer);
  }

  persistence.syncTimer = window.setTimeout(() => {
    persistence.syncTimer = null;
    pushStateToApi(serialisedState);
  }, REMOTE_SYNC_DELAY_MS);
}

async function hydrateStateFromApi() {
  try {
    const response = await fetch(API_STATE_PATH, {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return;
    }

    persistence.apiAvailable = true;

    const remoteState = normaliseState(await response.json());
    const localState = normaliseState(getSerializableState());
    const remoteHasActivity = hasStoredActivity(remoteState);
    const localHasActivity = hasStoredActivity(localState);

    if (remoteHasActivity || !localHasActivity) {
      replaceState(remoteState);
      persistence.lastRemoteSerialised = JSON.stringify(getSerializableState());
      saveState({ skipRemote: true });
      render();
      return;
    }

    queueRemoteSync(JSON.stringify(localState));
  } catch (error) {
    persistence.apiAvailable = false;
  } finally {
    persistence.initialised = true;
  }
}

function applyTheme(theme) {
  state.theme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = state.theme;
  if (themeToggleButton) {
    themeToggleButton.textContent = state.theme === "light" ? "Switch to Dark Colour" : "Switch to Light Colour";
  }
}

function getWorldRegion(latitude, longitude) {
  if (Number.isFinite(latitude) && Number.isFinite(longitude) && typeof window !== "undefined" && window.d3) {
    const point = [longitude, latitude];
    const polygonRegion = worldRegionPolygons.find((candidate) => window.d3.geoContains(candidate.geometry, point));
    if (polygonRegion) {
      return polygonRegion.name;
    }
  }

  const region = worldRegions.find((candidate) =>
    latitude >= candidate.latMin &&
    latitude < candidate.latMax &&
    longitude >= candidate.lonMin &&
    longitude < candidate.lonMax
  );
  if (region) return region.name;

  if (latitude >= 0) {
    return longitude < 0 ? "North Atlantic" : "North Pacific";
  }

  return longitude < 20 ? "South Atlantic" : "South Pacific";
}

function populateRegionOptions() {
  const options = [
    '<option value="">Select region</option>',
    ...regionOptions.map((region) => `<option value="${escapeHtml(region)}">${escapeHtml(region)}</option>`)
  ].join("");

  regionInput.innerHTML = options;
  launchRegionInput.innerHTML = options;
}

function updateIstClock() {
  if (!istClockDay || !istClockTime || !istClockDate) {
    return;
  }

  const now = new Date();
  istClockDay.textContent = now.toLocaleDateString("en-IN", {
    timeZone: IST_TIME_ZONE,
    weekday: "long"
  });
  istClockTime.textContent = now.toLocaleTimeString("en-IN", {
    timeZone: IST_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  istClockDate.textContent = now.toLocaleDateString("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function startIstClock() {
  updateIstClock();
  window.setInterval(updateIstClock, 1000);
}

function renderCorridorList(analysis) {
  if (!corridorList) {
    return;
  }

  const corridorCounts = new Map(
    (analysis?.regions || []).map((region) => [region.region, region.count])
  );

  corridorList.innerHTML = regionOptions.map((region) => `
    <article class="corridor-item">
      <strong class="corridor-name">${escapeHtml(region)}</strong>
      <p class="corridor-meta">${corridorCounts.get(region) || 0} satellite(s)</p>
    </article>
  `).join("");
}

function hideGlobeTooltip() {
  if (!globeTooltip) {
    return;
  }

  globeTooltip.classList.add("hidden");
  globeTooltip.setAttribute("aria-hidden", "true");
}

function showGlobeTooltip(marker, event) {
  if (!globeTooltip || !globeStage) {
    return;
  }

  globeTooltip.innerHTML = `
    <strong>${escapeHtml(marker.satellite.name)}</strong>
    <span>${escapeHtml(marker.satellite.region)} | ${escapeHtml(marker.risk.level)} risk</span>
    <span>Lat ${marker.satellite.latitude.toFixed(2)} | Lon ${marker.satellite.longitude.toFixed(2)}</span>
    <span>Alt ${marker.satellite.altitude} km | Vel ${marker.satellite.velocity.toFixed(2)} km/s</span>
  `;

  const stageRect = globeStage.getBoundingClientRect();
  const offsetX = event.clientX - stageRect.left + 18;
  const offsetY = event.clientY - stageRect.top + 18;
  const maxX = Math.max(12, stageRect.width - 220);
  const maxY = Math.max(12, stageRect.height - 110);

  globeTooltip.style.left = `${Math.max(12, Math.min(offsetX, maxX))}px`;
  globeTooltip.style.top = `${Math.max(12, Math.min(offsetY, maxY))}px`;
  globeTooltip.classList.remove("hidden");
  globeTooltip.setAttribute("aria-hidden", "false");
}

function findHoveredSatelliteMarker(event) {
  if (!globeState.visibleMarkers.length) {
    return null;
  }

  const rect = globeCanvas.getBoundingClientRect();
  const scaleX = globeCanvas.width / rect.width;
  const scaleY = globeCanvas.height / rect.height;
  const pointerX = (event.clientX - rect.left) * scaleX;
  const pointerY = (event.clientY - rect.top) * scaleY;

  let hoveredMarker = null;
  let smallestDistance = Infinity;

  globeState.visibleMarkers.forEach((marker) => {
    const distance = Math.hypot(pointerX - marker.x, pointerY - marker.y);
    const hitRadius = marker.radius + 10;
    if (distance <= hitRadius && distance < smallestDistance) {
      hoveredMarker = marker;
      smallestDistance = distance;
    }
  });

  return hoveredMarker;
}

async function loadGlobeGeometry() {
  if (!window.d3 || !window.topojson) {
    globeState.loadError = "The globe libraries are missing, so the country model could not be loaded.";
    globeState.countryGeometryLoaded = false;
    drawGlobe(buildAnalysis());
    return;
  }

  try {
    const response = await fetch(WORLD_ATLAS_PATH, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("The globe country dataset could not be loaded.");
    }

    const atlas = await response.json();
    const countriesObject = atlas?.objects?.countries;
    if (!countriesObject) {
      throw new Error("The globe country dataset is missing country geometry.");
    }

    globeState.countryFeatures = window.topojson.feature(atlas, countriesObject).features;
    globeState.countryGeometryLoaded = true;
    globeState.loadError = "";
  } catch (error) {
    globeState.countryFeatures = null;
    globeState.countryGeometryLoaded = false;
    globeState.loadError = error.message || "The globe country dataset could not be loaded.";
  }

  drawGlobe(buildAnalysis());
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function generateSatelliteId() {
  const id = `SAT-${state.nextId}`;
  state.nextId += 1;
  return id;
}

function generateLaunchId() {
  const id = `LAUNCH-${state.nextLaunchId}`;
  state.nextLaunchId += 1;
  return id;
}

function generateCatastropheId() {
  const id = `EVENT-${state.nextCatastropheId}`;
  state.nextCatastropheId += 1;
  return id;
}

function toCartesian(satellite) {
  const lat = (satellite.latitude * Math.PI) / 180;
  const lon = (satellite.longitude * Math.PI) / 180;
  const radius = earthRadiusKm + satellite.altitude;
  return {
    x: radius * Math.cos(lat) * Math.cos(lon),
    y: radius * Math.cos(lat) * Math.sin(lon),
    z: radius * Math.sin(lat)
  };
}

function getDistanceKm(a, b) {
  const pointA = toCartesian(a);
  const pointB = toCartesian(b);
  return Math.sqrt(
    (pointA.x - pointB.x) ** 2 +
    (pointA.y - pointB.y) ** 2 +
    (pointA.z - pointB.z) ** 2
  );
}

function getClosestSatellites() {
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
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);

    return { satellite, neighbors };
  });
}

function analyzeRegions() {
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
  }).sort((a, b) => b.pressureScore - a.pressureScore);
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

  if (regionInsight.pressureScore > 70) {
    score += 14;
    signals.push("regional traffic pressure is elevated");
  } else if (regionInsight.pressureScore > 45) {
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

function buildAnalysis() {
  const closest = getClosestSatellites();
  const regions = analyzeRegions();

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
  }).sort((a, b) => b.risk.score - a.risk.score);

  const selectedEntry = riskEntries.find((entry) => entry.satellite.id === state.selectedSatelliteId) || riskEntries[0] || null;
  if (selectedEntry) {
    state.selectedSatelliteId = selectedEntry.satellite.id;
  } else {
    state.selectedSatelliteId = null;
  }

  return { closest, regions, riskEntries, selectedEntry };
}

function getSatelliteByExactName(name) {
  const normalized = name.trim().toLowerCase();
  return state.satellites.find((satellite) => satellite.name.trim().toLowerCase() === normalized) || null;
}

function pushChangeAlerts(alerts) {
  state.changeAlerts = [...alerts, ...state.changeAlerts].slice(0, 25);
}

function formatChangeValue(key, value) {
  if (["latitude", "longitude", "velocity", "inclination"].includes(key)) {
    return Number(value).toFixed(2);
  }
  if (key === "altitude") {
    return `${value} km`;
  }
  return String(value);
}

function collectSatelliteChanges(existingSatellite, submittedSatellite) {
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
    timestamp
  }));
}

function truncateText(text, maxLength = 110) {
  const normalized = String(text).trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function getLaunchCountdown(dateString) {
  const target = new Date(`${dateString}T00:00:00`);
  const now = new Date();
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));

  if (!Number.isFinite(diff)) return "Unknown schedule";
  if (diff > 1) return `${diff} days remaining`;
  if (diff === 1) return "Launches tomorrow";
  if (diff === 0) return "Launches today";
  return `${Math.abs(diff)} days overdue`;
}

function buildNewsFeedItems(analysis) {
  const items = [];

  [...state.catastrophes]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 2)
    .forEach((event) => {
      items.push({
        tag: "Incident",
        level: event.severity,
        time: event.date,
        title: event.name,
        text: truncateText(`${event.type} recorded. ${event.notes}`)
      });
    });

  analysis.riskEntries.slice(0, 2).forEach((entry) => {
    items.push({
      tag: "Live Alert",
      level: entry.risk.level.toLowerCase(),
      time: "Now",
      title: `${entry.satellite.name} risk ${entry.risk.score}/100`,
      text: truncateText(`${entry.risk.signals[0]}. Region ${entry.satellite.region}. Nearest object at ${entry.nearestDistance ? entry.nearestDistance.toFixed(0) : "N/A"} km.`)
    });
  });

  state.changeAlerts.slice(0, 2).forEach((alert) => {
    items.push({
      tag: "Change",
      level: alert.severity,
      time: alert.timestamp,
      title: alert.title,
      text: truncateText(alert.message)
    });
  });

  [...state.launches]
    .sort((a, b) => new Date(a.launchDate) - new Date(b.launchDate))
    .slice(0, 2)
    .forEach((launch) => {
      items.push({
        tag: "Launch",
        level: "low",
        time: getLaunchCountdown(launch.launchDate),
        title: `${launch.name} scheduled`,
        text: truncateText(`${launch.launchDate} from ${launch.launchSite} for a ${launch.mission.toLowerCase()} mission in ${launch.region}.`)
      });
    });

  if (!items.length) {
    return [
      {
        tag: "System",
        level: "low",
        time: "Ready",
        title: "Tracker is online",
        text: "Add live satellites, future launches or incident logs to populate the mission news feed."
      },
      {
        tag: "Launch",
        level: "low",
        time: "Queue",
        title: "Future mission desk is empty",
        text: "Use the launch tracker to keep upcoming satellites visible before they enter orbit."
      },
      {
        tag: "Incident",
        level: "medium",
        time: "Watch",
        title: "No catastrophe alerts logged",
        text: "Record collisions, debris fields and solar-storm events here to keep operations context in one place."
      }
    ];
  }

  return items.slice(0, 6);
}

function renderNewsFeed(analysis) {
  coverNewsFeed.innerHTML = buildNewsFeedItems(analysis).map((item) => `
    <article class="news-feed-item">
      <div class="news-feed-top">
        <span class="news-feed-tag ${item.level}">${escapeHtml(item.tag)}</span>
        <span class="news-feed-time">${escapeHtml(item.time)}</span>
      </div>
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.text)}</p>
    </article>
  `).join("");
}

function renderLaunches() {
  if (!state.launches.length) {
    launchList.innerHTML = '<article class="stack-item"><strong>No future launches tracked</strong><p>Add planned satellites here to maintain a launch pipeline alongside live orbital traffic.</p></article>';
    return;
  }

  launchList.innerHTML = [...state.launches]
    .sort((a, b) => new Date(a.launchDate) - new Date(b.launchDate))
    .map((launch) => `
      <article class="stack-item">
        <div class="item-header">
          <div>
            <strong>${escapeHtml(launch.name)} <span class="badge low">${escapeHtml(launch.id)}</span></strong>
            <p>${escapeHtml(launch.operator)} | ${escapeHtml(launch.launchSite)} | ${escapeHtml(launch.region)}</p>
          </div>
          <button class="item-delete-btn" data-delete-launch="${escapeHtml(launch.id)}" type="button">Delete</button>
        </div>
        <p>Planned for ${escapeHtml(launch.launchDate)}. ${escapeHtml(getLaunchCountdown(launch.launchDate))}. Mission: ${escapeHtml(launch.mission)}.</p>
      </article>
    `).join("");
}

function renderCatastrophes() {
  if (!state.catastrophes.length) {
    catastropheList.innerHTML = '<article class="stack-item"><strong>No catastrophe entries</strong><p>Log major space incidents here to keep launch, traffic and debris awareness in one dashboard.</p></article>';
    return;
  }

  catastropheList.innerHTML = [...state.catastrophes]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((event) => `
      <article class="stack-item">
        <div class="item-header">
          <div>
            <strong>${escapeHtml(event.name)} <span class="badge ${event.severity}">${escapeHtml(event.type)}</span></strong>
            <p>${escapeHtml(event.date)} | Severity ${escapeHtml(event.severity)}</p>
          </div>
          <button class="item-delete-btn" data-delete-catastrophe="${escapeHtml(event.id)}" type="button">Delete</button>
        </div>
        <p>${escapeHtml(event.notes)}</p>
      </article>
    `).join("");
}

function buildTimelineProjection(analysis) {
  if (!analysis.riskEntries.length) {
    return {
      points: [0, 0, 0, 0, 0, 0],
      labels: ["Now", "+5m", "+10m", "+15m", "+20m", "+25m"],
      peakScore: 0,
      peakLabel: "Now"
    };
  }

  const baseline = analysis.regions.reduce((sum, region) => sum + region.pressureScore, 0) / Math.max(analysis.regions.length, 1);
  const points = Array.from({ length: 6 }, (_, index) => {
    const drift = [0, 6, 11, 8, 14, 10][index];
    const alertWeight = analysis.riskEntries.slice(0, 3).reduce((sum, entry) => sum + entry.risk.score, 0) / 12;
    return Math.min(100, Math.round(baseline * 0.55 + alertWeight + drift));
  });
  const labels = ["Now", "+5m", "+10m", "+15m", "+20m", "+25m"];
  const peakScore = Math.max(...points, 0);
  const peakIndex = points.indexOf(peakScore);

  return {
    points,
    labels,
    peakScore,
    peakLabel: labels[Math.max(peakIndex, 0)]
  };
}

function renderHeroHighlights(analysis) {
  const topRisk = analysis.riskEntries[0];
  const latestChange = state.changeAlerts[0];
  const nextLaunch = [...state.launches].sort((a, b) => new Date(a.launchDate) - new Date(b.launchDate))[0];
  const latestCatastrophe = [...state.catastrophes].sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  heroHighlights.innerHTML = [
    {
      title: "Conflict Watch",
      text: topRisk
        ? `${topRisk.satellite.name} is currently the highest-risk object at ${topRisk.risk.score}/100.`
        : "Collision scoring activates as soon as satellites are added."
    },
    {
      title: "Parameter Tracking",
      text: latestChange
        ? latestChange.message
        : "Resubmit the same satellite name to log altitude or status changes automatically."
    },
    {
      title: "Region Awareness",
      text: analysis.regions.length
        ? `${analysis.regions.length} active region bucket(s) are being monitored across the globe.`
        : "Regional pressure indicators appear after the first tracked object is added."
    },
    {
      title: "Busiest Regions",
      text: analysis.regions.length
        ? `${analysis.regions[0].region} currently has the highest satellite activity with ${analysis.regions[0].count} tracked satellite(s).`
        : "Busiest-region rankings appear after satellites are added."
    },
    {
      title: "Future Launches",
      text: nextLaunch
        ? `${nextLaunch.name} is queued for ${nextLaunch.launchDate} from ${nextLaunch.launchSite}.`
        : "The launch tracker is ready for satellites that have not flown yet."
    },
    {
      title: "Catastrophe Watch",
      text: latestCatastrophe
        ? `${latestCatastrophe.name} is the latest logged incident at ${latestCatastrophe.severity} severity.`
        : "Use the catastrophe tracker to monitor collisions, debris fields and solar-storm impacts."
    }
  ].map((item) => `
    <article class="hero-highlight-card">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.text)}</p>
    </article>
  `).join("");
}

function renderCoverSignals(analysis) {
  const projection = buildTimelineProjection(analysis);
  const topRegion = analysis.regions[0];
  const latestChange = state.changeAlerts[0];
  const highRiskCount = analysis.riskEntries.filter((entry) => entry.risk.level === "High").length;
  const nextLaunch = [...state.launches].sort((a, b) => new Date(a.launchDate) - new Date(b.launchDate))[0];
  const catastropheCount = state.catastrophes.length;

  coverSignalGrid.innerHTML = [
    {
      title: "Peak Pressure Forecast",
      text: `${projection.peakScore}/100 expected by ${projection.peakLabel}.`
    },
    {
      title: "Top Region",
      text: topRegion
        ? `${topRegion.region} is the busiest region at ${topRegion.pressureScore}/100 pressure.`
        : "No active region pressure yet."
    },
    {
      title: "Latest Watch Signal",
      text: latestChange
        ? `${latestChange.satelliteName}: ${latestChange.field} update logged.`
        : highRiskCount
          ? `${highRiskCount} high-risk collision alert(s) currently need review.`
          : "No urgent signals yet. Add or update satellites to populate the watch feed."
    },
    {
      title: "Next Launch Window",
      text: nextLaunch
        ? `${nextLaunch.name} is ${getLaunchCountdown(nextLaunch.launchDate).toLowerCase()}.`
        : "No scheduled launches are in the queue."
    },
    {
      title: "Incident Tracker",
      text: catastropheCount
        ? `${catastropheCount} catastrophe event(s) are logged for operator review.`
        : "No catastrophe entries are currently logged."
    }
  ].map((item) => `
    <article class="cover-signal-card">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.text)}</p>
    </article>
  `).join("");
}

function renderOperationsWatchlist(analysis) {
  if (!analysis.riskEntries.length && !state.catastrophes.length) {
    operationsWatchlist.innerHTML = '<article class="stack-item"><strong>No watchlist entries</strong><p>The operations queue fills automatically once tracked satellites generate risk or change activity.</p></article>';
    return;
  }

  const latestChangeBySatellite = new Map(
    state.changeAlerts.map((alert) => [alert.satelliteId, alert])
  );
  const riskEntries = analysis.riskEntries.slice(0, 3).map((entry) => {
    const latestChange = latestChangeBySatellite.get(entry.satellite.id);
    const watchReason = latestChange
      ? `Latest update: ${latestChange.message}`
      : `Primary risk signal: ${entry.risk.signals[0]}.`;

    return `
      <article class="stack-item">
        <strong>${escapeHtml(entry.satellite.name)} <span class="badge ${entry.risk.level.toLowerCase()}">${entry.risk.level} Watch</span></strong>
        <p>${escapeHtml(watchReason)} Region ${escapeHtml(entry.satellite.region)}. Nearest object at ${entry.nearestDistance ? entry.nearestDistance.toFixed(0) : "N/A"} km.</p>
      </article>
    `;
  });
  const catastropheEntries = state.catastrophes
    .slice(0, 2)
    .map((event) => `
      <article class="stack-item">
        <strong>${escapeHtml(event.name)} <span class="badge ${event.severity}">Incident</span></strong>
        <p>${escapeHtml(event.type)} logged on ${escapeHtml(event.date)}. ${escapeHtml(event.notes)}</p>
      </article>
    `);

  operationsWatchlist.innerHTML = [...riskEntries, ...catastropheEntries].join("");
}

function renderGlobeModal(analysis) {
  const selectedName = analysis.selectedEntry ? escapeHtml(analysis.selectedEntry.satellite.name) : "None";
  const activeAlerts = analysis.riskEntries.filter((entry) => entry.risk.level === "High").length + state.changeAlerts.length;
  const topRegion = analysis.regions[0]?.region ? escapeHtml(analysis.regions[0].region) : "No active region";

  globeModalBody.innerHTML = `
    <article class="roadmap-item">
      <h3>Current Viewer State</h3>
      <p>Selected target: ${selectedName}. High-risk alerts: ${activeAlerts}. Top pressure region: ${topRegion}.</p>
    </article>
    <article class="roadmap-item">
      <h3>How to Use It</h3>
      <p>Drag the globe to rotate Earth, inspect the country outlines against the 15-degree latitude and longitude grid, then add or update satellites from the registry form.</p>
    </article>
    <article class="roadmap-item">
      <h3>What Changed</h3>
      <p>The globe now renders local country geometry and graticules, and the page reflects only satellites saved in the registry instead of any external import feed.</p>
    </article>
  `;
}

function renderOverview(analysis) {
  const satelliteCount = state.satellites.length;
  const avgAltitude = satelliteCount ? state.satellites.reduce((sum, item) => sum + item.altitude, 0) / satelliteCount : 0;
  const avgVelocity = satelliteCount ? state.satellites.reduce((sum, item) => sum + item.velocity, 0) / satelliteCount : 0;
  const topRegion = analysis.regions[0] || null;
  const highestRisk = analysis.riskEntries[0] || null;

  overviewCards.innerHTML = `
    <article class="overview-card">
      <strong>${satelliteCount}</strong>
      <p>Satellites currently registered in the optimization system.</p>
    </article>
    <article class="overview-card">
      <strong>${avgAltitude.toFixed(0)} km</strong>
      <p>Average orbital altitude across the active fleet.</p>
    </article>
    <article class="overview-card">
      <strong>${topRegion ? escapeHtml(topRegion.region) : "None"}</strong>
      <p>Highest region pressure at ${topRegion ? topRegion.pressureScore : 0}/100.</p>
    </article>
    <article class="overview-card">
      <strong>${avgVelocity.toFixed(2)} km/s</strong>
      <p>Average fleet velocity${highestRisk ? ` with top alert on ${escapeHtml(highestRisk.satellite.name)}` : " across the active fleet"}.</p>
    </article>
  `;
}

function renderSelectedSatellite(entry) {
  if (!entry) {
    selectedSatelliteCard.innerHTML = "<p>No satellite selected.</p>";
    return;
  }

  const nearest = entry.nearest;
  const sourceLabel = entry.satellite.source && entry.satellite.source !== "manual"
    ? "Imported registry entry"
    : "Manual entry";

  selectedSatelliteCard.innerHTML = `
    <h3>${escapeHtml(entry.satellite.name)}</h3>
    <p>${escapeHtml(entry.satellite.id)} | ${escapeHtml(entry.satellite.operator)}</p>
    <div class="selected-meta">
      <div class="meta-item">
        <span>Mission</span>
        <strong>${escapeHtml(entry.satellite.mission)}</strong>
      </div>
      <div class="meta-item">
        <span>Risk Level</span>
        <strong>${entry.risk.level} (${entry.risk.score}/100)</strong>
      </div>
      <div class="meta-item">
        <span>Region</span>
        <strong>${escapeHtml(entry.satellite.region)}</strong>
      </div>
      <div class="meta-item">
        <span>Nearest Object</span>
        <strong>${nearest ? `${escapeHtml(nearest.target.name)} (${nearest.distance.toFixed(0)} km)` : "None"}</strong>
      </div>
      <div class="meta-item">
        <span>Orbit</span>
        <strong>${entry.satellite.altitude} km | ${entry.satellite.inclination.toFixed(1)} deg</strong>
      </div>
      <div class="meta-item">
        <span>Signal</span>
        <strong>${escapeHtml(entry.risk.signals[0])}</strong>
      </div>
      <div class="meta-item">
        <span>Source</span>
        <strong>${sourceLabel}</strong>
      </div>
    </div>
    <div class="panel-actions">
      <button class="secondary-btn danger" data-delete-satellite="${escapeHtml(entry.satellite.id)}" type="button">Delete This Satellite</button>
    </div>
  `;
}

function renderTable(analysis) {
  if (!analysis.riskEntries.length) {
    satelliteTableBody.innerHTML = `
      <tr>
        <td colspan="9">No satellites registered yet.</td>
      </tr>
    `;
    return;
  }

  satelliteTableBody.innerHTML = analysis.riskEntries.map((entry) => `
    <tr class="${entry.satellite.id === state.selectedSatelliteId ? "is-selected" : ""}">
      <td>${escapeHtml(entry.satellite.id)}</td>
      <td><button class="table-row-button" data-select-satellite="${escapeHtml(entry.satellite.id)}" type="button">${escapeHtml(entry.satellite.name)}</button></td>
      <td>${escapeHtml(entry.satellite.operator)}</td>
      <td>${escapeHtml(entry.satellite.mission)}</td>
      <td>${escapeHtml(entry.satellite.region)}</td>
      <td>${entry.satellite.altitude} km</td>
      <td>${escapeHtml(entry.satellite.status)}</td>
      <td><span class="badge ${entry.risk.level.toLowerCase()}">${entry.risk.level}</span></td>
      <td><button class="table-action-btn" data-delete-satellite="${escapeHtml(entry.satellite.id)}" type="button">Delete</button></td>
    </tr>
  `).join("");
}

function renderDistances(analysis) {
  if (!analysis.closest.length) {
    distanceList.innerHTML = '<article class="stack-item"><strong>No distance data</strong><p>Add at least two satellites to compare nearby orbital spacing.</p></article>';
    return;
  }

  distanceList.innerHTML = analysis.closest.map((entry) => `
    <article class="stack-item">
      <strong>${escapeHtml(entry.satellite.name)} <span class="badge low">${escapeHtml(entry.satellite.id)}</span></strong>
      <p>${entry.neighbors.map((neighbor) => `${escapeHtml(neighbor.target.name)}: ${neighbor.distance.toFixed(0)} km, alt gap ${neighbor.altitudeGap.toFixed(0)} km`).join(" | ")}</p>
    </article>
  `).join("");
}

function renderCrowding(analysis) {
  if (!analysis.regions.length) {
    crowdingList.innerHTML = '<article class="stack-item"><strong>No regions active</strong><p>Region pressure appears here after satellites are added to the registry.</p></article>';
    return;
  }

  crowdingList.innerHTML = analysis.regions.map((region) => `
    <article class="stack-item">
      <strong>${escapeHtml(region.region)} <span class="badge ${region.crowded ? "high" : "low"}">${region.crowded ? "Crowded" : "Stable"}</span></strong>
      <p>Pressure ${region.pressureScore}/100. ${escapeHtml(region.reasons.join(". "))}.</p>
    </article>
  `).join("");
}

function renderRisks(analysis) {
  const highAlerts = analysis.riskEntries.filter((entry) => entry.risk.level === "High");
  if (!analysis.riskEntries.length) {
    riskList.innerHTML = '<article class="stack-item"><strong>No collision alerts</strong><p>Add satellites to start AI-assisted proximity and risk analysis.</p></article>';
    return;
  }

  riskList.innerHTML = analysis.riskEntries.map((entry) => `
    <article class="stack-item">
      <strong>${escapeHtml(entry.satellite.name)} <span class="badge ${entry.risk.level.toLowerCase()}">${entry.risk.level} Risk</span></strong>
      <p>
        AI score ${entry.risk.score}/100. Nearest object at ${entry.nearestDistance ? entry.nearestDistance.toFixed(0) : "N/A"} km.
        Main trigger: ${escapeHtml(entry.risk.signals[0])}.
      </p>
    </article>
  `).join("");

}

function renderChangeAlerts() {
  if (!state.changeAlerts.length) {
    changeAlertList.innerHTML = '<article class="stack-item"><strong>No parameter changes yet</strong><p>Update an existing satellite by submitting the same name again to log altitude or parameter alerts.</p></article>';
    return;
  }

  changeAlertList.innerHTML = state.changeAlerts.map((alert) => `
    <article class="stack-item">
      <div class="item-header">
        <div>
          <strong>${escapeHtml(alert.title)} <span class="badge ${alert.severity}">${alert.severity === "high" ? "Priority" : "Tracked"}</span></strong>
          <p>${escapeHtml(alert.message)} Logged at ${escapeHtml(alert.timestamp)}.</p>
        </div>
        <button class="item-delete-btn" data-delete-change-alert="${escapeHtml(alert.id)}" type="button">Delete</button>
      </div>
    </article>
  `).join("");
}

function renderGlobe(analysis) {
  if (globeState.loadError) {
    globeStatus.textContent = globeState.loadError;
  } else if (!globeState.countryGeometryLoaded) {
    globeStatus.textContent = "Loading the country-outline globe with 15-degree latitude and longitude lines.";
  } else if (analysis.selectedEntry) {
    globeStatus.textContent = `${analysis.selectedEntry.satellite.name} is selected. Drag to rotate the country-outline globe and compare the satellite position against the latitude and longitude grid.`;
  } else {
    globeStatus.textContent = "Drag to rotate the country-outline globe. Latitude and longitude lines are shown every 15 degrees.";
  }

  drawGlobe(analysis);
}

function resizeGlobeCanvas() {
  const rect = globeCanvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width * pixelRatio));
  const height = Math.max(320, Math.floor(rect.height * pixelRatio));

  if (globeCanvas.width !== width || globeCanvas.height !== height) {
    globeCanvas.width = width;
    globeCanvas.height = height;
  }
}

function getGlobePalette() {
  if (state.theme === "light") {
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

function drawGlobeFallbackState(context, width, height, message, palette) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "rgba(255, 255, 255, 0.03)";
  context.fillRect(0, 0, width, height);
  context.fillStyle = palette.label;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `${Math.max(14, width * 0.024)}px Bahnschrift`;
  context.fillText(message, width / 2, height / 2);
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

function projectSatelliteMarker(projection, satellite, centerX, centerY) {
  const surfacePoint = projection([satellite.longitude, satellite.latitude]);
  if (!surfacePoint) {
    return null;
  }

  const visibleCenter = projection.invert([centerX, centerY]);
  if (!visibleCenter) {
    return null;
  }

  const angularDistance = window.d3.geoDistance(
    [satellite.longitude, satellite.latitude],
    visibleCenter
  );

  if (angularDistance > (Math.PI / 2) - 0.0001) {
    return null;
  }

  return {
    x: surfacePoint[0],
    y: surfacePoint[1]
  };
}

function drawGlobe(analysis) {
  resizeGlobeCanvas();

  const context = globeCanvas.getContext("2d");
  const width = globeCanvas.width;
  const height = globeCanvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.31;
  const palette = getGlobePalette();

  context.clearRect(0, 0, width, height);

  const background = context.createRadialGradient(centerX * 0.82, centerY * 0.76, radius * 0.24, centerX, centerY, radius * 1.9);
  background.addColorStop(0, palette.atmosphereStart);
  background.addColorStop(0.58, state.theme === "light" ? "rgba(132, 184, 227, 0.26)" : "rgba(11, 42, 81, 0.95)");
  background.addColorStop(1, palette.atmosphereEnd);
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  if (!window.d3) {
    globeState.visibleMarkers = [];
    hideGlobeTooltip();
    drawGlobeFallbackState(context, width, height, "Globe renderer is unavailable.", palette);
    return;
  }

  if (!globeState.countryGeometryLoaded || !globeState.countryFeatures?.length) {
    globeState.visibleMarkers = [];
    hideGlobeTooltip();
    drawGlobeFallbackState(
      context,
      width,
      height,
      globeState.loadError || "Loading country outlines...",
      palette
    );
    return;
  }

  const projection = buildGlobeProjection(width, height);
  const path = window.d3.geoPath(projection, context);
  const sphere = { type: "Sphere" };
  const graticule = window.d3.geoGraticule().step([GLOBE_GRATICULE_STEP, GLOBE_GRATICULE_STEP])();
  const axisLines = {
    type: "MultiLineString",
    coordinates: [
      [[-180, 0], [180, 0]],
      [[0, -90], [0, 90]]
    ]
  };

  const oceanGradient = context.createRadialGradient(
    centerX - radius * 0.24,
    centerY - radius * 0.34,
    radius * 0.12,
    centerX,
    centerY,
    radius * 1.02
  );
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

  context.beginPath();
  path(axisLines);
  context.strokeStyle = palette.axis;
  context.lineWidth = Math.max(1.1, radius * 0.0054);
  context.stroke();
  context.restore();

  const renderedSatellites = analysis.riskEntries
    .map((entry) => ({
      entry,
      radius: entry.satellite.id === state.selectedSatelliteId ? 7.5 : 5.2,
      marker: projectSatelliteMarker(projection, entry.satellite, centerX, centerY)
    }))
    .filter((item) => item.marker);

  context.save();
  context.beginPath();
  path(sphere);
  context.clip();

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

    if (entry.satellite.id === state.selectedSatelliteId) {
      context.beginPath();
      context.arc(marker.x, marker.y, markerRadius + 4, 0, Math.PI * 2);
      context.strokeStyle = palette.label;
      context.lineWidth = 1.5;
      context.stroke();
    }
  });
  context.restore();

  globeState.visibleMarkers = renderedSatellites.map(({ entry, marker, radius: markerRadius }) => ({
    satellite: entry.satellite,
    risk: entry.risk,
    x: marker.x,
    y: marker.y,
    radius: markerRadius
  }));

  const labeledSatellites = renderedSatellites.filter(({ entry }, index) =>
    entry.satellite.id === state.selectedSatelliteId || entry.risk.level !== "Low" || index < 3
  );

  context.fillStyle = palette.label;
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.font = `${Math.max(11, radius * 0.07)}px Bahnschrift`;
  labeledSatellites.forEach(({ entry, marker }) => {
    context.fillText(entry.satellite.name, marker.x + 12, marker.y - 10);
  });

  context.beginPath();
  path(sphere);
  context.lineWidth = Math.max(1.5, radius * 0.01);
  context.strokeStyle = palette.outline;
  context.stroke();

  context.font = `${Math.max(10, radius * 0.056)}px Bahnschrift`;
  context.fillStyle = palette.label;
  context.textAlign = "right";
  context.fillText("15° latitude / longitude grid", width - radius * 0.08, height - radius * 0.05);
}

function renderRegionChart(analysis) {
  if (!analysis.regions.length) {
    regionChart.innerHTML = '<div class="stack-item"><strong>No region data</strong><p>Region distribution appears after you add satellites.</p></div>';
    return;
  }

  const maxCount = Math.max(...analysis.regions.map((region) => region.count), 1);
  regionChart.innerHTML = analysis.regions.map((region) => `
    <div class="bar-row">
      <div class="bar-label">${escapeHtml(region.region)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(region.count / maxCount) * 100}%"></div></div>
      <div>${region.count}</div>
    </div>
  `).join("");
}

function renderAltitudeChart() {
  const bands = [
    { label: "LEO", count: state.satellites.filter((item) => item.altitude < 2000).length },
    { label: "MEO", count: state.satellites.filter((item) => item.altitude >= 2000 && item.altitude < 35786).length },
    { label: "GEO+", count: state.satellites.filter((item) => item.altitude >= 35786).length }
  ];
  const maxCount = Math.max(...bands.map((band) => band.count), 1);

  altitudeChart.innerHTML = bands.map((band) => `
    <div class="band-row">
      <div class="band-label">${band.label}</div>
      <div class="band-track"><div class="band-fill" style="width:${(band.count / maxCount) * 100}%"></div></div>
      <div>${band.count}</div>
    </div>
  `).join("");
}

function renderBusiestRegions(analysis) {
  const busiestRegions = [...analysis.regions]
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      return b.pressureScore - a.pressureScore;
    })
    .slice(0, 6);

  timelineSummary.textContent = busiestRegions.length
    ? `${busiestRegions[0].region} has the top satellite activity right now with ${busiestRegions[0].count} satellite(s) in that region.`
    : "Add satellites to see which regions have the highest activity.";

  if (!busiestRegions.length) {
    timelineChart.innerHTML = '<article class="stack-item"><strong>No busy regions yet</strong><p>Tracked satellites will populate the busiest-region view automatically.</p></article>';
    return;
  }

  timelineChart.innerHTML = busiestRegions.map((region) => `
    <article class="stack-item">
      <strong>${escapeHtml(region.region)} <span class="badge ${region.count >= 3 ? "high" : region.count === 2 ? "medium" : "low"}">${region.count} satellite(s)</span></strong>
      <p>Pressure ${region.pressureScore}/100. ${escapeHtml(region.reasons[0])}.</p>
    </article>
  `).join("");
}

function renderMetrics(analysis) {
  metricTotal.textContent = state.satellites.length;
  metricCrowded.textContent = analysis.regions.filter((region) => region.crowded).length;
  metricAlerts.textContent =
    analysis.riskEntries.filter((entry) => entry.risk.level === "High").length +
    state.changeAlerts.length +
    state.catastrophes.length;
}

function render() {
  const analysis = buildAnalysis();
  renderHeroHighlights(analysis);
  renderNewsFeed(analysis);
  renderOverview(analysis);
  renderSelectedSatellite(analysis.selectedEntry);
  renderTable(analysis);
  renderDistances(analysis);
  renderCrowding(analysis);
  renderRisks(analysis);
  renderChangeAlerts();
  renderOperationsWatchlist(analysis);
  renderGlobe(analysis);
  renderCoverSignals(analysis);
  renderRegionChart(analysis);
  renderAltitudeChart();
  renderBusiestRegions(analysis);
  renderMetrics(analysis);
  renderCorridorList(analysis);
  renderLaunches();
  renderCatastrophes();
  renderGlobeModal(analysis);
  applyTheme(state.theme);
  saveState();
}

function setSelectedSatellite(id) {
  state.selectedSatelliteId = id;
  render();
}

function deleteSatelliteById(id) {
  state.satellites = state.satellites.filter((satellite) => satellite.id !== id);
  state.changeAlerts = state.changeAlerts.filter((alert) => alert.satelliteId !== id);
  if (state.selectedSatelliteId === id) {
    state.selectedSatelliteId = state.satellites[0]?.id || null;
  }
  render();
}

function clearSatelliteRegistry() {
  state.satellites = [];
  state.selectedSatelliteId = null;
  state.changeAlerts = [];
  satelliteForm.reset();
  regionInput.value = "";
  render();
}

function deleteLaunchById(id) {
  state.launches = state.launches.filter((launch) => launch.id !== id);
  render();
}

function clearLaunchTracker() {
  state.launches = [];
  launchForm.reset();
  launchRegionInput.value = "";
  render();
}

function deleteChangeAlertById(id) {
  state.changeAlerts = state.changeAlerts.filter((alert) => alert.id !== id);
  render();
}

function clearChangeAlerts() {
  state.changeAlerts = [];
  render();
}

function deleteCatastropheById(id) {
  state.catastrophes = state.catastrophes.filter((event) => event.id !== id);
  render();
}

function clearCatastropheTracker() {
  state.catastrophes = [];
  catastropheForm.reset();
  render();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const latitude = Number(document.getElementById("sat-lat").value);
  const longitude = Number(document.getElementById("sat-lon").value);
  const region = getWorldRegion(latitude, longitude);
  const submittedName = document.getElementById("sat-name").value.trim();

  const satellite = {
    id: "",
    name: submittedName,
    operator: document.getElementById("sat-operator").value.trim(),
    latitude,
    longitude,
    altitude: Number(document.getElementById("sat-alt").value),
    velocity: Number(document.getElementById("sat-velocity").value),
    region,
    status: document.getElementById("sat-status").value,
    inclination: Number(document.getElementById("sat-inclination").value),
    mission: document.getElementById("sat-mission").value
  };

  const existingSatellite = getSatelliteByExactName(submittedName);

  if (existingSatellite) {
    const alerts = collectSatelliteChanges(existingSatellite, satellite);
    Object.assign(existingSatellite, satellite, { id: existingSatellite.id });
    pushChangeAlerts(alerts);
    state.selectedSatelliteId = existingSatellite.id;
  } else {
    satellite.id = generateSatelliteId();
    state.satellites.unshift(satellite);
    state.selectedSatelliteId = satellite.id;
  }

  form.reset();
  regionInput.value = "";
  render();
});

launchForm.addEventListener("submit", (event) => {
  event.preventDefault();

  state.launches.unshift({
    id: generateLaunchId(),
    name: document.getElementById("launch-name").value.trim(),
    operator: document.getElementById("launch-operator").value.trim(),
    launchDate: document.getElementById("launch-date").value,
    launchSite: document.getElementById("launch-site").value.trim(),
    region: document.getElementById("launch-region").value,
    mission: document.getElementById("launch-mission").value
  });

  launchForm.reset();
  launchRegionInput.value = "";
  render();
});

catastropheForm.addEventListener("submit", (event) => {
  event.preventDefault();

  state.catastrophes.unshift({
    id: generateCatastropheId(),
    name: document.getElementById("catastrophe-name").value.trim(),
    date: document.getElementById("catastrophe-date").value,
    type: document.getElementById("catastrophe-type").value,
    severity: document.getElementById("catastrophe-severity").value,
    notes: document.getElementById("catastrophe-notes").value.trim()
  });

  catastropheForm.reset();
  render();
});

function updateDetectedRegion() {
  const latitude = Number(document.getElementById("sat-lat").value);
  const longitude = Number(document.getElementById("sat-lon").value);

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    regionInput.value = getWorldRegion(latitude, longitude);
  }
}
if (themeToggleButton) {
  themeToggleButton.addEventListener("click", () => {
    applyTheme(state.theme === "light" ? "dark" : "light");
    saveState();
  });
}
globeInfoTrigger.addEventListener("click", () => {
  globeModal.classList.remove("hidden");
  globeModal.setAttribute("aria-hidden", "false");
});

function closeGlobeModal() {
  globeModal.classList.add("hidden");
  globeModal.setAttribute("aria-hidden", "true");
}

globeModalClose.addEventListener("click", closeGlobeModal);
globeModal.addEventListener("click", (event) => {
  if (event.target.dataset.closeModal === "true") {
    closeGlobeModal();
  }
});

document.getElementById("sat-lat").addEventListener("input", updateDetectedRegion);
document.getElementById("sat-lon").addEventListener("input", updateDetectedRegion);

document.addEventListener("click", (event) => {
  const selectSatelliteButton = event.target.closest("[data-select-satellite]");
  if (selectSatelliteButton) {
    setSelectedSatellite(selectSatelliteButton.dataset.selectSatellite);
    return;
  }

  const deleteSatelliteButton = event.target.closest("[data-delete-satellite]");
  if (deleteSatelliteButton) {
    deleteSatelliteById(deleteSatelliteButton.dataset.deleteSatellite);
    return;
  }

  const deleteLaunchButton = event.target.closest("[data-delete-launch]");
  if (deleteLaunchButton) {
    deleteLaunchById(deleteLaunchButton.dataset.deleteLaunch);
    return;
  }

  const deleteChangeAlertButton = event.target.closest("[data-delete-change-alert]");
  if (deleteChangeAlertButton) {
    deleteChangeAlertById(deleteChangeAlertButton.dataset.deleteChangeAlert);
    return;
  }

  const deleteCatastropheButton = event.target.closest("[data-delete-catastrophe]");
  if (deleteCatastropheButton) {
    deleteCatastropheById(deleteCatastropheButton.dataset.deleteCatastrophe);
  }
});

clearSatellitesButton.addEventListener("click", clearSatelliteRegistry);
clearChangeAlertsButton.addEventListener("click", clearChangeAlerts);
clearLaunchesButton.addEventListener("click", clearLaunchTracker);
clearCatastrophesButton.addEventListener("click", clearCatastropheTracker);

globeCanvas.addEventListener("pointerdown", (event) => {
  globeState.dragging = true;
  globeState.pointerX = event.clientX;
  globeState.pointerY = event.clientY;
  hideGlobeTooltip();
  globeCanvas.setPointerCapture(event.pointerId);
});

globeCanvas.addEventListener("pointermove", (event) => {
  if (!globeState.dragging) {
    const hoveredMarker = findHoveredSatelliteMarker(event);
    if (hoveredMarker) {
      showGlobeTooltip(hoveredMarker, event);
    } else {
      hideGlobeTooltip();
    }
    return;
  }

  const deltaX = event.clientX - globeState.pointerX;
  const deltaY = event.clientY - globeState.pointerY;
  globeState.pointerX = event.clientX;
  globeState.pointerY = event.clientY;
  globeState.rotationY -= deltaX * 0.006;
  globeState.rotationX = Math.max(-1.2, Math.min(1.2, globeState.rotationX + deltaY * 0.006));
  hideGlobeTooltip();
  renderGlobe(buildAnalysis());
});

function stopGlobeDrag(event) {
  globeState.dragging = false;
  hideGlobeTooltip();
  if (event) {
    globeCanvas.releasePointerCapture(event.pointerId);
  }
}

globeCanvas.addEventListener("pointerup", stopGlobeDrag);
globeCanvas.addEventListener("pointerleave", () => {
  globeState.dragging = false;
  hideGlobeTooltip();
});

function animateGlobe() {
  if (!globeState.dragging && !globeCanvas.matches(":hover")) {
    globeState.rotationY -= 0.0008;
    drawGlobe(buildAnalysis());
  }
  globeState.animationFrame = requestAnimationFrame(animateGlobe);
}

window.addEventListener("resize", () => drawGlobe(buildAnalysis()));
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeGlobeModal();
  }
});

async function initialiseApp() {
  populateRegionOptions();
  updateDetectedRegion();
  startIstClock();
  loadGlobeGeometry();
  animateGlobe();
  render();
  await hydrateStateFromApi();
}

initialiseApp();
