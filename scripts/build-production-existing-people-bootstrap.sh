#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_container="supabase_db_public-office-watch"
input_migration="$repo_root/supabase/migrations/202607300028_build_existing_historical_cec_candidates.sql"
output_dir="$repo_root/tmp/production-existing-people-bootstrap"
required_ids="$output_dir/required-ids.txt"
container_ids="/tmp/public-office-watch-required-existing-people-ids.txt"
bootstrap_sql="$output_dir/people-and-identity-matches.sql"

fail() {
  printf 'production existing people bootstrap: %s\n' "$*" >&2
  exit 1
}

docker inspect "$source_container" >/dev/null 2>&1 \
  || fail "full local Supabase database is not running"
[[ -f "$input_migration" ]] || fail "missing $input_migration"

mkdir -p "$output_dir"
grep -Eo \
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' \
  "$input_migration" | sort -u > "$required_ids"
docker cp "$required_ids" "$source_container:$container_ids"

mapfile -t matched_counts < <(
  docker exec -i "$source_container" psql -X -qAt -v ON_ERROR_STOP=1 \
    -U postgres -d postgres <<SQL
CREATE TEMP TABLE _required_ids (id UUID PRIMARY KEY);
\copy _required_ids (id) FROM '$container_ids'
SELECT COUNT(*)
FROM (
    SELECT DISTINCT person.id
    FROM public.people person
    JOIN public.person_identity_matches identity_match ON identity_match.person_id = person.id
    JOIN public.source_people source ON source.id = identity_match.source_person_id
    WHERE source.source_type = 'official_election'
      AND source.source_id = 'cec-2024-votedata'
      AND identity_match.match_method NOT IN (
          'official_historical_source_scoped_new_person_v1',
          'official_historical_unresolved_source_scoped_person_v1'
      )
      AND NOT EXISTS (
          SELECT 1
          FROM public.person_identity_matches later_match
          WHERE later_match.source_person_id = identity_match.source_person_id
            AND later_match.match_method = 'official_historical_unresolved_source_scoped_person_v1'
      )
    UNION
    SELECT person.id
    FROM public.people person
    WHERE person.external_id IN (
        'internal-review-source-afc35868-1f62-41df-a6cf-e73df801b333'
    )
) retained_person;
SELECT COUNT(*) FROM public.races race JOIN _required_ids required USING (id);
SELECT COUNT(*)
FROM public.person_identity_matches identity_match
JOIN public.source_people source ON source.id = identity_match.source_person_id
WHERE source.source_type = 'official_election'
  AND source.source_id = 'cec-2024-votedata'
  AND identity_match.match_method NOT IN (
      'official_historical_source_scoped_new_person_v1',
      'official_historical_unresolved_source_scoped_person_v1'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM public.person_identity_matches later_match
      WHERE later_match.source_person_id = identity_match.source_person_id
        AND later_match.match_method = 'official_historical_unresolved_source_scoped_person_v1'
  );
SELECT COUNT(*)
FROM public.person_party_affiliations affiliation
JOIN public.people person ON person.id = affiliation.person_id
WHERE person.external_id IN (
    'internal-review-source-afc35868-1f62-41df-a6cf-e73df801b333'
);
SQL
)

