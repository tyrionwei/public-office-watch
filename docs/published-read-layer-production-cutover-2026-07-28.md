# Published read layer production cutover - 2026-07-28

> Historical record. The legacy Supabase provider rollback described below was retired on 2026-08-12.
> Current releases and rollbacks must follow `docs/production-provider-enable-plan.md`.

## Database

- Pre-cutover size: `457,739,411` bytes.
- Post-grant size: `457,747,603` bytes.
- No `published.promote` call or physical refresh ran during the cutover.
- Published People and search snapshots remained at 30,934 and 67,922 rows.
- Migrations `202607280002` through `202607280005` were applied and recorded.

## Public boundary

- Data API schemas are `public`, `graphql_public`, and `published`.
- The frontend roles have schema usage and SELECT on exactly 16 reviewed published relations.
- No additional published relation is selectable by `anon`.
- `published.election_race_page`, `published.person_claims_for`, and `published.search_public_records` are executable by frontend roles.
- `published.promote` remains unavailable to frontend roles.
- Public publishable-key reads returned HTTP 200 from `people_directory` and `home_ticker`.

## Frontend

- Production builds may select `VITE_PUBLIC_DATA_PROVIDER=published` only when
  `VITE_ENABLE_PUBLISHED_PROVIDER=true`.
- The legacy Supabase provider remains packaged and enabled as the immediate rollback path.
- Environment examples do not select published mode by default.
- The production Sites build contains the configured published provider chunk.

## Verification

- Root checks passed.
- Read-contract tests: 54 passed.
- Local published-provider browser smoke: 7 passed.
## Ranked search correction

- The first production smoke run exposed company-first alphabetical result starvation for `台北`.
- The frontend was immediately rolled back to the legacy Supabase provider while the correction was prepared.
- `published.search_public_records` now prioritizes visible title matches and then the established entity order.
- The correction adds no materialized rows or indexes; production database size remained `457,747,603` bytes.
- Production execution for `台北` returned 12 rows in about 135 ms with `臺北市` first.

- Production Vite/Sites build passed.
- Published exposure boundary and legacy public-view contracts passed.
- The only data-boundary warning remains the pre-existing direct mock import in
  `SelectedRegionHud.tsx`.

## Rollback

1. Set `VITE_PUBLIC_DATA_PROVIDER=supabase`.
2. Redeploy the immediately previous known-good frontend artifact.
3. Leave the additive read functions and published snapshot in place.
4. Repeat home, elections, People, profile, party, and search smoke tests.

The physical race-list surface remains deferred under the current storage limit.
The provider continues to use the bounded `election_race_page` function.
