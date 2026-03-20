export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
}

export function renderCollection(container, html, emptyTitle, emptyText) {
  if (!container) {
    return;
  }

  container.innerHTML = html || `<article class="stack-item"><strong>${escapeHtml(emptyTitle)}</strong><p>${escapeHtml(emptyText)}</p></article>`;
}

export function formatAuditTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
