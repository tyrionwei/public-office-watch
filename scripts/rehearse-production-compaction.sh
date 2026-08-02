#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backup_dir="$repo_root/tmp/production-backups/2026-08-02-pre-compaction"
report_dir="$repo_root/tmp/production-compaction-rehearsal"
report_file="$report_dir/report.txt"
bootstrap_sql="$repo_root/tmp/production-source-bootstrap/source-people.sql"
existing_people_bootstrap_sql="$repo_root/tmp/production-existing-people-bootstrap/people-and-identity-matches.sql"
public_set_verification_sql="$repo_root/scripts/verify-production-compaction-public-set.sql"
container="public-office-watch-compaction-rehearsal"
reference_container="supabase_db_public-office-watch-rehearsal"
image="public.ecr.aws/supabase/postgres:17.6.1.106"
first_pending_version="202607300011"
last_pending_version="202608010036"
budget_bytes=$((350 * 1024 * 1024))

fail() {
  printf 'production compaction rehearsal: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  if [[ "${KEEP_REHEARSAL_CONTAINER:-0}" == "1" ]]; then
    return
  fi
  if [[ "$container" == "public-office-watch-compaction-rehearsal" ]] \
    && docker inspect "$container" >/dev/null 2>&1; then
    docker rm -f "$container" >/dev/null
  fi
}

database_size() {
  docker exec "$container" psql -X -At -v ON_ERROR_STOP=1 \
    -U postgres -d postgres -c 'SELECT pg_database_size(current_database());'
}

public_counts() {
  local target_container="$1"
  docker exec -i "$target_container" psql -X -At -v ON_ERROR_STOP=1 \
    -U postgres -d postgres <<'SQL'
SELECT COUNT(*) FROM published.people;
SELECT COUNT(*) FROM published.elections;
SELECT COUNT(*) FROM published.races;
SELECT COUNT(*) FROM published.candidates;
SELECT COUNT(*) FROM published.candidate_facts;
SELECT COUNT(*) FROM published.search_documents;
SELECT COUNT(*) FROM public.public_people_list_cached;
SELECT COUNT(*) FROM published.release_state WHERE state_key = 'current';
SQL
}

trap cleanup EXIT

for file in roles.sql schema.sql data.sql checksums.sha256; do
  [[ -f "$backup_dir/$file" ]] || fail "missing $backup_dir/$file"
done
for file in production-compaction-phase-1.sql production-compaction-phase-2.sql verify-production-compaction-public-set.sql; do
  [[ -f "$repo_root/scripts/$file" ]] || fail "missing scripts/$file"
done

"$repo_root/scripts/build-production-source-bootstrap.sh" >/dev/null
[[ -f "$bootstrap_sql" ]] || fail "source bootstrap was not generated"

"$repo_root/scripts/build-production-existing-people-bootstrap.sh" >/dev/null
[[ -f "$existing_people_bootstrap_sql" ]] || fail "existing people bootstrap was not generated"

docker inspect "$container" >/dev/null 2>&1 \
  && fail "refusing to replace existing container $container"
docker inspect "$reference_container" >/dev/null 2>&1 \
  || fail "reference rehearsal container is not running"

reference_password="$(
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$reference_container" \
    | sed -n 's/^POSTGRES_PASSWORD=//p' \
    | head -n 1
)"
[[ -n "$reference_password" ]] || fail "reference database password is unavailable"

reference_network="$(
  docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$reference_container" \
    | head -n 1
)"
[[ -n "$reference_network" ]] || fail "reference database network is unavailable"

(
  cd "$repo_root"
  sha256sum --check "$backup_dir/checksums.sha256" >/dev/null
)

mkdir -p "$report_dir"

docker run -d \
  --name "$container" \
  -e POSTGRES_PASSWORD=compaction-rehearsal-local-only \
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
(( ready_count >= 5 )) || fail "temporary database did not become ready"

docker network connect "$reference_network" "$container"

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

baseline_bytes="$(database_size)"

docker exec -i "$container" \
  psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < "$bootstrap_sql" >/dev/null

docker exec -i "$container" \
  psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < "$repo_root/scripts/production-compaction-phase-1.sql" >/dev/null

phase_1_bytes="$(database_size)"

applied_migrations=0
for migration in "$repo_root"/supabase/migrations/*.sql; do
  version="$(basename "$migration")"
  version="${version%%_*}"
  if [[ "$version" < "$first_pending_version" || "$version" > "$last_pending_version" ]]; then
    continue
  fi

  if [[ "$version" == "202607300028" ]]; then
    docker exec -i "$container" \
      psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
      < "$existing_people_bootstrap_sql" >/dev/null
  fi

  printf 'applying %s\n' "$(basename "$migration")"
  docker exec -i "$container" \
    psql -X -1 -v ON_ERROR_STOP=1 -U postgres -d postgres \
    < "$migration" >/dev/null
  applied_migrations=$((applied_migrations + 1))
done

[[ "$applied_migrations" == "59" ]] \
  || fail "expected 59 pending migrations, applied $applied_migrations"

post_migration_bytes="$(database_size)"

docker exec -i "$container" \
  psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < "$repo_root/scripts/production-compaction-phase-2.sql" >/dev/null

final_bytes="$(database_size)"
mapfile -t actual_public_counts < <(public_counts "$container")
reference_connection="host=$reference_container port=5432 dbname=postgres user=postgres password=$reference_password"
if ! public_set_output="$(
  docker exec -i "$container" \
    psql -X -qAt -v ON_ERROR_STOP=1 \
      -v "reference_connection=$reference_connection" \
      -U postgres -d postgres \
      < "$public_set_verification_sql"
)"; then
  printf '%s\n' "$public_set_output" >&2
  fail "public stable-set verification failed"
fi
mapfile -t public_set_comparison <<< "$public_set_output"
(( ${#public_set_comparison[@]} > 0 )) || fail "public stable-set verification returned no results"

(( final_bytes <= budget_bytes )) \
  || fail "final database size $final_bytes exceeds $budget_bytes"

{
  printf 'status=PASS\n'
  printf 'applied_migrations=%s\n' "$applied_migrations"
  printf 'baseline_bytes=%s\n' "$baseline_bytes"
  printf 'phase_1_bytes=%s\n' "$phase_1_bytes"
  printf 'post_migration_bytes=%s\n' "$post_migration_bytes"
  printf 'final_bytes=%s\n' "$final_bytes"
  printf 'budget_bytes=%s\n' "$budget_bytes"
  printf 'public_counts=%s\n' "${actual_public_counts[*]}"
  printf 'public_set_comparison=%s\n' "${public_set_comparison[*]}"
} | tee "$report_file"
