"""
Verification script for EyeTracker integration and 80/20 algorithmic fusion.
"""
import sys
import os
import json
import jsonschema

sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("agent"))

from agent.src.main import compute_fusion, build_payload
from agent.src.collecters.tick_eyetracker import EyeTrackingCollector, StatisticalBaseline
from backend.app.activity_validation import validate_activity_batch_domain


def test_fusion_logic():
    print("--- 1. Testing 80/20 Fusion Math & Camera Hijack Fallback ---")
    elapsed = 180

    # Scenario A: Camera Active, high system (72s = 0.40), high eye focus (eye_activity = 1.0)
    # Composite = 0.8 * 0.4 + 0.2 * 1.0 = 0.32 + 0.20 = 0.52 >= 0.5 -> dominant interval active (180 * 0.52 = 94s)
    eye_active_telemetry = {
        "camera_active": True,
        "focus_score": 85.0,
        "applied_threshold": 40.0,
        "eye_z_score": 0.82,
        "eye_activity": 1.0,
        "is_anomalous": False,
    }
    act, idle, focus, cam, z, comp = compute_fusion(72, elapsed, eye_active_telemetry)
    assert cam is True, "Camera should be active"
    assert focus == 85.0, "Focus score should be 85.0"
    assert z == 0.82, "Z score should be 0.82"
    assert round(comp, 2) == 0.52, f"Composite should be 0.52, got {comp}"
    assert act == 94, f"Active seconds should be 94, got {act}"
    assert idle == 86, f"Idle seconds should be 86, got {idle}"
    print("[PASS] Scenario A (Rescue focus interval): Composite=0.52, Active=94s")

    # Scenario B: Camera Active, low system (36s = 0.20), low eye focus (eye_activity = 0.0)
    # Composite = 0.8 * 0.2 + 0.2 * 0 = 0.16 < 0.5 -> active_seconds = 36s
    eye_low_telemetry = {
        "camera_active": True,
        "focus_score": 25.0,
        "applied_threshold": 40.0,
        "eye_z_score": -1.2,
        "eye_activity": 0.0,
        "is_anomalous": False,
    }
    act, idle, focus, cam, z, comp = compute_fusion(36, elapsed, eye_low_telemetry)
    assert cam is True
    assert round(comp, 2) == 0.16
    assert act == 36
    assert idle == 144
    print("[PASS] Scenario B (Low system + low focus): Composite=0.16, Active=36s")

    # Scenario C: Camera Hijack Fallback (e.g. Zoom/Teams locks camera)
    # camera_active = False -> 100% weight on standard telemetry
    eye_hijacked_telemetry = {
        "camera_active": False,
        "focus_score": None,
        "applied_threshold": 40.0,
        "eye_z_score": None,
        "eye_activity": 0.0,
        "is_anomalous": False,
    }
    act, idle, focus, cam, z, comp = compute_fusion(108, elapsed, eye_hijacked_telemetry)
    assert cam is False, "Camera should be False"
    assert focus is None, "Focus should be None"
    assert z is None, "Z-score should be None"
    assert round(comp, 2) == 0.60, f"Composite should be 0.60 (100% fallback), got {comp}"
    assert act == 108, f"Active seconds should be 108, got {act}"
    assert idle == 72, f"Idle seconds should be 72, got {idle}"
    print("[PASS] Scenario C (Camera hijack fallback): 100% fallback Composite=0.60, Active=108s")


