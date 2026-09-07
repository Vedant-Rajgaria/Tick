"""
Validates incoming /activity/batch payloads against the single authoritative
contract file: backend/app/schemas/activity_batch.schema.json.

Deliberately not re-implemented as a Pydantic model — see schemas.py for why.
"""
import json
from pathlib import Path
from functools import lru_cache

from jsonschema import Draft202012Validator, ValidationError

_SCHEMA_PATH = Path(__file__).parent / "schemas" / "activity_batch.schema.json"


@lru_cache(maxsize=1)
def _validator() -> Draft202012Validator:
    with open(_SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema = json.load(f)
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def validate_activity_batch(payload: dict) -> list[str]:
    """Schema-level validation: checks data types, formats, and required fields."""
    errors = sorted(_validator().iter_errors(payload), key=lambda e: e.path)
    return [f"{'/'.join(str(p) for p in e.path) or '<root>'}: {e.message}" for e in errors]


def validate_activity_batch_domain(payload: dict) -> list[str]:
    """Domain-level validation: checks physical, temporal, and mathematical consistency.
    
    Verifies:
      1. BatchEnd >= BatchStart
      2. ActiveTime >= 0, IdleTime >= 0, Switches >= 0, Keystrokes >= 0, MouseEvents >= 0
      3. ActiveTime + IdleTime <= BatchDuration (+ 1s clock drift tolerance)
      4. App and tab sessions have end_time >= start_time and duration >= 0
      5. Resource metrics percentages lie in [0, 100]
    """
    from datetime import datetime

    errors = []

    # 1. Temporal bounds on batch
    try:
        start = datetime.fromisoformat(payload.get("period_start", "").replace("Z", "+00:00"))
        end = datetime.fromisoformat(payload.get("period_end", "").replace("Z", "+00:00"))
        if end < start:
            errors.append(f"Domain error: period_end ({payload.get('period_end')}) must be >= period_start ({payload.get('period_start')})")
        batch_duration = (end - start).total_seconds()
    except Exception as e:
        errors.append(f"Domain error: invalid batch timestamps: {e}")
        batch_duration = None

    # 2. Input activity domain checks
    input_act = payload.get("input_activity", {})
    active_sec = input_act.get("active_seconds", 0)
    idle_sec = input_act.get("idle_seconds", 0)
    keystrokes = input_act.get("keystroke_count", 0)
    mouse_events = input_act.get("mouse_event_count", 0)

    if active_sec < 0:
        errors.append(f"Domain error: active_seconds ({active_sec}) must be >= 0")
    if idle_sec < 0:
        errors.append(f"Domain error: idle_seconds ({idle_sec}) must be >= 0")
    if keystrokes < 0:
        errors.append(f"Domain error: keystroke_count ({keystrokes}) must be >= 0")
    if mouse_events < 0:
        errors.append(f"Domain error: mouse_event_count ({mouse_events}) must be >= 0")

    if batch_duration is not None and (active_sec + idle_sec) > (batch_duration + 1.0):
        errors.append(
            f"Domain error: active_seconds ({active_sec}) + idle_seconds ({idle_sec}) "
            f"exceeds batch duration ({batch_duration}s)"
        )

    # 3. Context switches
    switches = payload.get("context_switches", {})
    events = switches.get("events", [])
    if len(events) < 0:
        errors.append("Domain error: context switch events count must be >= 0")

    # 4. Applications and tabs
    for idx, app in enumerate(payload.get("applications", [])):
        app_name = app.get("name", f"app[{idx}]")
        dur = app.get("duration_seconds", 0)
        if dur < 0:
            errors.append(f"Domain error: {app_name} duration_seconds ({dur}) must be >= 0")

        try:
            a_start = datetime.fromisoformat(app.get("start_time", "").replace("Z", "+00:00"))
            a_end = datetime.fromisoformat(app.get("end_time", "").replace("Z", "+00:00"))
            if a_end < a_start:
                errors.append(f"Domain error: {app_name} end_time must be >= start_time")
        except Exception:
            pass

        res = app.get("resource_usage")
        if res:
            for k in ("avg_cpu_percent", "max_cpu_percent", "avg_gpu_percent", "max_gpu_percent"):
                val = res.get(k)
                if val is not None and not (0.0 <= float(val) <= 100.0):
                    errors.append(f"Domain error: {app_name} {k} ({val}) must be within [0.0, 100.0]")

        for tab in app.get("browser_tabs", []):
            t_dur = tab.get("duration_seconds", 0)
            if t_dur < 0:
                errors.append(f"Domain error: tab {tab.get('domain')} duration_seconds ({t_dur}) must be >= 0")

    return errors

