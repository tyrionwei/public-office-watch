# Real Public Data Sync

This branch introduces the first real-data ingestion path. It is intentionally small and repeatable.

For source-specific fetching and parsing recipes, see `docs/public-data-fetch-recipes.md` and `data-sources/source-fetch-recipes.json`.

## What It Syncs

- `regions`: Taiwan plus 22 county/city records.
- `elections`: 2024 presidential/legislative election events plus the 2022 local election event.
- `races`: national presidential, party-list legislative, 73 regional legislative, two indigenous legislative, 2022 mayor, and 2022 councilor races.
- `people`: current Legislative Yuan officeholders from the official Legislative Yuan open data feed. Only rows with `leaveFlag = 否` are treated as current. 2022 elected mayors and councilors are also exposed as local officeholders for the current term.
- `candidates`: 2024 presidential/legislative official candidate rows plus 2022 direct municipality mayor, county/city mayor, and councilor official candidate rows from the CEC open data ZIP.
- `parties`: the sync first tries to fetch the Ministry of the Interior party registry. It reads registry number, party name, founded date, filed date, headquarters address, contact phone, and representative/chairperson. If the registry is temporarily unavailable, dry-run falls back to the seed parties and reports that fallback explicitly.
- `companies`: business contributors from official political contribution income rows when an 8-digit unified business number is present.
- `party_finance_summaries`: 113年度政黨政治獻金會計報告書的政黨年度收入支出摘要。Only party-level totals are written.
- `party_company_contribution_summaries`: official company-level aggregate summaries from `incomes.csv` rows whose account is `營利事業捐贈收入`.

Personal donation details are not published by this sync.
The 2024 `不分區政黨/elcand.csv` rows are party ballot choices, not individual candidate records, so they are not written into the current person-candidate schema.
The 2022 township mayors, representatives, and village chiefs are intentionally skipped in this slice.
Political contribution raw `incomes.csv` and `expenditures.csv` detail rows are intentionally not written because they contain personal or transaction-level details. The sync derives only aggregate company summaries from business donation rows with a valid unified business number.

## Flow

1. Source metadata and seed records live in `data-sources/real-public-data.seed.json`.
2. `scripts/sync-real-public-data.mjs` reads the seed, validates references, and calculates a SHA-256 source hash.
3. Unless `--skip-live-fetch` is provided, the script downloads the official MOI party registry, Legislative Yuan current-officeholder feed, CEC election data ZIP, and Control Yuan party contribution ZIP.
4. The CEC ZIP reader decodes Big5/CP950 file names, maps party codes from `elpaty.csv`, creates legislative/local race records, and imports person-candidate rows from the presidential, legislative, mayor, and councilor `elcand.csv` files.
5. The political contribution parser reads `political party_incomes and expenditures.csv`, converts ROC years to Gregorian years, and writes party-level annual totals.
6. It also reads `incomes.csv`, keeps only `營利事業捐贈收入` rows with a valid unified business number, and aggregates them by party, company, and report year.
7. Dry-run mode prints a JSON report only:

```bash
npm run sync:real-data:dry-run
```

8. Write mode requires Supabase write secrets:

```bash
SUPABASE_URL="https://..." \
SUPABASE_SERVICE_ROLE_KEY="..." \
npm run sync:real-data:write
```

9. The script upserts base tables by `external_id` or stable natural keys, then public views expose only `is_public = TRUE` rows.
10. The frontend still reads only public views through `publicDataProvider`.

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
- Human review is intentionally postponed for this branch, but high-risk personal details stay unpublished.
- Company-level political contribution summaries may be public when they come directly from official Control Yuan/data.gov.tw records and include source links.
