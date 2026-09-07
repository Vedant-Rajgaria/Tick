"""
TICK Eye Tracking & Focus Telemetry Collector.

MediaPipe FaceLandmarker + OpenCV module refactored into a thread-safe
collector class (EyeTrackingCollector).

Privacy Guarantee:
- No video frames, image files, or raw landmark coordinates are ever
  stored on disk or transmitted across the network.
- Only aggregated mathematical metrics (focus_score, eye_z_score, camera_active)
  are output every interval.
"""
import os
import sys
import time
import math
import cv2
import numpy as np
import threading
from collections import deque
from datetime import datetime

import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# Canonical Landmark Indices
L_OUTER, L_INNER = 33, 133
L_TOP, L_BOT = 159, 145
L_IRIS = 468
R_INNER, R_OUTER = 362, 263
R_TOP, R_BOT = 386, 374
R_IRIS = 473

# Mouth Landmarks for Yawn Detection
MOUTH_TOP = 13
MOUTH_BOT = 14
MOUTH_LEFT = 61
MOUTH_RIGHT = 291

# Vision Telemetry Thresholds
EAR_BLINK_THRESHOLD = 0.20
EAR_DROWSY_THRESHOLD = 0.24
MICROSLEEP_CONSECUTIVE_FRAMES = 4

MAR_YAWN_THRESHOLD = 0.55
YAWN_CONSECUTIVE_FRAMES = 5

# Dynamic Threshold Configuration
DEFAULT_ACTIVE_THRESHOLD = 40.0
MIN_THRESHOLD_LIMIT = 20.0
MAX_THRESHOLD_LIMIT = 70.0

# Sliding Window Configuration
SMOOTHING_WINDOW_FRAMES = 600
PROCESS_EVERY_N_FRAMES = 2


# ---------------------------------------------------------
# Core Math Functions
# ---------------------------------------------------------
def calculate_ear(top, bot, inner, outer):
    v = np.linalg.norm(np.array(top) - np.array(bot))
    h = np.linalg.norm(np.array(inner) - np.array(outer))
    return 0.0 if h == 0 else float(v / h)


def calculate_mar(top, bot, left, right):
    v = np.linalg.norm(np.array(top) - np.array(bot))
    h = np.linalg.norm(np.array(left) - np.array(right))
    return 0.0 if h == 0 else float(v / h)


def get_gaze_direction(iris, inner, outer):
    width = np.linalg.norm(np.array(outer) - np.array(inner))
    if width == 0:
        return "CENTER"
    ratio = np.linalg.norm(np.array(iris) - np.array(inner)) / width
    if ratio < 0.35 or ratio > 0.65:
        return "AWAY"
    return "CENTER"


# ---------------------------------------------------------
# Z-Score Statistical Baseline & Dynamic Threshold
# ---------------------------------------------------------
class StatisticalBaseline:
    def __init__(self, history_limit=20):
        self.history = []
        self.history_limit = history_limit
        self.lock = threading.Lock()

    def update_history(self, x: float):
        with self.lock:
            self.history.append(x)
            if len(self.history) > self.history_limit:
                self.history.pop(0)

    def calculate_z_score(self, x: float) -> float:
        with self.lock:
            n = len(self.history)
            if n < 3:
                return 0.0
            v = sum(self.history) / n
            variance = sum((xi - v) ** 2 for xi in self.history) / n
            sigma = math.sqrt(variance)
            return 0.0 if sigma == 0 else float((x - v) / sigma)

    def get_personal_threshold(self) -> float:
        """Calculates custom threshold based on user historical baseline."""
        with self.lock:
            n = len(self.history)
            if n < 3:
                return DEFAULT_ACTIVE_THRESHOLD
            v = sum(self.history) / n
            variance = sum((xi - v) ** 2 for xi in self.history) / n
            sigma = math.sqrt(variance)
            personal_thresh = v - (1.5 * sigma)
            return float(max(MIN_THRESHOLD_LIMIT, min(personal_thresh, MAX_THRESHOLD_LIMIT)))


