"""
Foreground-application collector.

Contract fixes (see docs/CONTRACT_CHANGE_PROCESS.md /
activity_batch.schema.json `applicationSession` + `contextSwitches`):
this collector previously produced `period_duration_seconds` + a flat
`metrics.application_switches` + `applications[].avg_cpu_percent`, none of
which match the schema. It now produces, per app session:
  name, process_name, category, start_time, end_time, duration_seconds,
  resource_usage{avg_cpu_percent, max_cpu_percent, avg_gpu_percent,
  max_gpu_percent, sample_count}
plus a context_switches block with app_switch_count and a from/to/timestamp
event log — previously only a bare integer counter existed.

GPU sampling is NOT implemented (no cross-platform GPU% source is wired up
yet) — avg/max_gpu_percent are reported as 0.0 rather than omitted, since
resourceUsage requires them. This should be replaced with real sampling
before GPU numbers are treated as meaningful.

Category classification is a small local lookup by process name rather than
the "unclassified" placeholder from before, since the DB's `applications`
table enforces a fixed enum and the backend has no registry-mapping service
implemented yet (see analytics/ — still empty). Swap this for a real
backend-side mapping once one exists.
"""
import time
import psutil
import win32gui
import win32process
from collections import defaultdict
from datetime import datetime, timezone

# Same categories enforced by the DB's applications.category CHECK constraint
# (backend/fixtures/schema.sql) — keep these in sync.
_CATEGORY_BY_PROCESS = {
    "code.exe": "development",
    "pycharm64.exe": "development",
    "idea64.exe": "development",
    "chrome.exe": "browser",
    "msedge.exe": "browser",
    "firefox.exe": "browser",
    "teams.exe": "communication",
    "slack.exe": "communication",
    "outlook.exe": "communication",
    "excel.exe": "data_office",
    "winword.exe": "documentation",
    "notepad.exe": "documentation",
    "powerpnt.exe": "presentation",
}


def classify_category(process_name: str) -> str:
    return _CATEGORY_BY_PROCESS.get(process_name.lower(), "other")


