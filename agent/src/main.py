"""
TICK desktop agent entrypoint.

Combines InputActivityCollector (keyboard/mouse) and TickAppCollector
(foreground app + CPU) into one activity_batch.schema.json-conformant
payload every BATCH_INTERVAL_SECONDS, and sends it via AgentClient.

This is the piece that didn't exist before: previously each collector had
its own incompatible payload shape and printed instead of transmitting.
Run with: python -m agent.src.main   (from the repo root)
"""
import os
import sys
import time
from datetime import datetime, timezone

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.collecters.activity_collect import InputActivityCollector
from src.collecters.appdata_collection import TickAppCollector
from src.agent_client import AgentClient

load_dotenv()

BATCH_INTERVAL_SECONDS = int(os.getenv("TICK_BATCH_INTERVAL_SECONDS", "180"))
API_BASE_URL = os.getenv("TICK_API_BASE_URL", "http://localhost:8000/api/v1")
AGENT_EMAIL = os.getenv("TICK_AGENT_EMAIL")
AGENT_PASSWORD = os.getenv("TICK_AGENT_PASSWORD")
DEVICE_NAME = os.getenv("TICK_DEVICE_NAME", "DESKTOP-001")
AGENT_VERSION = os.getenv("TICK_AGENT_VERSION", "0.1.0")
OS_NAME = os.getenv("TICK_OS_NAME", "WINDOWS")  # this agent is currently Windows-only


def build_payload(period_start_iso: str, period_end_iso: str, applications, context_switches, input_activity) -> dict:
    return {
        "device_id": None,  # filled in by AgentClient.send_batch
        "period_start": period_start_iso,
        "period_end": period_end_iso,
        "applications": applications,
        "context_switches": context_switches,
        "input_activity": input_activity,
        "system_events": [],
    }


def main():
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
    print(f"Registered as device_id={client.device_id}. Starting batch loop "
          f"(every {BATCH_INTERVAL_SECONDS}s)...")

    input_collector = InputActivityCollector()
    input_collector.start_listeners()

    app_collector = TickAppCollector(batch_interval_seconds=BATCH_INTERVAL_SECONDS)

    batch_start_time = time.time()
    period_start_iso = datetime.now(timezone.utc).isoformat()

    try:
        while True:
            app_collector.poll_once()
            elapsed = time.time() - batch_start_time

            if elapsed >= BATCH_INTERVAL_SECONDS:
                app_collector.finalize_open_session()
                applications, context_switches = app_collector.aggregate_batch()
                input_activity = input_collector.snapshot_and_reset(elapsed_seconds=int(elapsed))
                period_end_iso = datetime.now(timezone.utc).isoformat()

                payload = build_payload(
                    period_start_iso, period_end_iso, applications, context_switches, input_activity
                )

                try:
                    result = client.send_batch(payload)
                    print(f"Batch sent: {result}")
                except Exception as exc:  # network hiccups shouldn't kill the agent
                    print(f"Failed to send batch (will retry next interval): {exc}")

                app_collector.reset_batch()
                batch_start_time = time.time()
                period_start_iso = period_end_iso

            time.sleep(1)
    except KeyboardInterrupt:
        print("Stopping TICK agent.")


if __name__ == "__main__":
    main()
