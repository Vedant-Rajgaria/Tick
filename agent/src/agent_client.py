"""
Talks to the TICK backend on behalf of the desktop agent:
  1. Logs in once with the employee's credentials to get access+refresh JWTs
  2. Registers (or re-registers) this device to get its integer device_id
  3. Transmits activity batches, transparently refreshing the access token
     when it expires (or once on a 401) before giving up

This replaces the commented-out `requests.post(...)` that both collectors
used to have, and fixes the endpoint mismatch (was /activity/pulse, is
/activity/batch) and the device_id type mismatch (was a hardcoded string,
is now the integer returned by /agent/register).
"""
import json
import time
from pathlib import Path

import requests

DEVICE_ID_CACHE = Path(__file__).parent / ".device_id_cache.json"


class AgentClient:
    def __init__(self, base_url: str, email: str, password: str, device_name: str, os_name: str, agent_version: str):
        self.base_url = base_url.rstrip("/")
        self.email = email
        self.password = password
        self.device_name = device_name
        self.os_name = os_name
        self.agent_version = agent_version

        self.access_token = None
        self.refresh_token = None
        self.device_id = self._load_cached_device_id()

    def _load_cached_device_id(self):
        if DEVICE_ID_CACHE.exists():
            try:
                return json.loads(DEVICE_ID_CACHE.read_text())["device_id"]
            except (json.JSONDecodeError, KeyError):
                return None
        return None

    def _cache_device_id(self, device_id: int):
        DEVICE_ID_CACHE.write_text(json.dumps({"device_id": device_id}))

    def _auth_headers(self):
        return {"Authorization": f"Bearer {self.access_token}"}

    def login(self):
        resp = requests.post(
            f"{self.base_url}/auth/login",
            json={"email": self.email, "password": self.password},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        self.access_token = data["access_token"]
        self.refresh_token = data["refresh_token"]

    def _refresh_access_token(self):
        resp = requests.post(
            f"{self.base_url}/auth/refresh",
            json={"refresh_token": self.refresh_token},
            timeout=10,
        )
        if resp.status_code == 401:
            # Refresh token itself expired — need a full re-login.
            self.login()
            return
        resp.raise_for_status()
        self.access_token = resp.json()["access_token"]

    def register_device(self):
        if self.device_id is not None:
            return self.device_id

        resp = requests.post(
            f"{self.base_url}/agent/register",
            json={
                "device_name": self.device_name,
                "os": self.os_name,
                "agent_version": self.agent_version,
            },
            headers=self._auth_headers(),
            timeout=10,
        )
        resp.raise_for_status()
        self.device_id = resp.json()["device_id"]
        self._cache_device_id(self.device_id)
        return self.device_id

    def send_batch(self, payload: dict, max_retries: int = 2) -> dict:
        payload = {**payload, "device_id": self.device_id}

        for attempt in range(max_retries + 1):
            resp = requests.post(
                f"{self.base_url}/activity/batch",
                json=payload,
                headers=self._auth_headers(),
                timeout=15,
            )
            if resp.status_code == 401 and attempt < max_retries:
                self._refresh_access_token()
                continue
            if resp.status_code == 422:
                # Schema validation failed server-side — log and drop rather
                # than retry forever on a payload that will never validate.
                print(f"Batch rejected by schema validation: {resp.json()}")
                return {"status": "rejected", "detail": resp.json()}
            resp.raise_for_status()
            return resp.json()

        raise RuntimeError("Failed to send batch after retrying token refresh")

    def ensure_ready(self):
        """Call once at startup: logs in and registers the device if needed."""
        if self.access_token is None:
            self.login()
        if self.device_id is None:
            self.register_device()
