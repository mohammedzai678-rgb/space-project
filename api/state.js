import { isAdminRequest } from "./_lib/auth.js";
import { handleOptions, readJsonBody, sendJson } from "./_lib/http.js";
import { readMissionState, writeMissionState } from "./_lib/store.js";

export default async function handler(req, res) {
  if (handleOptions(req, res, ["GET", "PUT", "OPTIONS"])) {
    return;
  }

  try {
    if (req.method === "GET") {
      const snapshot = await readMissionState();
      sendJson(res, 200, {
        ok: true,
        state: snapshot.state,
        meta: {
          updatedAt: snapshot.updatedAt,
          updatedBy: snapshot.updatedBy,
          access: isAdminRequest(req) ? "admin" : "viewer"
        }
      });
      return;
    }

    if (req.method === "PUT") {
      if (!isAdminRequest(req)) {
        sendJson(res, 401, {
          ok: false,
          error: "Administrator session required."
        });
        return;
      }

      const payload = await readJsonBody(req);
      const snapshot = await writeMissionState(payload.state || payload, {
        actor: "administrator",
        action: payload.action || "state.updated",
        details: payload.details || {}
      });

      sendJson(res, 200, {
        ok: true,
        state: snapshot.state,
        meta: {
          updatedAt: snapshot.updatedAt,
          updatedBy: snapshot.updatedBy,
          access: "admin"
        }
      });
      return;
    }

    sendJson(res, 405, {
      ok: false,
      error: "Method Not Allowed"
    }, {
      Allow: "GET, PUT, OPTIONS"
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "State endpoint failed."
    });
  }
}
