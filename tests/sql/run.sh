#!/usr/bin/env bash
# Runs the repo's migrations and SQL tests against a throwaway local
# Postgres (no Supabase project involved). Needs PostgreSQL 14+ server
# binaries (initdb, pg_ctl) and psql on PATH or under /usr/lib/postgresql.
#   npm run test:sql
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PGBIN:$PATH"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/bb-sqltest.XXXXXX")"
PORT="${PGPORT_TEST:-55432}"
export PGHOST="$WORK" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres
cleanup() { pg_ctl -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
if [ "$(id -u)" = "0" ]; then
  # initdb refuses to run as root: use a scratch owner
  id bbpg >/dev/null 2>&1 || useradd -M -s /bin/false bbpg
  chown -R bbpg "$WORK"
  RUNAS=(runuser -u bbpg --)
else
  RUNAS=()
fi
"${RUNAS[@]}" initdb -D "$WORK/data" -U postgres -A trust >/dev/null
"${RUNAS[@]}" pg_ctl -D "$WORK/data" -o "-k $WORK -p $PORT -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
export PGOPTIONS="-c client_min_messages=warning"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" -f "$HERE/stub.sql"
MIGRATIONS=(
  schema.sql
  migration-add-auth-id.sql migration-add-color.sql migration-add-hidden.sql
  migration-per-player.sql migration-add-profile.sql migration-follows-tags.sql
  migration-tag-icons-covers.sql migration-contours-cover.sql migration-dev-tag-icons.sql
  migration-player-events.sql migration-ai-usage.sql migration-realtime.sql
  migration-scoped-data.sql migration-ai-log.sql migration-training-plans.sql migration-search-paths.sql
  migration-lock-writes.sql
)
for m in "${MIGRATIONS[@]}"; do
  [ -f "$ROOT/supabase/$m" ] || { echo "missing migration $m"; exit 1; }
  "${PSQL[@]}" -f "$ROOT/supabase/$m" >/dev/null
done
# every migration must be re-runnable
for m in "${MIGRATIONS[@]:13}"; do "${PSQL[@]}" -f "$ROOT/supabase/$m" >/dev/null; done
echo "migrations applied (twice for the new ones)"

fail=0
for t in "$HERE"/test_*.sql; do
  if "${PSQL[@]}" -f "$t" >"$WORK/out.txt" 2>&1; then
    echo "ok   $(basename "$t")"
  else
    echo "FAIL $(basename "$t")"; cat "$WORK/out.txt"; fail=1
  fi
done
for t in "$HERE"/test_*.sh; do
  [ -f "$t" ] || continue
  if PSQL_CMD="${PSQL[*]}" bash "$t" >"$WORK/out.txt" 2>&1; then
    echo "ok   $(basename "$t")"
  else
    echo "FAIL $(basename "$t")"; cat "$WORK/out.txt"; fail=1
  fi
done
exit $fail
