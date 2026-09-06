# Running the Agent → API → DB pipeline

This covers what was just implemented: a real FastAPI backend with full JWT
auth (access + refresh, bcrypt password hashing, RBAC), and a desktop agent
that now actually conforms to `activity_batch.schema.json` and transmits.

## 1. Database

```bash
cp .env.example .env      # fill in JWT_SECRET at minimum
./scripts/setup_local_db.sh --reset
```

## 2. Backend

```bash
pip install -r requirements.txt --break-system-packages   # or use a venv
python -m backend.scripts.set_dev_passwords                # seed users get a real bcrypt hash
uvicorn backend.app.main:app --reload --port 8000
```

Seed login credentials after step 2 (dev only — see `set_dev_passwords.py`):

| email | password | role |
|---|---|---|
| priya@acme.test | devpassword123 | MANAGER |
| employee.a@acme.test | devpassword123 | EMPLOYEE |
| employee.b@acme.test | devpassword123 | EMPLOYEE |

Sanity check:

```bash
curl -X POST localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"employee.a@acme.test","password":"devpassword123"}'
```

You should get back `access_token`, `refresh_token`, and a `user` object.

## 3. Desktop agent (Windows only — uses `win32gui`)

```bash
cd agent
pip install -r requirements.txt --break-system-packages
cd ..
python -m agent.src.main
```

It will log in (using `TICK_AGENT_EMAIL` / `TICK_AGENT_PASSWORD` from `.env`),
register the device (caching the returned integer `device_id` locally so it
doesn't re-register every run), then every `TICK_BATCH_INTERVAL_SECONDS`
(180s by default — set it lower for testing) build a schema-conformant
batch from both collectors and POST it to `/api/v1/activity/batch`.

## 4. Verify data landed

```bash
python test_db.py   # existing connectivity check
```

or query directly:

```sql
SELECT * FROM application_sessions ORDER BY id DESC LIMIT 5;
SELECT * FROM input_activity_windows ORDER BY id DESC LIMIT 5;
```

## What this does NOT yet do

- No `work_metrics` daily aggregation, workload %, or recommendation
  calculation — that's Phase 4 (analytics engine) in the original doc's
  roadmap, still unimplemented.
- No task API (`POST /tasks`, `PATCH /tasks/{id}`) — Phase 3, still
  frontend/localStorage-only.
- Frontend dashboards still run on `FORCE_MOCK = true` by design (per your
  choice — flip it once the endpoints above are stable).
- Refresh tokens are stateless JWTs with no server-side revocation list yet
  — noted as a TODO in `backend/app/security.py`, not solved here.
- Browser extension is still just `random.txt`.
