#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_container="supabase_db_public-office-watch"
output_dir="$repo_root/tmp/production-source-bootstrap"
required_ids="$output_dir/required-source-ids.txt"
container_ids="/tmp/public-office-watch-required-source-ids.txt"
bootstrap_sql="$output_dir/source-people.sql"
first_pending_version="${FIRST_PENDING_VERSION:-202608030001}"
last_pending_version="${LAST_PENDING_VERSION:-202608110016}"

fail() {
  printf 'production source bootstrap: %s\n' "$*" >&2
  exit 1
}

docker inspect "$source_container" >/dev/null 2>&1 \
  || fail "full local Supabase database is not running"

mkdir -p "$output_dir"
: > "$required_ids"

for migration in "$repo_root"/supabase/migrations/*.sql; do
  version="$(basename "$migration")"
  version="${version%%_*}"
  if [[ "$version" < "$first_pending_version" || "$version" > "$last_pending_version" ]]; then
    continue
  fi
  grep -Eo \
    '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' \
    "$migration" >> "$required_ids" || true
done

sort -u -o "$required_ids" "$required_ids"
docker cp "$required_ids" "$source_container:$container_ids"

matched_rows="$(
  docker exec -i "$source_container" psql -X -qAt -v ON_ERROR_STOP=1 \
    -U postgres -d postgres <<SQL
CREATE TEMP TABLE _required_source_ids (id UUID PRIMARY KEY);
\copy _required_source_ids (id) FROM '$container_ids'
SELECT COUNT(DISTINCT source.id)
FROM public.source_people source
WHERE EXISTS (SELECT 1 FROM _required_source_ids required WHERE required.id = source.id)
   OR (
       source.source_type = 'official_election'
       AND source.source_id = 'cec-2024-votedata'
   );
SQL
)"
matched_rows="$(printf '%s\n' "$matched_rows" | tail -n 1)"

{
  printf '%s\n' \
    '-- Generated minimal source snapshot for pending production migrations.' \
    'BEGIN;' \
    'CREATE TEMP TABLE _production_source_bootstrap' \
    '    (LIKE public.source_people INCLUDING DEFAULTS) ON COMMIT DROP;' \
    'COPY _production_source_bootstrap FROM stdin;'
  docker exec -i "$source_container" psql -X -qAt -v ON_ERROR_STOP=1 \
    -U postgres -d postgres <<SQL
CREATE TEMP TABLE _required_source_ids (id UUID PRIMARY KEY);
\copy _required_source_ids (id) FROM '$container_ids'
COPY (
    SELECT source.*
    FROM public.source_people source
    WHERE EXISTS (SELECT 1 FROM _required_source_ids required WHERE required.id = source.id)
       OR (
           source.source_type = 'official_election'
           AND source.source_id = 'cec-2024-votedata'
       )
    ORDER BY source.id
) TO STDOUT;
SQL
  printf '%s\n' \
    '\.' \
    'INSERT INTO public.source_people' \
    'SELECT * FROM _production_source_bootstrap' \
    'ON CONFLICT (id) DO UPDATE SET' \
    '    source_person_key = EXCLUDED.source_person_key,' \
    '    source_type = EXCLUDED.source_type,' \
    '    source_id = EXCLUDED.source_id,' \
    '    source_name = EXCLUDED.source_name,' \
    '    source_url = EXCLUDED.source_url,' \
    '    raw_name = EXCLUDED.raw_name,' \
    '    normalized_name = EXCLUDED.normalized_name,' \
    '    alias = EXCLUDED.alias,' \
    '    gender = EXCLUDED.gender,' \
    '    party = EXCLUDED.party,' \
    '    normalized_party = EXCLUDED.normalized_party,' \
    '    position = EXCLUDED.position,' \
    '    normalized_role = EXCLUDED.normalized_role,' \
    '    district = EXCLUDED.district,' \
    '    normalized_region = EXCLUDED.normalized_region,' \
    '    election_year = EXCLUDED.election_year,' \
    '    birth_date = EXCLUDED.birth_date,' \
    '    birth_date_text = EXCLUDED.birth_date_text,' \
    '    external_person_id = EXCLUDED.external_person_id,' \
    '    external_record_id = EXCLUDED.external_record_id,' \
    '    source_payload = EXCLUDED.source_payload,' \
    '    confidence_suggestion = EXCLUDED.confidence_suggestion,' \
    '    ingest_batch_key = EXCLUDED.ingest_batch_key,' \
    '    is_public = EXCLUDED.is_public,' \
    '    created_at = EXCLUDED.created_at,' \
    '    updated_at = EXCLUDED.updated_at;' \
    'COMMIT;'
} > "$bootstrap_sql"

chmod 600 "$required_ids" "$bootstrap_sql"
docker exec "$source_container" rm -f "$container_ids"

printf 'status=PASS\n'
printf 'required_uuid_literals=%s\n' "$(wc -l < "$required_ids")"
printf 'matched_source_people=%s\n' "$matched_rows"
printf 'bootstrap_bytes=%s\n' "$(wc -c < "$bootstrap_sql")"
printf 'bootstrap_sql=%s\n' "$bootstrap_sql"
