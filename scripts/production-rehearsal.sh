#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_config="$repo_root/supabase/config.toml"
workdir="$repo_root/tmp/production-rehearsal"
rehearsal_config="$workdir/supabase/config.toml"
bootstrap_migration="$workdir/supabase/migrations/00000000000000_bootstrap_published.sql"
schema_dump="$workdir/schema.sql"
roles_dump="$workdir/roles.sql"
table_access_dump="$workdir/table-access.sql"
report_file="$workdir/capacity-report.txt"
web_env_file="$repo_root/apps/web/.env.rehearsal.local"

source_project_id="public-office-watch"
rehearsal_project_id="public-office-watch-rehearsal"
source_container="supabase_db_${source_project_id}"
rehearsal_container="supabase_db_${rehearsal_project_id}"
rehearsal_api_port=55321
rehearsal_db_port=55322
budget_mib="${REHEARSAL_BUDGET_MIB:-350}"

fail() {
  printf 'production rehearsal: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

read_project_id() {
  sed -n 's/^project_id = "\([^"]*\)"/\1/p' "$1" | head -n 1
}

assert_source_environment() {
  [[ -f "$source_config" ]] || fail "missing source config: $source_config"
  [[ "$(read_project_id "$source_config")" == "$source_project_id" ]] \
    || fail "source project id must be $source_project_id"
  docker inspect "$source_container" >/dev/null 2>&1 \
    || fail "the full local Supabase database is not running"
}

write_rehearsal_config() {
  mkdir -p "$(dirname "$rehearsal_config")"

  awk '
    /^\[/ { section = $0 }
    {
      if ($0 == "project_id = \"public-office-watch\"") {
        print "project_id = \"public-office-watch-rehearsal\""
        next
      }
      if (section == "[db.migrations]" && $0 ~ /^enabled = /) {
        print "enabled = true"
        next
      }
      if (section == "[db.seed]" && $0 ~ /^enabled = /) {
        print "enabled = false"
        next
      }
      if ($0 == "site_url = \"http://127.0.0.1:3000\"") {
        print "site_url = \"http://127.0.0.1:5173\""
        next
      }
      gsub(/port = 54320$/, "port = 55320")
      gsub(/port = 54321$/, "port = 55321")
      gsub(/port = 54322$/, "port = 55322")
      gsub(/port = 54323$/, "port = 55323")
      gsub(/port = 54324$/, "port = 55324")
      gsub(/port = 54327$/, "port = 55327")
      gsub(/port = 54329$/, "port = 55329")
      gsub(/inspector_port = 8083$/, "inspector_port = 8183")
      print
    }
  ' "$source_config" > "$rehearsal_config"

  mkdir -p "$(dirname "$bootstrap_migration")"
  printf '%s\n' 'CREATE SCHEMA IF NOT EXISTS published AUTHORIZATION postgres;' \
    > "$bootstrap_migration"

  [[ "$(read_project_id "$rehearsal_config")" == "$rehearsal_project_id" ]] \
    || fail "refusing to use a rehearsal config with an unexpected project id"
  grep -q '^port = 55322$' "$rehearsal_config" \
    || fail "rehearsal database port was not isolated"
  grep -q '^port = 55321$' "$rehearsal_config" \
    || fail "rehearsal API port was not isolated"
}

rehearsal_is_running() {
  docker inspect "$rehearsal_container" >/dev/null 2>&1
}

stop_rehearsal() {
  write_rehearsal_config
  if rehearsal_is_running; then
    npx supabase stop \
      --workdir "$workdir" \
      --project-id "$rehearsal_project_id" \
      --no-backup \
      --yes >/dev/null
  fi
}

start_rehearsal() {
  write_rehearsal_config
  npx supabase start \
    --workdir "$workdir" \
    --exclude imgproxy,edge-runtime,logflare,vector,supavisor \
    --yes >/dev/null
  rehearsal_is_running || fail "rehearsal database did not start"
}

dump_and_apply_schema() {
  npx supabase db dump \
    --local \
    --role-only \
    --file "$roles_dump" >/dev/null
  npx supabase db dump \
    --local \
    --schema public,published \
    --file "$schema_dump" >/dev/null

  docker exec -i "$rehearsal_container" \
    psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
    < "$roles_dump" >/dev/null
  docker exec -i "$rehearsal_container" \
    psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
    < "$schema_dump" >/dev/null
}

mirror_frontend_table_access() {
  {
    printf '%s\n' \
      'REVOKE ALL ON ALL TABLES IN SCHEMA public, published FROM anon, authenticated;' \
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;' \
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA published REVOKE ALL ON TABLES FROM anon, authenticated;'
    docker exec "$source_container" \
      psql -X -At -U postgres -d postgres -c \
      "SELECT FORMAT('GRANT %s ON TABLE %I.%I TO %I;', STRING_AGG(access.privilege_type::TEXT, ', ' ORDER BY access.privilege_type::TEXT), namespace.nspname, relation.relname, grantee.rolname) FROM pg_class relation JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace CROSS JOIN LATERAL aclexplode(COALESCE(relation.relacl, acldefault('r', relation.relowner))) access JOIN pg_roles grantee ON grantee.oid = access.grantee WHERE namespace.nspname IN ('public', 'published') AND relation.relkind IN ('r', 'p', 'v', 'm', 'f') AND grantee.rolname IN ('anon', 'authenticated') GROUP BY namespace.nspname, relation.relname, grantee.rolname ORDER BY namespace.nspname, relation.relname, grantee.rolname;"
  } > "$table_access_dump"

  docker exec -i "$rehearsal_container" \
    psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
    < "$table_access_dump" >/dev/null
}

copy_table() {
  local table="$1"
  local predicate="${2:-TRUE}"
  local source_sql
  local target_sql

  source_sql="COPY (SELECT * FROM public.${table} WHERE ${predicate}) TO STDOUT WITH (FORMAT csv)"
  target_sql="SET session_replication_role = replica; COPY public.${table} FROM STDIN WITH (FORMAT csv);"

  printf 'copying %-38s' "$table"
  docker exec "$source_container" \
    psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres -c "$source_sql" \
    | docker exec -i "$rehearsal_container" \
        psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres -c "$target_sql" \
        >/dev/null
  printf ' done\n'
}

copy_runtime_data() {
  # Core graph rows stay intact so canonical merge views produce the same public IDs.
  copy_table regions
  copy_table elections
  copy_table races
  copy_table parties 'is_public = TRUE'
  copy_table people
  copy_table candidates
  copy_table companies 'is_public = TRUE'
  copy_table person_merge_decisions
  copy_table election_merge_decisions
  copy_table race_merge_decisions

  # Only approved claims that the public person profile still needs at runtime.
  copy_table person_claims \
    "is_public = TRUE AND visibility = 'public' AND review_status = 'verified' AND claim_type IN ('education','experience','platform','family_relation','legal_case','office')"
  copy_table person_media \
    "is_public = TRUE AND verification_status = 'verified'"
  copy_table person_company_relations \
    "is_public = TRUE AND verification_status = 'verified'"
  copy_table person_party_affiliations \
    "is_public = TRUE AND review_status = 'verified'"
  copy_table person_party_events \
    "is_public = TRUE AND review_status = 'verified'"

  copy_table party_annual_finance_filings 'is_public = TRUE'
  copy_table party_finance_summaries 'is_public = TRUE'
  copy_table party_company_contribution_summaries 'is_public = TRUE'
  copy_table current_office_exclusions
  copy_table region_issues 'is_public = TRUE'
  copy_table chat_settings
}

refresh_publication_layer() {
  docker exec -i "$rehearsal_container" \
    psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL' >/dev/null
REFRESH MATERIALIZED VIEW public.public_people_list_cached;
SELECT published.promote(NULL);
ANALYZE;
SQL

  [[ "$(docker exec "$rehearsal_container" psql -X -At -U postgres -d postgres \
    -c "SELECT COUNT(*) FROM published.release_state WHERE state_key = 'current';")" == "1" ]] \
    || fail "published promote did not create a release state"
}

write_web_environment() {
  local status_env
  local anon_key

  status_env="$(npx supabase status --workdir "$workdir" --output env 2>/dev/null)"
  anon_key="$(printf '%s\n' "$status_env" | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p' | head -n 1)"
  if [[ -z "$anon_key" ]]; then
    anon_key="$(printf '%s\n' "$status_env" | sed -n 's/^PUBLISHABLE_KEY="\(.*\)"$/\1/p' | head -n 1)"
  fi
  [[ -n "$anon_key" ]] || fail "could not read the local rehearsal anon key"

  umask 077
  {
    printf 'VITE_SUPABASE_URL=http://127.0.0.1:%s\n' "$rehearsal_api_port"
    printf 'VITE_SUPABASE_ANON_KEY=%s\n' "$anon_key"
    printf 'VITE_PUBLIC_DATA_PROVIDER=published\n'
    printf 'VITE_ENABLE_PUBLISHED_PROVIDER=true\n'
  } > "$web_env_file"
}

smoke_public_api() {
  npm --prefix "$repo_root/apps/web" run smoke:published-rehearsal
}

report_capacity() {
  rehearsal_is_running || fail "rehearsal database is not running"
  [[ "$(docker exec "$rehearsal_container" psql -X -At -U postgres -d postgres \
    -c "SELECT COUNT(*) FROM published.release_state WHERE state_key = 'current';")" == "1" ]] \
    || fail "capacity report requires a completed published release"

  local database_bytes
  local budget_bytes=$((budget_mib * 1024 * 1024))
  local status="PASS"

  database_bytes="$(docker exec "$rehearsal_container" \
    psql -X -At -U postgres -d postgres \
    -c 'SELECT pg_database_size(current_database());')"

  if (( database_bytes > budget_bytes )); then
    status="WARN"
  fi

  {
    printf 'status=%s\n' "$status"
    printf 'database_bytes=%s\n' "$database_bytes"
    printf 'database_mib=%s\n' "$((database_bytes / 1024 / 1024))"
    printf 'budget_mib=%s\n' "$budget_mib"
    printf 'free_plan_limit_mib=500\n'
    printf '\nrelease_state\n'
    docker exec "$rehearsal_container" psql -X -At -U postgres -d postgres \
      -c "SELECT schema_version || '|' || validated_row_counts::TEXT FROM published.release_state WHERE state_key = 'current';"
    printf '\nlargest_relations\n'
    docker exec "$rehearsal_container" psql -X -At -U postgres -d postgres \
      -c "SELECT schemaname || '.' || relname || '|' || pg_total_relation_size(relid) FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 25;"
  } | tee "$report_file"

  if [[ "$status" == "WARN" ]]; then
    printf 'capacity warning: rehearsal is above the %s MiB target\n' "$budget_mib" >&2
  fi
}

rebuild_rehearsal() {
  assert_source_environment
  stop_rehearsal
  start_rehearsal
  dump_and_apply_schema
  mirror_frontend_table_access
  copy_runtime_data
  refresh_publication_layer
  write_web_environment
  smoke_public_api
  report_capacity
}

print_help() {
  cat <<'TEXT'
Usage: scripts/production-rehearsal.sh <command>

Commands:
  prepare  Generate and validate the isolated local Supabase configuration.
  rebuild  Recreate the rehearsal database from the current full local database.
  report   Print the current rehearsal database capacity report.
  stop     Stop and remove only the disposable rehearsal database volume.

The script never connects to a linked or remote Supabase project.
TEXT
}

require_command docker
require_command npx

case "${1:-help}" in
  prepare)
    assert_source_environment
    write_rehearsal_config
    printf 'rehearsal config ready: API http://127.0.0.1:%s, DB port %s\n' \
      "$rehearsal_api_port" "$rehearsal_db_port"
    ;;
  rebuild)
    rebuild_rehearsal
    ;;
  report)
    report_capacity
    ;;
  stop)
    stop_rehearsal
    printf 'rehearsal database stopped and its disposable volume removed\n'
    ;;
  help|-h|--help)
    print_help
    ;;
  *)
    print_help >&2
    exit 2
    ;;
esac
