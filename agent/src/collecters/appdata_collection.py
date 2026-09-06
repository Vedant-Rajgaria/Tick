import time
import psutil
import win32gui
import win32process
from collections import defaultdict
from datetime import datetime, timezone

class TickAppCollector:
    def __init__(self, batch_interval_seconds=180):
        self.batch_interval_seconds = batch_interval_seconds
        
        # Tracking metrics
        self.app_durations = defaultdict(float)
        self.app_cpu_samples = defaultdict(list)
        self.context_switches = 0
        
        # State variables
        self.current_app = None
        self.last_switch_time = time.time()
        self.current_pid = None
        self.process_obj = None

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

    def aggregate_batch(self):
        """Compiles the collected data into TICK's JSON batch format."""
        applications_payload = []
        
        for app_name, duration in self.app_durations.items():
            # Calculate average CPU usage for this app during the batch
            cpu_samples = self.app_cpu_samples[app_name]
            avg_cpu = sum(cpu_samples) / len(cpu_samples) if cpu_samples else 0.0
            
            applications_payload.append({
                "name": app_name,
                "category": "unclassified", # To be mapped by backend registry
                "duration_seconds": round(duration, 2),
                "avg_cpu_percent": round(avg_cpu, 2)
            })

        batch_payload = {
            "device_id": "DESKTOP-TEST-01",
            "period_start": datetime.now(timezone.utc).isoformat(),
            "period_duration_seconds": self.batch_interval_seconds,
            "metrics": {
                "application_switches": self.context_switches
            },
            "applications": applications_payload
        }
        
        return batch_payload

    def reset_batch(self):
        """Clears metrics for the next collection period."""
        self.app_durations.clear()
        self.app_cpu_samples.clear()
        self.context_switches = 0

    def start_monitoring(self):
        print(f"Starting TICK App Monitor (Batch interval: {self.batch_interval_seconds}s)...")
        batch_start_time = time.time()
        
        while True:
            current_time = time.time()
            app_name, pid, process = self.get_active_window_process()
            
            # Detect Context Switch
            if app_name != self.current_app:
                if self.current_app is not None:
                    # Finalize duration for the previous app
                    time_spent = current_time - self.last_switch_time
                    self.app_durations[self.current_app] += time_spent
                    self.context_switches += 1
                
                self.current_app = app_name
                self.current_pid = pid
                self.process_obj = process
                self.last_switch_time = current_time
                
                # Prime the CPU calculation (psutil requires a non-blocking prime call)
                if self.process_obj:
                    try:
                        self.process_obj.cpu_percent(interval=None)
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass

            # Sample CPU usage for the active application
            if self.process_obj:
                try:
                    # interval=None calculates CPU usage since the last call
                    cpu_usage = self.process_obj.cpu_percent(interval=None)
                    self.app_cpu_samples[self.current_app].append(cpu_usage)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass

            # Check if it is time to transmit the batch
            if current_time - batch_start_time >= self.batch_interval_seconds:
                # Add ongoing duration for the currently open app before transmitting
                time_spent = current_time - self.last_switch_time
                self.app_durations[self.current_app] += time_spent
                self.last_switch_time = current_time 
                
                batch_data = self.aggregate_batch()
                print("\n--- TICK Batch Generated ---")
                import json
                print(json.dumps(batch_data, indent=2))
                
                # In production, send this via requests.post() to the FastAPI backend
                
                self.reset_batch()
                batch_start_time = time.time()

            # Poll every 1 second
            time.sleep(1)

if __name__ == "__main__":
    # Using a 15-second interval for faster testing. 
    # Change to 180 (3 minutes) for production.
    monitor = TickAppCollector(batch_interval_seconds=15)
    monitor.start_monitoring()