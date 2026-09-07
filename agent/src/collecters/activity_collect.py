"""
Keyboard/mouse activity collector.

Contract fix (see docs/CONTRACT_CHANGE_PROCESS.md /
activity_batch.schema.json `inputActivity`): this collector previously only
tracked active/idle seconds and sent a payload shape + endpoint that didn't
match the schema at all. It now:
  - tracks keystroke_count and mouse_event_count as separate required
    fields (previously missing entirely)
  - exposes a snapshot()/reset() pair instead of owning its own transmit
    loop, so agent/src/main.py can combine it with the app-data collector
    into a single schema-conformant batch
  - no longer hits the network itself or hardcodes a device_id — that's
    agent_client.py's job now, using the integer device_id returned by
    POST /agent/register

Privacy property preserved: event *content* (which key, which pixel) is
never stored — only counts and presence/absence of activity.
"""
import time
import threading
from pynput import mouse, keyboard


class InputActivityCollector:
    def __init__(self):
        self.active_seconds_in_batch = 0
        self.keystroke_count = 0
        self.mouse_event_count = 0
        self.last_activity_time = 0.0
        self.lock = threading.Lock()

    def _on_key_press(self, *args):
        """*args absorbs the key event object — its contents are never read or stored."""
        with self.lock:
            self.keystroke_count += 1
        self._register_active_second()

    def _on_mouse_event(self, *args):
        """*args absorbs the mouse event object — its contents are never read or stored."""
        with self.lock:
            self.mouse_event_count += 1
        self._register_active_second()

    def _register_active_second(self):
        current_time = time.time()
        with self.lock:
            if current_time - self.last_activity_time >= 1.0:
                self.active_seconds_in_batch += 1
                self.last_activity_time = current_time

    def start_listeners(self):
        self.k_listener = keyboard.Listener(on_press=self._on_key_press)
        self.m_listener = mouse.Listener(
            on_move=self._on_mouse_event, on_click=self._on_mouse_event
        )
        self.k_listener.start()
        self.m_listener.start()

    def snapshot_and_reset(self, elapsed_seconds: int) -> dict:
        """
        Returns a dict matching the schema's `inputActivity` object exactly,
        and resets counters for the next batch window.
        """
        with self.lock:
            active_seconds = min(self.active_seconds_in_batch, elapsed_seconds)
            snapshot = {
                "keystroke_count": self.keystroke_count,
                "mouse_event_count": self.mouse_event_count,
                "active_seconds": active_seconds,
                "idle_seconds": max(elapsed_seconds - active_seconds, 0),
            }
            self.active_seconds_in_batch = 0
            self.keystroke_count = 0
            self.mouse_event_count = 0
        return snapshot


if __name__ == "__main__":
    # Standalone smoke test — prints a snapshot every 15s instead of the
    # production 180s batch interval. Real transmission happens in
    # agent/src/main.py via agent_client.py.
    print("Starting TICK Input Collector (standalone smoke test)...")
    collector = InputActivityCollector()
    collector.start_listeners()
    while True:
        time.sleep(15)
        print(collector.snapshot_and_reset(elapsed_seconds=15))