# ---------------------------------------------------------
# EyeTrackingCollector Class
# ---------------------------------------------------------
class EyeTrackingCollector:
    """
    Thread-safe collector for webcam-based focus & fatigue tracking.

    Supports:
    - Default headless background execution without opening GUI windows.
    - Optional --debug-ui live feed with cv2.imshow.
    - Unified debug display overlay dynamically expanded via cv2.copyMakeBorder
      rendering live system telemetry (keystrokes, mouse events, active window).
    - Camera hijack fallback (Zoom/Teams lock -> camera_active=False gracefully).
    """

    def __init__(self, model_path: str = None, debug_ui: bool = False, telemetry_provider=None):
        self.debug_ui = debug_ui
        self.telemetry_provider = telemetry_provider
        self.user_baseline = StatisticalBaseline()

        self.camera_active = False
        self.batch_scores = []
        self.focus_history = deque(maxlen=SMOOTHING_WINDOW_FRAMES)
        self.current_focus_score = 100.0
        self.current_state_label = "INITIALIZING..."
        self.state_color = (255, 255, 255)

        self.lock = threading.Lock()
        self.running = threading.Event()
        self._thread = None
        self.detector = None

        # Resolve model path
        self.resolved_model_path = self._resolve_model_path(model_path)
        if self.resolved_model_path:
            try:
                base_options = python.BaseOptions(model_asset_path=self.resolved_model_path)
                options = vision.FaceLandmarkerOptions(
                    base_options=base_options,
                    output_face_blendshapes=False,
                    output_facial_transformation_matrixes=False,
                    num_faces=1,
                    running_mode=vision.RunningMode.IMAGE
                )
                self.detector = vision.FaceLandmarker.create_from_options(options)
                print(f"[EyeTracker] MediaPipe FaceLandmarker loaded: {self.resolved_model_path}")
            except Exception as exc:
                print(f"[EyeTracker] Warning: Failed to load FaceLandmarker detector: {exc}")
                self.detector = None
        else:
            print("[EyeTracker] Warning: face_landmarker.task model not found. Eye tracker will run inactive.")

    def _resolve_model_path(self, model_path: str = None) -> str | None:
        candidates = []
        if model_path:
            candidates.append(model_path)
        module_dir = os.path.dirname(os.path.abspath(__file__))
        candidates.append(os.path.join(module_dir, "face_landmarker.task"))
        candidates.append(os.path.join(os.getcwd(), "agent", "src", "collecters", "face_landmarker.task"))
        candidates.append(os.path.join(os.getcwd(), "face_landmarker.task"))

        for path in candidates:
            if os.path.exists(path):
                return os.path.abspath(path)
        return None

    def start(self):
        """Starts background eye tracking capture thread."""
        if self.running.is_set():
            return
        self.running.set()
        self._thread = threading.Thread(
            target=self._capture_loop,
            name="EyeTrackingCollectorThread",
            daemon=True
        )
        self._thread.start()
        mode_str = "Debug UI enabled" if self.debug_ui else "Headless mode"
        print(f"[EyeTracker] Collector started ({mode_str}).")

    def stop(self):
        """Stops background capture thread and frees resources."""
        self.running.clear()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        with self.lock:
            self.camera_active = False

    def _capture_loop(self):
        """Internal capture loop running in background thread."""
        cap = None
        session_id = 1
        frame_counter = 0
        yawn_frame_count = 0
        closed_eye_frame_count = 0

        smoothed_brightness = 100.0
        smoothed_blur = 100.0
        active_alert_msg = ""
        alert_hold_until = 0.0

        try:
            while self.running.is_set():
                # Attempt to open camera if not opened
                if cap is None or not cap.isOpened():
                    cap = cv2.VideoCapture(0)
                    if not cap.isOpened():
                        with self.lock:
                            self.camera_active = False
                        # Camera in use by another app (e.g. Zoom/Teams) or missing
                        time.sleep(2.0)
                        continue

                ret, frame = cap.read()
                if not ret or frame is None:
                    # Camera hijacked or lost feed
                    with self.lock:
                        self.camera_active = False
                    if cap is not None:
                        cap.release()
                        cap = None
                    time.sleep(2.0)
                    continue

                # Camera is delivering frames
                with self.lock:
                    self.camera_active = True

                frame = cv2.flip(frame, 1)
                h, w = frame.shape[:2]
                frame_counter += 1
                now = time.time()

                dynamic_threshold = self.user_baseline.get_personal_threshold()

                # Environmental & Lens Health Check
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                raw_brightness = float(np.mean(gray))
                raw_blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())

                smoothed_brightness = (0.85 * smoothed_brightness) + (0.15 * raw_brightness)
                smoothed_blur = (0.85 * smoothed_blur) + (0.15 * raw_blur)

                if smoothed_brightness < 40.0:
                    active_alert_msg = "ALERT: Improve Surrounding Light"
                    alert_hold_until = now + 2.5
                elif smoothed_blur < 45.0:
                    active_alert_msg = "ALERT: Clean Eyelens/Webcam (Blurry Feed)"
                    alert_hold_until = now + 2.5
                elif now > alert_hold_until:
                    active_alert_msg = ""

                # Vision Inference Loop
                if self.detector is not None and (frame_counter % PROCESS_EVERY_N_FRAMES == 0):
                    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
                    try:
                        detection = self.detector.detect(mp_image)
                    except Exception:
                        detection = None

                    frame_score = 1.0
                    is_yawning = False
                    is_sleeping = False
                    is_droopy = False

                    if not detection or not detection.face_landmarks:
                        frame_score = 0.0
                        label = "AWAY / NO FACE"
                        color = (0, 0, 255)
                        closed_eye_frame_count = 0
                        yawn_frame_count = 0
                    else:
                        landmarks = detection.face_landmarks[0]

                        def px(idx):
                            return (int(landmarks[idx].x * w), int(landmarks[idx].y * h))

                        # Yawn Detection
                        mar = calculate_mar(px(MOUTH_TOP), px(MOUTH_BOT), px(MOUTH_LEFT), px(MOUTH_RIGHT))
                        if mar > MAR_YAWN_THRESHOLD:
                            yawn_frame_count += 1
                        else:
                            yawn_frame_count = 0

                        if yawn_frame_count >= YAWN_CONSECUTIVE_FRAMES:
                            is_yawning = True

                        # EAR & Sleep Detection
                        ear = (
                            calculate_ear(px(L_TOP), px(L_BOT), px(L_INNER), px(L_OUTER))
                            + calculate_ear(px(R_TOP), px(R_BOT), px(R_INNER), px(R_OUTER))
                        ) / 2.0

                        if ear < EAR_BLINK_THRESHOLD:
                            closed_eye_frame_count += 1
                            gaze_dir = "CLOSED"
                            if closed_eye_frame_count >= MICROSLEEP_CONSECUTIVE_FRAMES:
                                is_sleeping = True
                        else:
                            closed_eye_frame_count = 0
                            gaze_dir = get_gaze_direction(px(L_IRIS), px(L_INNER), px(L_OUTER))
                            if ear < EAR_DROWSY_THRESHOLD:
                                is_droopy = True

                        # State Labeling
                        if is_sleeping:
                            frame_score -= 0.85
                            label = "DROWSY (EYES CLOSED)"
                            color = (0, 0, 255)
                        elif is_yawning:
                            frame_score -= 0.50
                            label = "FATIGUE (YAWNING)"
                            color = (0, 165, 255)
                        elif is_droopy:
                            frame_score -= 0.35
                            label = "FATIGUE (DROWSY EYES)"
                            color = (0, 165, 255)
                        elif gaze_dir == "AWAY":
                            frame_score -= 0.70
                            label = "DISTRACTED"
                            color = (0, 0, 255)
                        else:
                            label = "FOCUSED"
                            color = (0, 255, 0)

                    frame_score = max(0.0, frame_score)

                    with self.lock:
                        self.batch_scores.append(frame_score)
                        self.focus_history.append(frame_score)
                        if len(self.focus_history) > 0:
                            self.current_focus_score = (sum(self.focus_history) / len(self.focus_history)) * 100.0
                        self.current_state_label = label
                        self.state_color = color

                # Debug UI Rendering (Requirement 3)
                if self.debug_ui:
                    with self.lock:
                        cur_label = self.current_state_label
                        cur_color = self.state_color
                        cur_score = self.current_focus_score

                    # Render top-level HUD on camera frame
                    cv2.putText(frame, f"TICK MVP | Session: {session_id}", (20, 35),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                    cv2.putText(frame, f"STATE: {cur_label}", (20, 70),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, cur_color, 2)
                    cv2.putText(frame, f"Live Focus: {cur_score:.1f}%", (20, 105),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)
                    cv2.putText(frame, f"Target Threshold: {dynamic_threshold:.1f}%", (20, 130),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

                    if active_alert_msg:
                        cv2.rectangle(frame, (10, h - 45), (w - 10, h - 10), (0, 0, 0), -1)
                        cv2.putText(frame, active_alert_msg, (20, h - 20),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 140, 255), 2)

                    # Expand frame with bottom border for live system telemetry HUD (Requirement 3)
                    border_height = 75
                    display_frame = cv2.copyMakeBorder(
                        frame,
                        top=0,
                        bottom=border_height,
                        left=0,
                        right=0,
                        borderType=cv2.BORDER_CONSTANT,
                        value=[24, 24, 27]  # Dark sleek border
                    )

                    # Obtain live telemetry
                    telemetry = {}
                    if callable(self.telemetry_provider):
                        try:
                            telemetry = self.telemetry_provider() or {}
                        except Exception:
                            telemetry = {}

                    keystroke_cnt = telemetry.get("keystrokes", 0)
                    mouse_cnt = telemetry.get("mouse_events", 0)
                    active_app = telemetry.get("app_name", "Desktop")

                    # Render live system telemetry directly below camera feed
                    cv2.putText(
                        display_frame,
                        f"LIVE TELEMETRY | Keystrokes: {keystroke_cnt} | Mouse Events: {mouse_cnt}",
                        (20, h + 30),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.55,
                        (255, 255, 255),
                        1,
                        cv2.LINE_AA
                    )
                    cv2.putText(
                        display_frame,
                        f"ACTIVE APP: {active_app[:55]}",
                        (20, h + 60),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.55,
                        (0, 215, 255),
                        1,
                        cv2.LINE_AA
                    )

                    cv2.imshow("TIC - Corporate Agent", display_frame)
                    key = cv2.waitKey(1) & 0xFF
                    if key == ord('q'):
                        self.running.clear()
                        break
                else:
                    # Headless mode: light sleep to avoid burning CPU cycles
                    time.sleep(0.02)

        except Exception as exc:
            print(f"[EyeTracker] Error in capture loop: {exc}")
        finally:
            if cap is not None and cap.isOpened():
                cap.release()
            if self.debug_ui:
                try:
                    cv2.destroyAllWindows()
                except Exception:
                    pass
            with self.lock:
                self.camera_active = False

    def snapshot_and_reset(self, elapsed_seconds: int) -> dict:
        """
        Computes the interval focus score, z-score anomaly, and dynamic threshold.
        Returns a dictionary with focus telemetry for the batch and resets interval accumulators.
        """
        with self.lock:
            applied_threshold = round(self.user_baseline.get_personal_threshold(), 2)

            if self.camera_active and (len(self.batch_scores) > 0 or len(self.focus_history) > 0):
                if len(self.batch_scores) > 0:
                    avg_score = sum(self.batch_scores) / len(self.batch_scores)
                    final_focus_score = round(max(0.0, min(100.0, avg_score * 100.0)), 2)
                else:
                    final_focus_score = round(max(0.0, min(100.0, self.current_focus_score)), 2)

                z_score = round(self.user_baseline.calculate_z_score(final_focus_score), 2)
                eye_activity = 1.0 if final_focus_score >= applied_threshold else 0.0

                if final_focus_score >= applied_threshold:
                    self.user_baseline.update_history(final_focus_score)

                snapshot = {
                    "camera_active": True,
                    "focus_score": final_focus_score,
                    "applied_threshold": applied_threshold,
                    "eye_z_score": z_score,
                    "eye_activity": eye_activity,
                    "is_anomalous": bool(z_score <= -1.5),
                }
            else:
                snapshot = {
                    "camera_active": False,
                    "focus_score": None,
                    "applied_threshold": applied_threshold,
                    "eye_z_score": None,
                    "eye_activity": 0.0,
                    "is_anomalous": False,
                }

            self.batch_scores.clear()
            return snapshot


if __name__ == "__main__":
    print("Starting EyeTrackingCollector standalone demo (with --debug-ui)...")
    collector = EyeTrackingCollector(
        debug_ui=True,
        telemetry_provider=lambda: {"keystrokes": 42, "mouse_events": 128, "app_name": "code.exe"}
    )
    collector.start()
    try:
        while collector.running.is_set():
            time.sleep(5)
            snap = collector.snapshot_and_reset(elapsed_seconds=5)
            print(f"[Telemetry Snapshot]: {snap}")
    except KeyboardInterrupt:
        print("\nStopping standalone demo.")
    finally:
        collector.stop()