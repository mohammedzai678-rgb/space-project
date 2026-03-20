import {
  clearAdminSessionCookie,
  createAdminSessionCookie,
  getAdminSessionConfigured,
  isAdminRequest
} from "./_lib/auth.js";
import { handleOptions, readJsonBody, sendEmpty, sendJson } from "./_lib/http.js";

export default async function handler(req, res) {
  if (handleOptions(req, res, ["GET", "POST", "DELETE", "OPTIONS"])) {
    return;
  }

  try {
    if (req.method === "GET") {
      sendJson(res, 200, {
        ok: true,
        authenticated: isAdminRequest(req),
        configured: getAdminSessionConfigured()
      });
      return;
    }

    if (req.method === "DELETE") {
      sendEmpty(res, 204, {
        "Set-Cookie": clearAdminSessionCookie()
      });
      return;
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const sessionConfigured = getAdminSessionConfigured();
      const configuredPassword = process.env.ADMIN_PASSWORD;

      if (!configuredPassword) {
        sendJson(res, 500, {
          ok: false,
          error: "ADMIN_PASSWORD is not configured."
        });
        return;
      }

      if (!sessionConfigured) {
        sendJson(res, 500, {
          ok: false,
          error: "ADMIN_SESSION_SECRET is not configured."
        });
        return;
      }

      if (String(payload.password || "") !== configuredPassword) {
        sendJson(res, 401, {
          ok: false,
          error: "Incorrect administrator password."
        });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        authenticated: true
      }, {
        "Set-Cookie": createAdminSessionCookie()
      });
      return;
    }

    sendJson(res, 405, {
      ok: false,
      error: "Method Not Allowed"
    }, {
      Allow: "GET, POST, DELETE, OPTIONS"
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Admin session endpoint failed."
    });
  }
}