def test_schema_conformance():
    print("\n--- 2. Testing JSON Schema Conformance ---")
    schema_path = "backend/app/schemas/activity_batch.schema.json"
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)

    # Valid payload with eye tracking telemetry
    sample_payload_with_eyes = {
        "device_id": 1,
        "period_start": "2026-09-07T12:00:00Z",
        "period_end": "2026-09-07T12:03:00Z",
        "applications": [],
        "context_switches": {
            "app_switch_count": 0,
            "tab_switch_count": 0,
            "events": [],
        },
        "input_activity": {
            "keystroke_count": 120,
            "mouse_event_count": 45,
            "active_seconds": 90,
            "idle_seconds": 90,
            "focus_score": 78.5,
            "camera_active": True,
            "eye_z_score": 0.45,
        },
        "system_events": [],
        "focus_score": 78.5,
        "camera_active": True,
        "eye_z_score": 0.45,
    }

    jsonschema.validate(instance=sample_payload_with_eyes, schema=schema)
    print("[PASS] Payload with active eye telemetry passed JSON schema validation")

    # Valid payload with null/fallback eye telemetry
    sample_payload_fallback = {
        "device_id": 1,
        "period_start": "2026-09-07T12:00:00Z",
        "period_end": "2026-09-07T12:03:00Z",
        "applications": [],
        "context_switches": {
            "app_switch_count": 0,
            "tab_switch_count": 0,
            "events": [],
        },
        "input_activity": {
            "keystroke_count": 120,
            "mouse_event_count": 45,
            "active_seconds": 90,
            "idle_seconds": 90,
            "focus_score": None,
            "camera_active": False,
            "eye_z_score": None,
        },
        "system_events": [],
        "focus_score": None,
        "camera_active": False,
        "eye_z_score": None,
    }

    jsonschema.validate(instance=sample_payload_fallback, schema=schema)
    print("[PASS] Payload with fallback/null eye telemetry passed JSON schema validation")

    # Valid payload legacy (without any eye fields)
    sample_payload_legacy = {
        "device_id": 1,
        "period_start": "2026-09-07T12:00:00Z",
        "period_end": "2026-09-07T12:03:00Z",
        "applications": [],
        "context_switches": {
            "app_switch_count": 0,
            "tab_switch_count": 0,
            "events": [],
        },
        "input_activity": {
            "keystroke_count": 120,
            "mouse_event_count": 45,
            "active_seconds": 90,
            "idle_seconds": 90,
        },
        "system_events": [],
    }

    jsonschema.validate(instance=sample_payload_legacy, schema=schema)
    print("[PASS] Legacy payload (no eye keys) passed JSON schema validation")


def test_domain_validation():
    print("\n--- 3. Testing Backend Domain Validation ---")
    valid_payload = {
        "device_id": 1,
        "period_start": "2026-09-07T12:00:00Z",
        "period_end": "2026-09-07T12:03:00Z",
        "applications": [],
        "context_switches": {
            "app_switch_count": 0,
            "tab_switch_count": 0,
            "events": [],
        },
        "input_activity": {
            "keystroke_count": 10,
            "mouse_event_count": 10,
            "active_seconds": 60,
            "idle_seconds": 120,
            "focus_score": 65.5,
            "camera_active": True,
            "eye_z_score": 0.25,
        },
        "system_events": [],
    }
    # Should have 0 errors
    errors = validate_activity_batch_domain(valid_payload)
    assert len(errors) == 0, f"Expected 0 errors, got: {errors}"
    print("[PASS] Valid payload passed domain validation")

    # Test invalid focus_score (>100)
    invalid_payload = json.loads(json.dumps(valid_payload))
    invalid_payload["input_activity"]["focus_score"] = 105.0
    errors = validate_activity_batch_domain(invalid_payload)
    assert any("focus_score" in err for err in errors), f"Expected focus_score error, got: {errors}"
    print(f"[PASS] Correctly rejected focus_score > 100: {errors[0]}")

    # Test invalid focus_score (<0)
    invalid_payload["input_activity"]["focus_score"] = -5.0
    errors = validate_activity_batch_domain(invalid_payload)
    assert any("focus_score" in err for err in errors), f"Expected focus_score error, got: {errors}"
    print(f"[PASS] Correctly rejected focus_score < 0: {errors[0]}")


def test_statistical_baseline():
    print("\n--- 4. Testing Statistical Baseline & Z-Score ---")
    sb = StatisticalBaseline(history_limit=20)
    assert sb.get_personal_threshold() == 40.0, "Initial threshold should be 40.0"
    assert sb.calculate_z_score(50.0) == 0.0, "Initial z-score should be 0.0"

    # Add points
    for score in [50.0, 60.0, 70.0, 80.0]:
        sb.update_history(score)

    thresh = sb.get_personal_threshold()
    z = sb.calculate_z_score(65.0)
    print(f"[PASS] Personal threshold calculated: {thresh:.2f}, Z-score for 65.0: {z:.2f}")


if __name__ == "__main__":
    test_fusion_logic()
    test_schema_conformance()
    test_domain_validation()
    test_statistical_baseline()
    print("\nALL TESTS PASSED SUCCESSFULLY!")
