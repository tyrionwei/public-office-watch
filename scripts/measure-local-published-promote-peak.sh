#!/usr/bin/env bash

set -euo pipefail

database_container="${1:-supabase_db_public-office-watch}"

database_size() {
  docker exec "$database_container" \
    psql -U postgres -d postgres -Atc 'select pg_database_size(current_database());'
}

before="$(database_size)"
minimum="$before"
maximum="$before"

docker exec "$database_container" \
  psql -U postgres -d postgres -Atc 'select published.promote(null);' \
  >/dev/null &
promote_pid=$!

while kill -0 "$promote_pid" 2>/dev/null; do
  value="$(database_size)"
  if (( value < minimum )); then minimum="$value"; fi
  if (( value > maximum )); then maximum="$value"; fi
  sleep 0.05
done

wait "$promote_pid"
after="$(database_size)"

printf 'before=%s\nminimum=%s\nmaximum=%s\nafter=%s\npeak_delta=%s\n' \
  "$before" \
  "$minimum" \
  "$maximum" \
  "$after" \
  "$((maximum - before))"
