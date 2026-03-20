# Space Mission Control

Multi-page orbital traffic operations dashboard built for Vercel with:

- shared mission state stored in Supabase
- read-only user monitoring page
- password-protected administrator control room
- NASA intelligence feed
- Gemini-powered mission assistant through Google

## Pages

- `/` landing page
- `/monitor` read-only user dashboard
- `/intelligence` NASA + Gemini intelligence page
- `/admin` administrator-only editing page

## Environment variables

Copy `.env.example` into your Vercel project or local `.env` file and set:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `NASA_API_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

## Supabase setup

Run the SQL in `supabase/schema.sql` in your Supabase SQL editor.

That creates:

- `mission_snapshots` for the shared JSON mission state
- `mission_audit_log` for recent administrator actions

## Local development

```powershell
cd C:\Users\moham\Desktop\space
cmd /c npm.cmd install
cmd /c npx.cmd vercel dev
```

Open:

- `http://127.0.0.1:3000/`

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repo into Vercel.
3. Add the environment variables from `.env.example`.
4. Run the SQL from `supabase/schema.sql`.
5. Deploy.

## Notes

- Administrator updates are enforced through the `/api/admin-session` password gate and `/api/state` write protection.
- All users see the same shared mission state because reads and writes go through the Supabase-backed Vercel API.
- If Supabase env vars are missing, the API falls back to in-memory storage for local development only.
