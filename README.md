# space project

This is a hackathon project for orbital traffic monitoring with an HTML/CSS/JS frontend, a local Python backend, and a Cloudflare Pages deployment path.

## Local run

```powershell
cd c:\Users\moham\Desktop\space
node server.js
```

Open `http://127.0.0.1:8080`.

## Gemini chatbot configuration

The chatbot now supports Gemini through the official Gemini API. If `GEMINI_API_KEY` is not configured, it falls back to the built-in mission assistant logic.

### Local Node + Python run

```powershell
$env:GEMINI_API_KEY="your_gemini_api_key"
$env:GEMINI_MODEL="gemini-2.5-flash"
node server.js
```

### Cloudflare Pages

Set the following environment variables or secrets in the Pages project:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` with value `gemini-2.5-flash` unless you want a different Gemini model

For local `wrangler pages dev`, you can use a `.dev.vars` file.
