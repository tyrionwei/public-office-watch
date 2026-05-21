# Real Public Data Sync

This branch introduces the first real-data ingestion path. It is intentionally small and repeatable.

For source-specific fetching and parsing recipes, see `docs/public-data-fetch-recipes.md` and `data-sources/source-fetch-recipes.json`.

## What It Syncs

- `regions`: Taiwan plus 22 county/city records.
- `elections`: 2024 presidential and legislative election events.
- `races`: national presidential and party-list legislative races.
- `people`: current Legislative Yuan officeholders from the official Legislative Yuan open data feed. Only rows with `leaveFlag = 否` are treated as current.
- `candidates`: 2024 presidential and vice-presidential official candidate rows from the CEC open data ZIP, linked to `people` and the national presidential race.
- `parties`: the sync first tries to fetch the Ministry of the Interior party registry. It reads registry number, party name, founded date, filed date, headquarters address, contact phone, and representative/chairperson. If the registry is temporarily unavailable, dry-run falls back to the seed parties and reports that fallback explicitly.
- `party_finance_summaries`: schema and pipeline are ready, but the seed leaves totals empty until official fields are confirmed.

Personal donation details and company contribution summaries are not published by this sync.

## Flow

1. Source metadata and seed records live in `data-sources/real-public-data.seed.json`.
2. `scripts/sync-real-public-data.mjs` reads the seed, validates references, and calculates a SHA-256 source hash.
3. Unless `--skip-live-fetch` is provided, the script downloads the official MOI party registry, Legislative Yuan current-officeholder feed, and the CEC 2024 election data ZIP.
4. The CEC ZIP reader decodes Big5/CP950 file names, maps party codes from `elpaty.csv`, and imports the presidential candidate rows from `elcand.csv`.
5. Dry-run mode prints a JSON report only:

```bash
npm run sync:real-data:dry-run
```

6. Write mode requires Supabase write secrets:

```bash
SUPABASE_URL="https://..." \
SUPABASE_SERVICE_ROLE_KEY="..." \
npm run sync:real-data:write
```

7. The script upserts base tables by `external_id`, then public views expose only `is_public = TRUE` rows.
8. The frontend still reads only public views through `publicDataProvider`.

## Automation

- `.github/workflows/sync-real-public-data.yml` runs a daily dry-run.
- The weekly schedule attempts a write only when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` repository secrets are present.
- Manual workflow dispatch can request a write with `write=true`.
- Each write can record a row in `data_sync_runs` with counts, mode, source hash, and report JSON.

## Supabase Migration

Apply:

- `supabase/migrations/202605190001_real_public_data_foundation.sql`

It adds:

- `external_id` fields on regions/elections/races for idempotent upserts.
- `external_id` fields on people/candidates for idempotent upserts.
- `parties`
- party registry profile fields on `parties`: registry number, founded date text, filed date text, headquarters address, contact phone, and representative/chairperson.
- `party_finance_summaries`
- `party_company_contribution_summaries`
- `data_sync_runs`
- public views for party and contribution summaries.

## Source Policy

- Official sources are preferred: CEC, Control Yuan, and data.gov.tw.
- g0v/Ronny political contribution data can inform UI and field design, but should not be written as official data until licensing and transformation rules are confirmed.
- Human review is intentionally postponed for this branch, but high-risk personal/company relationship details stay unpublished.
