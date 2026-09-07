"""
Central runtime configuration for the TICK backend.

Everything here is loaded from environment variables (via a .env file in
local dev). Nothing sensitive is hardcoded — see .env.example for the
variables this expects.
"""
import os
from dotenv import load_dotenv

load_dotenv()


def _require(name: str, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if value is None:
        raise RuntimeError(
            f"Missing required environment variable: {name}. "
            f"Copy .env.example to .env and fill it in."
        )
    return value


class Settings:
    # --- Database ---
    DATABASE_URL: str = _require(
        "DATABASE_URL", "postgresql://tic:tic@localhost:5432/tic"
    )

    # --- JWT / Auth ---
    # In production this MUST be a long random secret injected via the
    # environment (e.g. `openssl rand -hex 32`). The default below only
    # exists so local dev doesn't crash on a missing .env, and is
    # intentionally obvious so nobody mistakes it for production-safe.
    JWT_SECRET: str = _require("JWT_SECRET", "dev-insecure-secret-change-me")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15")
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(
        os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "14")
    )

    # --- CORS (for the static frontend dashboards during dev) ---
    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:5500,http://127.0.0.1:5500,http://[::1]:5500"
    ).split(",")


settings = Settings()
