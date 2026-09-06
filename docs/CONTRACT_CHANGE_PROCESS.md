# Contract Change Process

TIC has **three places** that describe the same data shapes, because different tools need different formats:

| File | Read by |
|---|---|
| `backend/app/schemas/activity_batch.schema.json` | Backend ingestion validation |
| `openapi.yaml` | Mock server (dashboards), API docs, and ideally codegen for request/response types |
| `shared/constants.json` | Agent, backend, analytics, dashboards — anywhere an enum string is used in code |

This is the most common source of "worked on my machine, broke in integration" bugs in a project shaped like this: someone adds a task status or renames an enum value in one file and forgets the other two. Follow this checklist for **every** change to a field name, enum value, or required/optional status of a field.

## Checklist for any contract change

1. **Update the schema first.** `activity_batch.schema.json` is the actual validator the backend runs — treat it as the source of truth for the batch payload shape.
2. **Update `openapi.yaml`** if the same field/enum appears in any request or response.
3. **Update `shared/constants.json`** if the change touches an enum value.
4. **Update the fixtures** (`backend/fixtures/sample_batch_*.json`, `seed.sql`) so they still validate — run the fixture check (see below) before merging.
5. **Post the change in the team channel** with a one-line summary before merging, not after — the whole point of freezing contracts at kickoff is that changes are rare and visible, not silent.

## Fixture validation

Any time the schema changes, re-validate the fixtures against it. Minimal manual check (works without extra dependencies):

```bash
python3 -c "
import json
schema = json.load(open('backend/app/schemas/activity_batch.schema.json'))
for f in ['backend/fixtures/sample_batch_normal.json',
          'backend/fixtures/sample_batch_browser_heavy.json',
          'backend/fixtures/sample_batch_idle_lock.json']:
    data = json.load(open(f))
    missing = [k for k in schema['required'] if k not in data]
    assert not missing, f'{f} missing {missing}'
    print(f, 'OK')
"
```

If `jsonschema` is installable in your environment, prefer full validation:

```bash
pip install jsonschema
python3 -c "
import json, jsonschema
schema = json.load(open('backend/app/schemas/activity_batch.schema.json'))
for f in ['backend/fixtures/sample_batch_normal.json',
          'backend/fixtures/sample_batch_browser_heavy.json',
          'backend/fixtures/sample_batch_idle_lock.json']:
    jsonschema.validate(json.load(open(f)), schema)
    print(f, 'valid')
"
```

## Known coupling to watch

- `application_category: "browser"` in `shared/constants.json` is a **reserved value** — the schema's conditional validation (`if category == "browser" then allow browser_tabs`) depends on this exact string. See `shared/README.md`.
- `task_status` values in `shared/constants.json`, `openapi.yaml`, and the `tasks.status` column must all agree, including casing (`IN_PROGRESS`, not `in_progress` or `InProgress`).
- `workload_thresholds_percent` in `shared/constants.json` must match whatever the Analytics Engine (Module D) hardcodes for LOW/NORMAL/HIGH/OVERLOADED — read from the constants file rather than re-declaring the thresholds in `analytics/workload.py`.

## Before the two integration checkpoints (from the team framework doc)

- **Checkpoint 1:** confirm every module reads enums from `shared/constants.json` rather than hardcoding strings — grep for the enum values as a quick check.
- **Checkpoint 2:** re-run the fixture validation above one more time right before wiring real modules together, in case a contract change landed between kickoff and now.
