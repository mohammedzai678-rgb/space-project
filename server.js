const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const host = "0.0.0.0";
const port = Number(process.env.PORT || 8080);
const backendHost = process.env.PYTHON_API_HOST || "127.0.0.1";
const backendPort = Number(process.env.PYTHON_API_PORT || 5000);
const root = __dirname;
const backendScriptPath = path.join(root, "backend", "server.py");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

let pythonProcess = null;

function getPythonCandidates() {
  const candidates = [];
  const pathEntries = (process.env.PATH || "").split(path.delimiter).filter(Boolean);

  if (process.env.PYTHON_BIN) {
    candidates.push(process.env.PYTHON_BIN);
  }

  for (const entry of pathEntries) {
    if (process.platform === "win32") {
      candidates.push(path.join(entry, "python.exe"));
      candidates.push(path.join(entry, "python3.exe"));
    } else {
      candidates.push(path.join(entry, "python3"));
      candidates.push(path.join(entry, "python"));
    }
  }

  if (process.platform === "win32") {
    const userProfile = process.env.USERPROFILE || "";
    candidates.push(
      path.join(userProfile, "AppData", "Local", "Programs", "Python", "Python313", "python.exe"),
      path.join(userProfile, "AppData", "Local", "Programs", "Python", "Python312", "python.exe"),
      path.join(userProfile, "AppData", "Local", "Programs", "Python", "Python311", "python.exe"),
      path.join("C:\\", "Python313", "python.exe"),
      path.join("C:\\", "Python312", "python.exe"),
      path.join("C:\\", "Python311", "python.exe")
    );
  }

  return [...new Set(candidates)].filter((candidate) => {
    if (!candidate) {
      return false;
    }

    const lowerCaseCandidate = candidate.toLowerCase();
    if (lowerCaseCandidate.includes(`${path.sep}windowsapps${path.sep}`)) {
      return false;
    }

    return fs.existsSync(candidate);
  });
}

function startPythonBackend() {
  if (pythonProcess || process.env.DISABLE_PYTHON_BACKEND === "1") {
    return;
  }

  if (!fs.existsSync(backendScriptPath)) {
    console.warn("Python backend script was not found at backend/server.py.");
    return;
  }

  const [pythonRuntime] = getPythonCandidates();
  if (!pythonRuntime) {
    console.warn("Python backend was not started because no local Python interpreter was found. Install Python and set PYTHON_BIN if needed.");
    return;
  }

  pythonProcess = spawn(pythonRuntime, [backendScriptPath], {
    cwd: root,
    env: {
      ...process.env,
      PYTHON_API_HOST: backendHost,
      PYTHON_API_PORT: String(backendPort)
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });

  pythonProcess.stdout.on("data", (chunk) => {
    process.stdout.write(`[python] ${chunk}`);
  });

  pythonProcess.stderr.on("data", (chunk) => {
    process.stderr.write(`[python] ${chunk}`);
  });

  pythonProcess.on("exit", (code, signal) => {
    pythonProcess = null;
    console.warn(`Python backend exited${signal ? ` with signal ${signal}` : ` with code ${code}`}.`);
  });
}

function stopPythonBackend() {
  if (!pythonProcess) {
    return;
  }

  pythonProcess.kill();
  pythonProcess = null;
}

function sendFile(filePath, response) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      response.end(error.code === "ENOENT" ? "Not found" : "Internal server error");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(content);
  });
}

function sendBackendUnavailable(response, error) {
  response.writeHead(503, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify({
    error: "The Python backend is unavailable. Install Python locally or set PYTHON_BIN to a valid interpreter path.",
    detail: error ? error.message : "Connection failed."
  }));
}

function proxyApiRequest(request, response) {
  const proxyRequest = http.request({
    hostname: backendHost,
    port: backendPort,
    path: request.url,
    method: request.method,
    headers: {
      ...request.headers,
      host: `${backendHost}:${backendPort}`
    }
  }, (proxyResponse) => {
    response.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
    proxyResponse.pipe(response);
  });

  proxyRequest.on("error", (error) => {
    sendBackendUnavailable(response, error);
  });

  request.pipe(proxyRequest);
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);

  if (requestUrl.pathname.startsWith("/api/")) {
    proxyApiRequest(request, response);
    return;
  }

  const requestPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const resolvedPath = path.normalize(path.join(root, requestPath));

  if (!resolvedPath.startsWith(root)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  sendFile(resolvedPath, response);
});

startPythonBackend();

server.listen(port, host, () => {
  console.log(`Server running at http://127.0.0.1:${port}`);
});

process.on("exit", stopPythonBackend);
process.on("SIGINT", () => {
  stopPythonBackend();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopPythonBackend();
  process.exit(0);
});
