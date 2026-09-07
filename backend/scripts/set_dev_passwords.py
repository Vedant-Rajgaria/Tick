"""
seed.sql ships with `dev_only_not_a_real_hash` placeholders in
users.password_hash, which will never pass bcrypt.checkpw() — so nobody can
log in against a freshly-seeded dev database until this is run once.

Usage (from repo root, after scripts/setup_local_db.sh has loaded schema+seed):
    python -m backend.scripts.set_dev_passwords

Sets every seed user's password to the same dev-only value printed below.
Never run this against anything but a local dev database.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sqlalchemy import text
from backend.app.database import SessionLocal
from backend.app.security import hash_password

DEV_PASSWORD = "devpassword123"

SEED_EMAILS = [
    "priya@acme.test",
    "employee.a@acme.test",
    "employee.b@acme.test",
]


def main():
    db = SessionLocal()
    try:
        new_hash = hash_password(DEV_PASSWORD)
        result = db.execute(
            text("UPDATE users SET password_hash = :h WHERE email = ANY(:emails)"),
            {"h": new_hash, "emails": SEED_EMAILS},
        )
        db.commit()
        print(f"Updated {result.rowcount} seed users to password: {DEV_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
