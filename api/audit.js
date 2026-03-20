import { handleOptions, sendJson } from "./_lib/http.js";
import { readAuditLog } from "./_lib/store.js";

export default async function handler(req, res) {
  if (handleOptions(req, res, ["GET", "OPTIONS"])) {
    return;
  }

  try {
    if (req.method !== "GET") {
      sendJson(res, 405, {
        ok: false,
        error: "Method Not Allowed"
      }, {
        Allow: "GET, OPTIONS"
      });
      return;
    }

    const entries = await readAuditLog(20);
    sendJson(res, 200, {
      ok: true,
      entries
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Audit endpoint failed."
    });
  }
}