{
  printf '%s\n' \
    '-- Generated approved official-election identity snapshot.' \
    'BEGIN;' \
    'CREATE TEMP TABLE _production_people_bootstrap' \
    '    (LIKE public.people INCLUDING DEFAULTS) ON COMMIT DROP;' \
    'COPY _production_people_bootstrap FROM stdin;'
  docker exec -i "$source_container" psql -X -qAt -v ON_ERROR_STOP=1 \
    -U postgres -d postgres <<SQL
COPY (
    SELECT DISTINCT person.*
    FROM public.people person
    JOIN public.person_identity_matches identity_match ON identity_match.person_id = person.id
    JOIN public.source_people source ON source.id = identity_match.source_person_id
    WHERE source.source_type = 'official_election'
      AND source.source_id = 'cec-2024-votedata'
      AND identity_match.match_method NOT IN (
          'official_historical_source_scoped_new_person_v1',
          'official_historical_unresolved_source_scoped_person_v1'
      )
      AND NOT EXISTS (
          SELECT 1
          FROM public.person_identity_matches later_match
          WHERE later_match.source_person_id = identity_match.source_person_id
            AND later_match.match_method = 'official_historical_unresolved_source_scoped_person_v1'
      )
    UNION
    SELECT person.*
    FROM public.people person
    WHERE person.external_id IN (
        'internal-review-source-afc35868-1f62-41df-a6cf-e73df801b333'
    )
    ORDER BY id
) TO STDOUT;
SQL
  printf '%s\n' \
    '\.' \
    'INSERT INTO public.people AS existing' \
    'SELECT * FROM _production_people_bootstrap' \
    'ON CONFLICT (id) DO UPDATE SET' \
    '    external_id = COALESCE(EXCLUDED.external_id, existing.external_id);' \
    'CREATE TEMP TABLE _production_affiliation_bootstrap' \
    '    (LIKE public.person_party_affiliations INCLUDING DEFAULTS) ON COMMIT DROP;' \
    'COPY _production_affiliation_bootstrap FROM stdin;'
  docker exec -i "$source_container" psql -X -qAt -v ON_ERROR_STOP=1 \
    -U postgres -d postgres <<SQL
COPY (
    SELECT affiliation.*
    FROM public.person_party_affiliations affiliation
    JOIN public.people person ON person.id = affiliation.person_id
    WHERE person.external_id IN (
        'internal-review-source-afc35868-1f62-41df-a6cf-e73df801b333'
    )
    ORDER BY affiliation.id
) TO STDOUT;
SQL
  printf '%s\n' \
    '\.' \
    'UPDATE _production_affiliation_bootstrap AS affiliation' \
    'SET source_person_id = source.id' \
    'FROM public.source_people AS source' \
    "WHERE affiliation.affiliation_key = 'official-site:tpp:current:16ecc7b88ee3a632:role:7c64db7ea5ecf5eeba75121ea80493a0'" \
    "  AND source.source_person_key = 'official-site:tpp:current:16ecc7b88ee3a632';" \
    'INSERT INTO public.person_party_affiliations' \
    'SELECT * FROM _production_affiliation_bootstrap' \
    'ON CONFLICT DO NOTHING;' \
    'DELETE FROM public.person_identity_matches AS existing_match' \
    'USING public.source_people AS source' \
    'WHERE source.id = existing_match.source_person_id' \
    '  AND (' \
    "      (source.source_type = 'official_election' AND source.source_id = 'cec-2024-votedata')" \
    "      OR source.source_person_key LIKE 'cec-historical:%'" \
    '  )' \
    '  AND existing_match.match_method NOT IN (' \
    "      'official_historical_source_scoped_new_person_v1'," \
    "      'official_historical_unresolved_source_scoped_person_v1'" \
    '  );' \
    'CREATE TEMP TABLE _production_identity_bootstrap' \
    '    (LIKE public.person_identity_matches INCLUDING DEFAULTS) ON COMMIT DROP;' \
    'COPY _production_identity_bootstrap FROM stdin;'
  docker exec -i "$source_container" psql -X -qAt -v ON_ERROR_STOP=1 \
    -U postgres -d postgres <<SQL
COPY (
    SELECT identity_match.*
    FROM public.person_identity_matches identity_match
    JOIN public.source_people source ON source.id = identity_match.source_person_id
    WHERE source.source_type = 'official_election'
      AND source.source_id = 'cec-2024-votedata'
      AND identity_match.match_method NOT IN (
          'official_historical_source_scoped_new_person_v1',
          'official_historical_unresolved_source_scoped_person_v1'
      )
      AND NOT EXISTS (
          SELECT 1
          FROM public.person_identity_matches later_match
          WHERE later_match.source_person_id = identity_match.source_person_id
            AND later_match.match_method = 'official_historical_unresolved_source_scoped_person_v1'
      )
    ORDER BY identity_match.id
) TO STDOUT;
SQL
  printf '%s\n' \
    '\.' \
    'INSERT INTO public.person_identity_matches' \
    'SELECT * FROM _production_identity_bootstrap' \
    'ON CONFLICT (source_person_id, person_id) DO UPDATE SET' \
    '    match_status = EXCLUDED.match_status,' \
    '    score = EXCLUDED.score,' \
    '    match_method = EXCLUDED.match_method,' \
    '    match_reason = EXCLUDED.match_reason,' \
    '    evidence_json = EXCLUDED.evidence_json,' \
    '    reviewed_by = EXCLUDED.reviewed_by,' \
    '    reviewed_at = EXCLUDED.reviewed_at,' \
    '    updated_at = EXCLUDED.updated_at;' \
    'COMMIT;'
} > "$bootstrap_sql"

chmod 600 "$required_ids" "$bootstrap_sql"
docker exec "$source_container" rm -f "$container_ids"

printf 'status=PASS\n'
printf 'required_uuid_literals=%s\n' "$(wc -l < "$required_ids")"
printf 'matched_people=%s\n' "${matched_counts[0]}"
printf 'matched_races=%s\n' "${matched_counts[1]}"
printf 'matched_identity_matches=%s\n' "${matched_counts[2]}"
printf 'matched_party_affiliations=%s\n' "${matched_counts[3]}"
printf 'bootstrap_bytes=%s\n' "$(wc -c < "$bootstrap_sql")"
printf 'bootstrap_sql=%s\n' "$bootstrap_sql"
