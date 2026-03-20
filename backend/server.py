import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from chatbot import generate_chat_response
from traffic_engine import create_default_state, process_state

HOST = os.environ.get("PYTHON_API_HOST", "127.0.0.1")
PORT = int(os.environ.get("PYTHON_API_PORT", "5000"))

state_storage = process_state(create_default_state())


class StateRequestHandler(BaseHTTPRequestHandler):
    server_version = "SpacePythonBackend/1.0"

    def _send_empty(self, status=204):
        self.send_response(status)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_text(self, message, status):
        body = message.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length) if content_length else b"{}"
        return json.loads(raw_body.decode("utf-8") or "{}")

    def do_OPTIONS(self):
        self._send_empty(204)

    def do_GET(self):
        # API endpoints
        if self.path == "/api/state":
            self._send_json(state_storage)
            return

        if self.path == "/api/health":
            self._send_json({"ok": True, "engine": "python"})
            return

        # fall back to static file serving for any other GET
        self._serve_static_file()

    def _serve_static_file(self):
        # map '/' to '/index.html'
        request_path = self.path if self.path != "/" else "/index.html"
        # prevent path traversal
        safe_root = os.path.abspath(os.path.join(os.getcwd()))
        target_path = os.path.abspath(os.path.join(safe_root, request_path.lstrip("/")))
        if not target_path.startswith(safe_root):
            self._send_text("Forbidden", 403)
            return

        if not os.path.isfile(target_path):
            self._send_text("Not Found", 404)
            return

        try:
            with open(target_path, "rb") as fh:
                content = fh.read()
        except OSError:
            self._send_text("Internal Server Error", 500)
            return

        # guess mime type based on extension
        import mimetypes

        mimetype, _ = mimetypes.guess_type(target_path)
        if mimetype is None:
            mimetype = "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", mimetype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_PUT(self):
        self._handle_state_update()

    def do_POST(self):
        if self.path == "/api/chat":
            self._handle_chat()
            return

        self._handle_state_update()

    def _handle_state_update(self):
        global state_storage

        if self.path != "/api/state":
            self._send_text("Not Found", 404)
            return

        try:
            payload = self._read_json_body()
        except json.JSONDecodeError:
            self._send_json({"error": "Invalid JSON payload."}, 400)
            return

        state_storage = process_state(payload)
        self._send_json(state_storage)

    def _handle_chat(self):
        try:
            payload = self._read_json_body()
        except json.JSONDecodeError:
            self._send_json({"error": "Invalid JSON payload."}, 400)
            return

        message = payload.get("message", "")
        candidate_state = payload.get("state", state_storage)
        self._send_json(generate_chat_response(message, candidate_state))

    def log_message(self, format_string, *args):
        print(f"[python-backend] {format_string % args}", flush=True)


def run():
    server = ThreadingHTTPServer((HOST, PORT), StateRequestHandler)
    print(
        f"Python backend listening on http://{HOST}:{PORT}",
        flush=True,
    )
    server.serve_forever()


if __name__ == "__main__":
    run()
