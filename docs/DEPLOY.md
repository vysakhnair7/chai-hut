# Deploying Chai Hut (Supabase + Render + Netlify, all from GitHub)

| Piece | Service | Config in this repo |
|---|---|---|
| Database | Supabase (PostgreSQL) | `deploy/supabase_lockdown.sql` |
| Backend | Render (free web service, Docker) | `render.yaml`, `Dockerfile` |
| Frontend | Netlify | `netlify.toml`, `frontend/public/_redirects` |

Supabase cannot host the FastAPI server or the React site; it provides the database only.
These steps have not been executed by the author: platform screens change, so treat button names as approximate.

## 1. Supabase
1. New project. Set a database password using **letters and digits only**.
2. **Connect → Session pooler** (not "Direct", which is IPv6-only; not "Transaction pooler", which breaks migrations).
3. Take the string `postgresql://postgres.<ref>:<password>@<host>.pooler.supabase.com:5432/postgres`, put your password in,
   and change the start to `postgresql+psycopg://`. This is `DATABASE_URL`.

## 2. Render (backend)
1. New → **Blueprint** → select this repo (it reads `render.yaml`).
2. Fill the prompted variables: `DATABASE_URL`, `OWNER_USERNAME` (lowercase), `OWNER_PASSWORD` (10+ chars, letters + digits).
   Leave `CORS_ORIGINS` empty for now. `JWT_SECRET_KEY` is generated for you.
3. Deploy. Open `https://<your-service>.onrender.com/health` and `/docs` to check.

## 3. Lock the database
Supabase → SQL Editor → paste and run `deploy/supabase_lockdown.sql`. Also turn off **Project Settings → Data API** if offered.

## 4. Netlify (frontend)
1. Add new site → Import from GitHub → this repo (it reads `netlify.toml`).
2. Environment variable: `VITE_API_BASE_URL` = the Render URL (https, no trailing slash). Deploy.
3. Back in Render, set `CORS_ORIGINS` to the Netlify URL (https, no trailing slash). Render restarts.
4. Open the Netlify URL and sign in with the owner from step 2.

## Notes
* Free tiers sleep: Render after ~15 min idle (first request is slow); Supabase pauses projects after about a week idle.
* Use demo data and strong passwords only: this is on the public internet. Demo data (`python -m app.utils.seed_demo`) only loads into a database with no users, and the container creates the owner on every start, so on a hosted setup add the menu and staff through the app instead.
* Never commit `.env`. Put secrets only in the Render / Netlify / Supabase dashboards.
