const CHAT_API_PATH = "/api/chat";
const CHAT_OPTIONS_PATH = "/api/chat/options";
const CHAT_POSITION_KEY = "orbital-chat-position-v1";
const STATE_STORAGE_KEY = "orbital-traffic-state-v4";
const DEFAULT_CHAT_QUESTIONS = [
  "How many satellites are currently tracked?",
  "Which region is busiest right now?",
  "How many high-priority collision alerts are active?",
  "Which two satellites are currently closest?",
  "Is live API tracking connected?"
];

const chatWrapper = document.getElementById("ai-chat-wrapper");
const chatToggle = document.getElementById("chat-toggle-btn");
const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const chatQuestionSelect = document.getElementById("chat-question-select");
const chatHistory = document.getElementById("chat-history");

if (chatWrapper && chatToggle && chatWindow && chatForm && chatQuestionSelect && chatHistory) {
  restoreChatPosition();
  setupToggleDrag();
  populateQuestionOptions();
  setupChatForm();
}

function setupToggleDrag() {
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let pointerId = null;

  chatToggle.addEventListener("pointerdown", (event) => {
    dragging = true;
    moved = false;
    startX = event.clientX;
    startY = event.clientY;
    pointerId = event.pointerId;
    chatToggle.setPointerCapture(pointerId);
  });

  chatToggle.addEventListener("pointermove", (event) => {
    if (!dragging) {
      return;
    }

    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    if (!moved && Math.hypot(deltaX, deltaY) > 5) {
      moved = true;
    }

    if (moved) {
      positionChatWrapper(event.clientX, event.clientY);
    }
  });

  chatToggle.addEventListener("pointerup", () => {
    if (pointerId !== null) {
      chatToggle.releasePointerCapture(pointerId);
    }

    dragging = false;
    pointerId = null;

    if (moved) {
      saveChatPosition();
      return;
    }

    const isHidden = chatWindow.classList.toggle("hidden");
    chatToggle.setAttribute("aria-expanded", String(!isHidden));
  });
}

function positionChatWrapper(pointerX, pointerY) {
  const wrapperWidth = chatWrapper.offsetWidth || 56;
  const wrapperHeight = chatWrapper.offsetHeight || 56;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const nextLeft = Math.max(8, Math.min(viewportWidth - wrapperWidth - 8, pointerX - 26));
  const nextTop = Math.max(8, Math.min(viewportHeight - wrapperHeight - 8, pointerY - 26));

  chatWrapper.style.left = `${nextLeft}px`;
  chatWrapper.style.top = `${nextTop}px`;
  chatWrapper.style.right = "auto";
  chatWrapper.style.bottom = "auto";
}

function saveChatPosition() {
  const rect = chatWrapper.getBoundingClientRect();
  const payload = {
    left: Math.round(rect.left),
    top: Math.round(rect.top)
  };

  localStorage.setItem(CHAT_POSITION_KEY, JSON.stringify(payload));
}

function restoreChatPosition() {
  try {
    const raw = localStorage.getItem(CHAT_POSITION_KEY);
    if (!raw) {
      return;
    }

    const position = JSON.parse(raw);
    if (!Number.isFinite(position.left) || !Number.isFinite(position.top)) {
      return;
    }

    chatWrapper.style.left = `${position.left}px`;
    chatWrapper.style.top = `${position.top}px`;
    chatWrapper.style.right = "auto";
    chatWrapper.style.bottom = "auto";
  } catch (error) {
    console.error("Failed to restore chat position", error);
  }
}

function setupChatForm() {
  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = chatQuestionSelect.value.trim();
    if (!message) {
      return;
    }

    addMessage("user", message);
    chatQuestionSelect.value = "";

    const workingMessage = addMessage("bot", "Thinking...");

    try {
      const frontendState = readFrontendState();
      const uiSnapshot = getUiSnapshot();
      const backendState = await fetchBackendState();

      const response = await fetch(CHAT_API_PATH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message,
          frontendState,
          backendState,
          uiSnapshot
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "AI request failed.");
      }

      workingMessage.textContent = payload.response || "No response returned.";
    } catch (error) {
      workingMessage.textContent = `Chat unavailable. ${error.message}`;
    }
  });
}

function addMessage(role, text) {
  const item = document.createElement("div");
  item.className = `chat-msg ${role}`;
  item.textContent = text;
  chatHistory.appendChild(item);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  return item;
}

async function populateQuestionOptions() {
  let questions = [...DEFAULT_CHAT_QUESTIONS];

  try {
    const response = await fetch(CHAT_OPTIONS_PATH, {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (response.ok) {
      const payload = await response.json();
      if (Array.isArray(payload?.questions) && payload.questions.length) {
        questions = payload.questions.filter((item) => typeof item === "string" && item.trim());
      }
    }
  } catch (_error) {
    // Keep fallback options when backend options are unavailable.
  }

  const optionHtml = [
    '<option value="">Select a question</option>',
    ...questions.map((question) => `<option value="${escapeHtml(question)}">${escapeHtml(question)}</option>`)
  ].join("");

  chatQuestionSelect.innerHTML = optionHtml;
}

function readFrontendState() {
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

function getUiSnapshot() {
  return {
    metrics: {
      tracked: document.getElementById("metric-total")?.textContent?.trim() || "0",
      crowded: document.getElementById("metric-crowded")?.textContent?.trim() || "0",
      alerts: document.getElementById("metric-alerts")?.textContent?.trim() || "0"
    },
    selectedSatelliteCard: document.getElementById("selected-satellite-card")?.innerText?.slice(0, 400) || "",
    corridorCriteria: document.getElementById("corridor-criteria")?.innerText?.slice(0, 450) || ""
  };
}

async function fetchBackendState() {
  try {
    const response = await fetch("/api/state", {
      headers: {
        Accept: "application/json"
      }
    });
    if (!response.ok) {
      return {};
    }
    return response.json();
  } catch (error) {
    return {};
  }
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
