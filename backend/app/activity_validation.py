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
    """Returns a list of human-readable validation errors (empty = valid)."""
    errors = sorted(_validator().iter_errors(payload), key=lambda e: e.path)
    return [f"{'/'.join(str(p) for p in e.path) or '<root>'}: {e.message}" for e in errors]
