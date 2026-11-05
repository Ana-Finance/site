#!/usr/bin/env bash
# Tests des migrations et des permissions (RLS) sur un PostgreSQL local jetable.
# Utilise DATABASE_URL si défini (ex. service PostgreSQL de GitHub Actions), sinon crée un cluster temporaire.
set -euo pipefail
cd "$(dirname "$0")/../.."
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)

if [[ -z "${DATABASE_URL:-}" ]]; then
  BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
  TMP=$(mktemp -d); chmod 777 "$TMP"
  RUN=(); [[ $(id -u) == 0 ]] && RUN=(runuser -u postgres --)
  "${RUN[@]}" "$BIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
  "${RUN[@]}" "$BIN/pg_ctl" -D "$TMP/data" -o "-k $TMP -c listen_addresses=''" -l "$TMP/log" start -w >/dev/null
  trap '"${RUN[@]}" "$BIN/pg_ctl" -D "$TMP/data" stop -m fast >/dev/null; rm -rf "$TMP"' EXIT
  "${RUN[@]}" "$BIN/createdb" -h "$TMP" -U postgres cms
  export DATABASE_URL="postgresql://postgres@/cms?host=$TMP"
fi

"${PSQL[@]}" "$DATABASE_URL" -f supabase/tests/stubs.sql
for f in supabase/migrations/*.sql; do echo "migration  $(basename "$f")"; "${PSQL[@]}" "$DATABASE_URL" -f "$f"; done
echo "seed       content.sql (x2, idempotence)"; "${PSQL[@]}" "$DATABASE_URL" -f supabase/seed/content.sql; "${PSQL[@]}" "$DATABASE_URL" -f supabase/seed/content.sql
for t in supabase/tests/*_test.sql; do echo "test       $(basename "$t")"; "${PSQL[@]}" "$DATABASE_URL" -f "$t"; done
echo "OK : migrations et permissions vérifiées."
