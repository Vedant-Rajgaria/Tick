"""
TICK desktop agent entrypoint.

Combines InputActivityCollector (keyboard/mouse), TickAppCollector
(foreground app + CPU), and EyeTrackingCollector (facial focus & fatigue)
into one activity_batch.schema.json-conformant payload every
BATCH_INTERVAL_SECONDS, and sends it via AgentClient.

Supports:
  --debug-ui: Flag to render live OpenCV camera feed with telemetry overlay.
              Default: Headless background execution.
Algorithmic Fusion:
  80/20 binary gate combining system activity (80%) and eye focus (20%)
  with automatic camera hijack / missing device fallback.

Run with:
  python -m agent.src.main [--debug-ui]   (from repo root)
"""
import os
import sys
import time
import argparse
from datetime import datetime, timezone

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.collecters.activity_collect import InputActivityCollector
from src.collecters.appdata_collection import TickAppCollector
from src.collecters.tick_eyetracker import EyeTrackingCollector
from src.agent_client import AgentClient

load_dotenv()

BATCH_INTERVAL_SECONDS = int(os.getenv("TICK_BATCH_INTERVAL_SECONDS", "180"))
API_BASE_URL = os.getenv("TICK_API_BASE_URL", "http://localhost:8000/api/v1")
AGENT_EMAIL = os.getenv("TICK_AGENT_EMAIL")
AGENT_PASSWORD = os.getenv("TICK_AGENT_PASSWORD")
DEVICE_NAME = os.getenv("TICK_DEVICE_NAME", "DESKTOP-001")
AGENT_VERSION = os.getenv("TICK_AGENT_VERSION", "0.1.0")
OS_NAME = os.getenv("TICK_OS_NAME", "WINDOWS")  # this agent is currently Windows-only


def build_payload(
    period_start_iso: str,
    period_end_iso: str,
    applications,
    context_switches,
    input_activity,
    focus_score: float | None = None,
    camera_active: bool = False,
    eye_z_score: float | None = None,
) -> dict:
    return {
        "device_id": None,  # filled in by AgentClient.send_batch
        "period_start": period_start_iso,
        "period_end": period_end_iso,
        "applications": applications,
        "context_switches": context_switches,
        "input_activity": input_activity,
        "system_events": [],
        "focus_score": focus_score,
        "camera_active": camera_active,
        "eye_z_score": eye_z_score,
    }


def compute_fusion(
    system_active_seconds: int,
    elapsed_seconds: int,
    eye_telemetry: dict,
) -> tuple[int, int, float | None, bool, float | None, float]:
    """
    Computes 80/20 binary gate algorithmic fusion:
      System_Activity = System_Active_Seconds / BATCH_INTERVAL_SECONDS
      Eye_Activity = 1.0 if focus_score >= dynamic Z-score threshold else 0.0
      Composite = (0.8 * System_Activity) + (0.2 * Eye_Activity)
    If Composite >= 0.5, log dominant portion of interval as active.

    Camera Hijack Fallback:
      If camera_active is False, fallback to Composite = System_Activity (100% weight).
    """
    elapsed = max(1, elapsed_seconds)
    system_activity = min(1.0, system_active_seconds / float(elapsed))

    if eye_telemetry.get("camera_active") and eye_telemetry.get("focus_score") is not None:
        focus_score = eye_telemetry["focus_score"]
        camera_active = True
        eye_z_score = eye_telemetry.get("eye_z_score")
        eye_activity = eye_telemetry.get("eye_activity", 0.0)
        composite = (0.8 * system_activity) + (0.2 * eye_activity)
    else:
        # Camera hijack / unavailable fallback
        focus_score = None
        camera_active = False
        eye_z_score = None
        eye_activity = 0.0
        composite = system_activity

    if composite >= 0.5:
        dominant_seconds = int(round(elapsed * composite))
        active_seconds = max(system_active_seconds, dominant_seconds)
    else:
        active_seconds = system_active_seconds

    active_seconds = min(elapsed, max(0, active_seconds))
    idle_seconds = max(0, elapsed - active_seconds)

    return active_seconds, idle_seconds, focus_score, camera_active, eye_z_score, composite


