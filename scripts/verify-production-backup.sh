#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backup_dir="$repo_root/tmp/production-backups/2026-08-02-pre-compaction"
container="public-office-watch-backup-verify"
image="public.ecr.aws/supabase/postgres:17.6.1.106"

fail() {
  printf 'production backup verification: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  if [[ "$container" == "public-office-watch-backup-verify" ]] \
    && docker inspect "$container" >/dev/null 2>&1; then
    docker rm -f "$container" >/dev/null
  fi
}

trap cleanup EXIT

for file in roles.sql schema.sql data.sql checksums.sha256; do
  [[ -f "$backup_dir/$file" ]] || fail "missing $backup_dir/$file"
done

docker inspect "$container" >/dev/null 2>&1 \
  && fail "refusing to replace existing container $container"

(
  cd "$repo_root"
  sha256sum --check "$backup_dir/checksums.sha256" >/dev/null
)

docker run -d \
  --name "$container" \
  -e POSTGRES_PASSWORD=backup-verify-local-only \
  "$image" >/dev/null

ready_count=0
for _ in $(seq 1 120); do
  if docker exec "$container" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    ready_count=$((ready_count + 1))
    if (( ready_count >= 5 )); then
      break
    fi
  else
    ready_count=0
  fi
  sleep 1
done

(( ready_count >= 5 )) \
  || fail "temporary database did not become ready"

docker exec -i "$container" \
  psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL' >/dev/null
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_role') THEN
    CREATE ROLE admin_role INHERIT NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'importer_role') THEN
    CREATE ROLE importer_role INHERIT NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
SQL
docker exec -i "$container" \
  psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < "$backup_dir/schema.sql" >/dev/null
docker exec -i "$container" \
  psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < "$backup_dir/data.sql" >/dev/null

mapfile -t restored_counts < <(
  docker exec -i "$container" psql -X -At -v ON_ERROR_STOP=1 \
    -U postgres -d postgres <<'SQL'
SELECT COUNT(*) FROM public.source_people;
SELECT COUNT(*) FROM public.person_identity_matches;
SELECT COUNT(*) FROM public.candidate_status_history;
SELECT COUNT(*) FROM public.person_claims;
SELECT COUNT(*) FROM public.person_party_affiliations;
SELECT COUNT(*) FROM published.release_state;
SQL
)

expected_counts=(46306 46008 65136 59361 3139 1)
[[ "${restored_counts[*]}" == "${expected_counts[*]}" ]] \
  || fail "restored counts differ: ${restored_counts[*]}"

database_bytes="$(
  docker exec "$container" psql -X -At -v ON_ERROR_STOP=1 \
    -U postgres -d postgres -c 'SELECT pg_database_size(current_database());'
)"

printf 'status=PASS\n'
printf 'database_bytes=%s\n' "$database_bytes"
printf 'source_people=%s\n' "${restored_counts[0]}"
printf 'person_identity_matches=%s\n' "${restored_counts[1]}"
printf 'candidate_status_history=%s\n' "${restored_counts[2]}"
printf 'person_claims=%s\n' "${restored_counts[3]}"
printf 'person_party_affiliations=%s\n' "${restored_counts[4]}"
