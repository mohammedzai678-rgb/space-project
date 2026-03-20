async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}.`);
  }

  return payload;
}

export function getState() {
  return requestJson("/api/state");
}

export function updateState(state, action, details = {}) {
  return requestJson("/api/state", {
    method: "PUT",
    body: JSON.stringify({
      state,
      action,
      details
    })
  });
}

export function getAuditLog() {
  return requestJson("/api/audit");
}

export function getNasaFeed() {
  return requestJson("/api/nasa");
}

export function sendChatMessage(message) {
  return requestJson("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message })
  });
}

export function getAdminSession() {
  return requestJson("/api/admin-session");
}

export function createAdminSession(password) {
  return requestJson("/api/admin-session", {
    method: "POST",
    body: JSON.stringify({ password })
  });
}

export async function clearAdminSession() {
  await fetch("/api/admin-session", {
    method: "DELETE"
  });
}

export function startPolling(task, intervalMs = 5000) {
  let timerId = null;
  let stopped = false;

  async function tick() {
    if (stopped) {
      return;
    }

    try {
      await task();
    } finally {
      if (!stopped) {
        timerId = window.setTimeout(tick, intervalMs);
      }
    }
  }

  void tick();

  return () => {
    stopped = true;
    if (timerId) {
      window.clearTimeout(timerId);
    }
  };
}