def main():
    parser = argparse.ArgumentParser(description="TICK desktop telemetry agent")
    parser.add_argument(
        "--debug-ui",
        action="store_true",
        help="Render live OpenCV debug UI feed with system telemetry HUD overlay",
    )
    args = parser.parse_args()

    if not AGENT_EMAIL or not AGENT_PASSWORD:
        raise SystemExit(
            "TICK_AGENT_EMAIL and TICK_AGENT_PASSWORD must be set (see .env.example)."
        )

    client = AgentClient(
        base_url=API_BASE_URL,
        email=AGENT_EMAIL,
        password=AGENT_PASSWORD,
        device_name=DEVICE_NAME,
        os_name=OS_NAME,
        agent_version=AGENT_VERSION,
    )
    client.ensure_ready()
    print(
        f"Registered as device_id={client.device_id}. Starting batch loop "
        f"(every {BATCH_INTERVAL_SECONDS}s)..."
    )

    input_collector = InputActivityCollector()
    input_collector.start_listeners()

    app_collector = TickAppCollector(batch_interval_seconds=BATCH_INTERVAL_SECONDS)

    # Telemetry provider for OpenCV debug HUD overlay (Requirement 3)
    def get_live_telemetry():
        active_app = "Desktop"
        if hasattr(app_collector, "current_app") and app_collector.current_app:
            active_app = app_collector.current_app
        with input_collector.lock:
            keys = input_collector.keystroke_count
            mouse_evts = input_collector.mouse_event_count
        return {
            "keystrokes": keys,
            "mouse_events": mouse_evts,
            "app_name": active_app,
        }

    eye_collector = EyeTrackingCollector(
        debug_ui=args.debug_ui,
        telemetry_provider=get_live_telemetry,
    )
    eye_collector.start()

    batch_start_time = time.time()
    period_start_iso = datetime.now(timezone.utc).isoformat()

    try:
        while True:
            app_collector.poll_once()
            elapsed = time.time() - batch_start_time

            if elapsed >= BATCH_INTERVAL_SECONDS:
                app_collector.finalize_open_session()
                applications, context_switches = app_collector.aggregate_batch()
                raw_input_activity = input_collector.snapshot_and_reset(elapsed_seconds=int(elapsed))
                eye_telemetry = eye_collector.snapshot_and_reset(elapsed_seconds=int(elapsed))
                period_end_iso = datetime.now(timezone.utc).isoformat()

                # Requirement 2: 80/20 Algorithmic Fusion with Camera Fallback
                (
                    active_seconds,
                    idle_seconds,
                    focus_score,
                    camera_active,
                    eye_z_score,
                    composite,
                ) = compute_fusion(
                    system_active_seconds=raw_input_activity.get("active_seconds", 0),
                    elapsed_seconds=int(elapsed),
                    eye_telemetry=eye_telemetry,
                )

                input_activity = {
                    "keystroke_count": raw_input_activity.get("keystroke_count", 0),
                    "mouse_event_count": raw_input_activity.get("mouse_event_count", 0),
                    "active_seconds": active_seconds,
                    "idle_seconds": idle_seconds,
                    "focus_score": focus_score,
                    "camera_active": camera_active,
                    "eye_z_score": eye_z_score,
                }

                payload = build_payload(
                    period_start_iso=period_start_iso,
                    period_end_iso=period_end_iso,
                    applications=applications,
                    context_switches=context_switches,
                    input_activity=input_activity,
                    focus_score=focus_score,
                    camera_active=camera_active,
                    eye_z_score=eye_z_score,
                )

                try:
                    result = client.send_batch(payload)
                    print(
                        f"Batch sent: {result} | Composite: {composite:.2f} | "
                        f"Active: {active_seconds}s | Focus: {focus_score} | "
                        f"Cam: {camera_active}"
                    )
                except Exception as exc:  # network hiccups shouldn't kill the agent
                    print(f"Failed to send batch (will retry next interval): {exc}")

                app_collector.reset_batch()
                batch_start_time = time.time()
                period_start_iso = period_end_iso

            time.sleep(1)
    except KeyboardInterrupt:
        print("Stopping TICK agent.")
    finally:
        eye_collector.stop()


if __name__ == "__main__":
    main()
