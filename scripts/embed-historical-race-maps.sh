#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_container="supabase_db_public-office-watch"
output_dir="$repo_root/tmp/historical-race-id-maps"
container_ids="/tmp/public-office-watch-historical-race-ids.txt"

fail() {
  printf 'historical race map embed: %s\n' "$*" >&2
  exit 1
}

docker inspect "$source_container" >/dev/null 2>&1 \
  || fail "full local Supabase database is not running"
mkdir -p "$output_dir"

for version in 202607300028 202607300030; do
  migration="$(find "$repo_root/supabase/migrations" -maxdepth 1 -type f -name "${version}_*.sql" -print -quit)"
  [[ -n "$migration" ]] || fail "missing migration $version"

  if grep -q "Resolve environment-specific race UUIDs by stable external ID ($version)." "$migration"; then
    printf 'version=%s status=SKIP reason=already_embedded\n' "$version"
    continue
  fi

  required_ids="$output_dir/${version}-required-ids.txt"
  snippet="$output_dir/${version}-race-map.sql"
  modified="$output_dir/${version}-modified.sql"

  grep -Eo \
    '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' \
    "$migration" | sort -u > "$required_ids"
  docker cp "$required_ids" "$source_container:$container_ids"

  {
    printf '%s\n' \
      "-- Resolve environment-specific race UUIDs by stable external ID ($version)." \
      "CREATE TEMP TABLE _historical_cec_race_id_map_${version} (" \
      '    source_race_id UUID PRIMARY KEY,' \
      '    race_external_id TEXT NOT NULL UNIQUE' \
      ') ON COMMIT DROP;' \
      "INSERT INTO _historical_cec_race_id_map_${version} (source_race_id, race_external_id) VALUES"
    docker exec -i "$source_container" psql -X -qAt -v ON_ERROR_STOP=1 \
      -U postgres -d postgres <<SQL
CREATE TEMP TABLE _required_ids (id UUID PRIMARY KEY);
\copy _required_ids (id) FROM '$container_ids'
WITH mapped AS (
    SELECT race.id, race.external_id
    FROM public.races race
    JOIN _required_ids required USING (id)
    WHERE race.external_id IS NOT NULL
), numbered AS (
    SELECT
        id,
        external_id,
        ROW_NUMBER() OVER (ORDER BY id) AS row_number,
        COUNT(*) OVER () AS row_count
    FROM mapped
)
SELECT
    '    (' || quote_literal(id::TEXT) || '::UUID, '
    || quote_literal(external_id) || ')'
    || CASE WHEN row_number < row_count THEN ',' ELSE ';' END
FROM numbered
ORDER BY id;
SQL
    printf '%s\n' \
      'UPDATE _historical_cec_existing_candidate_input_20260730 AS input' \
      'SET race_id = resolved_race.id' \
      "FROM _historical_cec_race_id_map_${version} AS race_map" \
      'JOIN public.races AS resolved_race' \
      '  ON resolved_race.external_id = race_map.race_external_id' \
      'WHERE input.race_id = race_map.source_race_id;' \
      ''
  } > "$snippet"

  mapping_count="$(grep -c "::UUID," "$snippet")"
  (( mapping_count > 0 )) || fail "no race mappings generated for $version"

  awk '
    NR == FNR { snippet = snippet $0 ORS; next }
    !inserted && $0 == "DO $verify$" { printf "%s", snippet; inserted = 1 }
    { print }
    END { if (!inserted) exit 42 }
  ' "$snippet" "$migration" > "$modified" \
    || fail "could not find first verification block in $version"

  mv "$modified" "$migration"
  chmod 644 "$migration"
  docker exec "$source_container" rm -f "$container_ids"

  printf 'version=%s status=PASS race_mappings=%s\n' "$version" "$mapping_count"
done
