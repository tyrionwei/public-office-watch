# Published read layer Phase 2.4 exposure review — 2026-07-28

## Scope

- Branch: `codex/published-read-layer-design`
- Review whether the private `published` schema is ready for direct frontend reads.
- Add a read-only privilege preflight and an automated repository boundary check.
- Do not change Supabase grants, PostgREST configuration, provider registration, environment flags, or production state.

## Findings

The schema is not ready to expose as a unit.

- `supabase/config.toml` exposes only `public` and `graphql_public`; `published` remains outside the API schema list.
- The frontend provider factory has no `published` mode and imports neither the adapter nor the bridge.
- The local `published` schema currently contains 28 relations. In addition to public-facing projections, it includes release state, candidate facts, claims, identity, and other surfaces that have not been reviewed as browser contracts.
- Phase 2.3 reviewed only `published.people_directory` and `published.search_results`.
- Existing migrations revoke access from `PUBLIC`, `anon`, and `authenticated`, and reserve promotion execution for `service_role`.

Publishing the whole schema, or using `GRANT SELECT ON ALL TABLES IN SCHEMA published`, would widen the browser API beyond the reviewed contracts and would also grant future relations automatically if default privileges were added. That is not an acceptable shortcut.

## Local preflight result

The read-only preflight ran against the local Supabase database and reported:

- `publishedConfiguredInSession`: `false`;
- schema `USAGE`: `false` for both `anon` and `authenticated`;
- frontend `SELECT` grants: `0`;
- unexpected frontend `SELECT` grants: `0`;
- `published.promote(uuid)` execution: `false` for `anon` and `authenticated`, `true` for `service_role`.

A null `pgrst.db_schemas` session setting is not sufficient evidence about a hosted dashboard configuration. Before any production exposure, check the Supabase API schema setting separately and run the SQL privilege preflight against that environment.

## Decision

Keep `published` private in Phase 2.4. The repository check now fails if a migration grants frontend access, if local API configuration exposes the schema, or if runtime code registers the private adapter path before a reviewed exposure change.

The next implementation phase should complete the remaining page read contracts and adapters first: home summaries and ticker, region pages, election/event pages, person detail, and party data. Lower election levels can remain in the published design as long as each exposed surface stays bounded and passes its query plan and storage gates.

## Proposed future allowlist

When runtime contracts are complete and exposure is explicitly approved, use exact grants rather than schema-wide table grants. For the two currently reviewed relations, the intended shape is:

```sql
REVOKE ALL ON SCHEMA published FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA published FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA published TO anon, authenticated;
GRANT SELECT ON published.people_directory, published.search_results
TO anon, authenticated;

REVOKE ALL ON FUNCTION published.promote(uuid)
FROM PUBLIC, anon, authenticated;
```

This is a design record, not a migration. The allowlist must grow only when another frontend contract and its tests are ready. Do not add frontend default privileges or grant `SELECT` on all current/future relations.

Adding `published` to PostgREST should happen in the same separately reviewed exposure phase. Runtime activation should use a distinct provider mode so the current mock/legacy provider remains an immediate rollback path.

## Exposure gates

Before activation:

1. Implement and test every page adapter that will switch in the release.
2. Re-run query-plan and storage-capacity gates after refreshing production published data.
3. Apply only the exact schema and relation grants required by those adapters.
4. Confirm the privilege preflight reports only the expected relation/role pairs and no frontend promotion execution.
5. Test browser reads with actual `anon` and anonymous-authenticated sessions; confirm every non-allowlisted relation is denied.
6. Enable a small canary through the dedicated provider flag and monitor latency, errors, and database load before broad activation.

## Rollback order

1. Switch the frontend provider flag back to the existing provider.
2. Remove `published` from the PostgREST exposed schema list.
3. Revoke frontend `SELECT` from each allowlisted relation and revoke schema `USAGE`.
4. Re-run the privilege preflight and verify zero frontend grants.

Rollback does not delete published data or refresh materialized views, so it is fast and recoverable.