class TickAppCollector:
    def __init__(self, batch_interval_seconds=180):
        self.batch_interval_seconds = batch_interval_seconds

        # Tracking metrics, keyed by app name
        self.app_durations = defaultdict(float)
        self.app_process_names = {}
        self.app_cpu_samples = defaultdict(list)
        self.app_session_start = {}
        self.context_switch_events = []  # list of {type, from, to, timestamp}
        self.app_switch_count = 0

        # State variables
        self.current_app = None
        self.last_switch_time = time.time()
        self.current_pid = None
        self.process_obj = None
        self.batch_start_iso = datetime.now(timezone.utc).isoformat()

    def get_active_window_process(self):
        """Retrieves the executable name and PID of the foreground window."""
        try:
            hwnd = win32gui.GetForegroundWindow()
            if hwnd:
                _, pid = win32process.GetWindowThreadProcessId(hwnd)
                if pid > 0:
                    process = psutil.Process(pid)
                    return process.name(), pid, process
        except (psutil.NoSuchProcess, psutil.AccessDenied, Exception):
            pass
        return "Unknown", 0, None

    def _finalize_current_app(self, current_time, current_time_iso):
        if self.current_app is None:
            return
        time_spent = current_time - self.last_switch_time
        self.app_durations[self.current_app] += time_spent
        if self.current_app not in self.app_session_start:
            self.app_session_start[self.current_app] = self.batch_start_iso

    def _handle_switch(self, app_name, process_name, current_time, current_time_iso):
        if self.current_app is not None:
            self._finalize_current_app(current_time, current_time_iso)
            self.context_switch_events.append(
                {
                    "type": "APP",
                    "from": self.current_app,
                    "to": app_name,
                    "timestamp": current_time_iso,
                }
            )
            self.app_switch_count += 1

        self.current_app = app_name
        self.app_process_names[app_name] = process_name
        if app_name not in self.app_session_start:
            self.app_session_start[app_name] = current_time_iso
        self.last_switch_time = current_time

    def aggregate_batch(self) -> tuple[list[dict], dict]:
        """
        Returns (applications, context_switches) matching the schema's
        `applicationSession[]` and `contextSwitches` shapes respectively.
        Caller (agent/src/main.py) is responsible for combining this with
        input_activity into the full batch payload.
        """
        batch_end_iso = datetime.now(timezone.utc).isoformat()
        applications_payload = []

        for app_name, duration in self.app_durations.items():
            cpu_samples = self.app_cpu_samples[app_name]
            avg_cpu = round(sum(cpu_samples) / len(cpu_samples), 2) if cpu_samples else 0.0
            max_cpu = round(max(cpu_samples), 2) if cpu_samples else 0.0

            applications_payload.append(
                {
                    "name": app_name,
                    "process_name": self.app_process_names.get(app_name, "unknown.exe"),
                    "category": classify_category(self.app_process_names.get(app_name, "")),
                    "start_time": self.app_session_start.get(app_name, self.batch_start_iso),
                    "end_time": batch_end_iso,
                    "duration_seconds": max(int(round(duration)), 0),
                    "resource_usage": {
                        "avg_cpu_percent": min(avg_cpu, 100.0),
                        "max_cpu_percent": min(max_cpu, 100.0),
                        # GPU sampling not implemented yet — see module docstring.
                        "avg_gpu_percent": 0.0,
                        "max_gpu_percent": 0.0,
                        "sample_count": max(len(cpu_samples), 1),
                    },
                }
            )

        context_switches_payload = {
            "app_switch_count": self.app_switch_count,
            "tab_switch_count": 0,  # no browser extension yet — see docs
            "events": self.context_switch_events,
        }

        return applications_payload, context_switches_payload

    def reset_batch(self):
        """Clears metrics for the next collection period."""
        self.app_durations.clear()
        self.app_process_names.clear()
        self.app_cpu_samples.clear()
        self.app_session_start.clear()
        self.context_switch_events = []
        self.app_switch_count = 0
        self.batch_start_iso = datetime.now(timezone.utc).isoformat()

    def poll_once(self):
        """One polling tick — call this every ~1s from the owning loop."""
        current_time = time.time()
        current_time_iso = datetime.now(timezone.utc).isoformat()
        app_name, pid, process = self.get_active_window_process()

        if app_name != self.current_app:
            self._handle_switch(app_name, app_name, current_time, current_time_iso)
            self.current_pid = pid
            self.process_obj = process
            if self.process_obj:
                try:
                    self.process_obj.cpu_percent(interval=None)  # prime it
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass

        if self.process_obj:
            try:
                cpu_usage = self.process_obj.cpu_percent(interval=None)
                self.app_cpu_samples[self.current_app].append(cpu_usage)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

    def finalize_open_session(self):
        """Call right before aggregate_batch() to close out the in-progress app duration."""
        current_time = time.time()
        current_time_iso = datetime.now(timezone.utc).isoformat()
        self._finalize_current_app(current_time, current_time_iso)
        self.last_switch_time = current_time


if __name__ == "__main__":
    # Standalone smoke test at a short interval. Real transmission happens
    # in agent/src/main.py via agent_client.py.
    import json

    monitor = TickAppCollector(batch_interval_seconds=15)
    print(f"Starting TICK App Monitor smoke test (interval: {monitor.batch_interval_seconds}s)...")
    batch_start_time = time.time()
    while True:
        monitor.poll_once()
        if time.time() - batch_start_time >= monitor.batch_interval_seconds:
            monitor.finalize_open_session()
            apps, switches = monitor.aggregate_batch()
            print(json.dumps({"applications": apps, "context_switches": switches}, indent=2))
            monitor.reset_batch()
            batch_start_time = time.time()
        time.sleep(1)
