#!/usr/bin/env bash
# Runs every migration, the seed, and the SQL tests against a throwaway database
# on a plain local Postgres (no Docker or Supabase CLI needed).
#
#   npm run db:test                     # uses database "bhojan_test"
#   BHOJAN_TEST_DB=other npm run db:test
#
# Requires psql/createdb/dropdb on PATH and a superuser connection (the default
# for Homebrew / Postgres.app installs). Creates the roles anon, authenticated
# and service_role on the local server if they do not exist.
set -euo pipefail

DB="${BHOJAN_TEST_DB:-bhojan_test}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 --no-psqlrc -d "$DB")

dropdb --if-exists "$DB"
createdb "$DB"

"${PSQL[@]}" -f "$HERE/supabase_shim.sql" >/dev/null
for migration in "$ROOT"/migrations/*.sql; do
  "${PSQL[@]}" -f "$migration" >/dev/null
done
"${PSQL[@]}" -f "$ROOT/seed.sql" >/dev/null
"${PSQL[@]}" -f "$HERE/helpers.sql" >/dev/null

for test in "$HERE"/*.test.sql; do
  echo "▶ $(basename "$test")"
  "${PSQL[@]}" -f "$test"
done

echo "✓ All database tests passed ($DB)."
