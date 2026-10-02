#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Runs the database tests (pgTAP) against a throwaway local Postgres.
#
# WHY:  Row Level Security is the real lock on the data (AUTH-10, SEC-1). Every
#       policy needs a test proving each role cannot see or change what it must
#       not (SEC-12), and those tests must run on every push (ENGINEERING §10.1,
#       check `db-test`) without touching the real Supabase projects.
# HOW:  1. Creates an empty Postgres cluster in a temporary folder.
#       2. Loads supabase/tests/stub/supabase_stub.sql: the small parts of
#          Supabase the migrations rely on (the `auth` schema, `auth.uid()`,
#          the anon/authenticated/service_role roles and their default grants).
#       3. Applies every file in supabase/migrations/ in name order, the same
#          order Supabase uses.
#       4. Runs every supabase/tests/*.test.sql file with pg_prove.
#       5. Stops the cluster and deletes the folder, pass or fail.
# WHEN: `npm run db:test` locally; the `db-test` CI job on every push.
#       Needs Postgres 16 and pgTAP installed (CI installs them; locally:
#       `sudo apt-get install postgresql-16 postgresql-16-pgtap
#       libtap-parser-sourcehandler-pgtap-perl`).
# SECURITY: The cluster listens only on a private Unix socket in the temporary
#       folder (no TCP port) and is deleted afterwards. No real data or keys
#       are used.
# -----------------------------------------------------------------------------
set -euo pipefail
shopt -s nullglob

# Where Postgres' programs live. Debian/Ubuntu path by default; override with PG_BIN.
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# initdb refuses to run as root, so a root shell (e.g. a container) re-runs this
# script as the `postgres` system user, which the Postgres package creates.
if [ "$(id -u)" -eq 0 ]; then
  exec su postgres -s /bin/bash -c "PG_BIN='$PG_BIN' bash '$0'"
fi

WORK="$(mktemp -d)"
# Always stop the server and remove the folder, even when a test fails.
cleanup() {
  "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
# listen_addresses='' = no TCP; the socket lives only in our temporary folder.
"$PG_BIN/pg_ctl" -D "$WORK/data" -l "$WORK/server.log" -w \
  -o "-c listen_addresses='' -k $WORK -c timezone=UTC" start >/dev/null

export PGHOST="$WORK" PGUSER=postgres PGDATABASE=postgres
PSQL=("$PG_BIN/psql" -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" -c "create extension pgtap;"
"${PSQL[@]}" -f "$ROOT/supabase/tests/stub/supabase_stub.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$migration")"
  "${PSQL[@]}" -f "$migration"
done

pg_prove --ext .sql "$ROOT"/supabase/tests/*.test.sql
