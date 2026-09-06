#!/usr/bin/env bash
# Native (no Docker) Postgres setup for TIC.
# Requires: Postgres installed and running locally, `psql` on your PATH.
# Run from the repo root: ./scripts/setup_local_db.sh

set -euo pipefail

if [ -f .env ]; then
  set -a
  source .env
  set +a
else
  echo "No .env found — copy .env.example to .env first." >&2
  exit 1
fi

DB_NAME="${POSTGRES_DB:-tic}"
DB_USER="${POSTGRES_USER:-tic}"
DB_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD not set in .env}"

RESET=false
if [ "${1:-}" == "--reset" ]; then
  RESET=true
fi

echo "Creating role '$DB_USER' if it doesn't exist..."
psql postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 \
  || psql postgres -c "CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASSWORD';"

echo "Creating database '$DB_NAME' if it doesn't exist..."
psql postgres -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || psql postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

if [ "$RESET" == true ]; then
  echo "Resetting schema (dropping and recreating public schema)..."
  psql -U "$DB_USER" -d "$DB_NAME" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
fi

TABLE_COUNT=$(psql -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")

if [ "$TABLE_COUNT" -gt 0 ] && [ "$RESET" == false ]; then
  echo "Schema already has $TABLE_COUNT tables — skipping schema.sql and seed.sql."
  echo "Run with --reset if you want a clean rebuild: ./scripts/setup_local_db.sh --reset"
else
  echo "Applying schema..."
  psql -U "$DB_USER" -d "$DB_NAME" -f backend/fixtures/schema.sql

  echo "Loading seed data..."
  psql -U "$DB_USER" -d "$DB_NAME" -f backend/fixtures/seed.sql
fi

echo "Done. '$DB_NAME' is ready with schema + seed data."
echo "Verify with: psql -U $DB_USER -d $DB_NAME -c \"SELECT name FROM users;\""
