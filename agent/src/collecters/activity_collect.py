import time
import threading
from pynput import mouse, keyboard
import requests

# TICK Configuration based on constants_2.json defaults
BATCH_INTERVAL_SECONDS = 180
API_ENDPOINT = "http://localhost:8000/api/v1/activity/pulse"
DEVICE_ID = "DESKTOP-TEST-01"

class InputActivityCollector:
    def __init__(self):
        self.active_seconds_in_batch = 0
        self.last_activity_time = 0
        self.lock = threading.Lock()
        
    def register_activity(self, *args):
        """
        Triggered on any key press or mouse movement/click.
        We accept *args to absorb the event data (like which key was pressed),
        but we intentionally DO NOT store it.
        """
        current_time = time.time()
        
        with self.lock:
            # If it has been more than 1 second since the last recorded activity,
            # count this as a new active second.
            if current_time - self.last_activity_time >= 1.0:
                self.active_seconds_in_batch += 1
                self.last_activity_time = current_time

    def start_listeners(self):
        # Attach listeners for global OS events
        self.k_listener = keyboard.Listener(on_press=self.register_activity)
        self.m_listener = mouse.Listener(on_move=self.register_activity, on_click=self.register_activity)
        
        self.k_listener.start()
        self.m_listener.start()

    def transmit_batch(self):
        while True:
            time.sleep(BATCH_INTERVAL_SECONDS)
            
            with self.lock:
                active_time = self.active_seconds_in_batch
                idle_time = BATCH_INTERVAL_SECONDS - active_time
                self.active_seconds_in_batch = 0 # Reset for next batch
                
            payload = {
                "device_id": DEVICE_ID,
                "period_duration_seconds": BATCH_INTERVAL_SECONDS,
                "activity": {
                    "active_seconds": active_time,
                    "idle_seconds": idle_time
                },
                "event_type": "INPUT_ACTIVITY"
            }
            
            try:
                # In a real environment, this sends to the FastAPI backend
                print(f"Transmitting batch: {payload}")
                # requests.post(API_ENDPOINT, json=payload)
            except Exception as e:
                print(f"Failed to send batch: {e}")

if __name__ == "__main__":
    print("Starting TICK Input Privacy-Compliant Collector...")
    collector = InputActivityCollector()
    collector.start_listeners()
    
    # Run the batch transmitter in the main thread
    collector.transmit_batch()