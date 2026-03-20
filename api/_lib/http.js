export async function readJsonBody(req) {
  if (Buffer.isBuffer(req.body)) {
    return JSON.parse(req.body.toString("utf8") || "{}");
  }

  if (typeof req.body === "string" && req.body.trim()) {
    return JSON.parse(req.body);
  }

  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();
  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody);
}

export function sendJson(res, status, payload, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  Object.entries(extraHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  res.end(JSON.stringify(payload));
}

export function sendEmpty(res, status = 204, extraHeaders = {}) {
  res.statusCode = status;
  Object.entries(extraHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.end();
}

export function handleOptions(req, res, methods) {
  if (req.method !== "OPTIONS") {
    return false;
  }

  sendEmpty(res, 204, {
    Allow: methods.join(", ")
  });
  return true;
}
