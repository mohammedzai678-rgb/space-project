import crypto from "node:crypto";

const ADMIN_COOKIE_NAME = "space_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "development-only-secret";
}

function isSecureCookieContext() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL_URL);
}

function encodeBase64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(value) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

function parseCookieHeader(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf("=");
        if (separatorIndex === -1) {
          return [entry, ""];
        }

        return [
          entry.slice(0, separatorIndex).trim(),
          decodeURIComponent(entry.slice(separatorIndex + 1).trim())
        ];
      })
  );
}

function buildCookie(value, expiresAt) {
  const expires = new Date(expiresAt).toUTCString();
  const secureAttribute = isSecureCookieContext() ? "; Secure" : "";
  return `${ADMIN_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires}${secureAttribute}`;
}

export function getAdminSessionConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET);
}

export function createAdminSessionCookie() {
  const payload = JSON.stringify({
    role: "administrator",
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  const encoded = encodeBase64Url(payload);
  const signature = signValue(encoded);
  return buildCookie(`${encoded}.${signature}`, Date.now() + SESSION_TTL_MS);
}

export function clearAdminSessionCookie() {
  return buildCookie("", Date.now() - 1000);
}

export function isAdminRequest(req) {
  const cookies = parseCookieHeader(req.headers.cookie || "");
  const token = cookies[ADMIN_COOKIE_NAME];

  if (!token || !token.includes(".")) {
    return false;
  }

  const [encoded, providedSignature] = token.split(".");
  const expectedSignature = signValue(encoded);
  if (providedSignature !== expectedSignature) {
    return false;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encoded));
    return payload.role === "administrator" && Number(payload.expiresAt) > Date.now();
  } catch (error) {
    return false;
  }
}
