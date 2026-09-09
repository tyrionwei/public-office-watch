# Real Public Data Sync

This document describes the foundational real-data sync and its current entry points. Source-specific collectors and review workflows have separate runbooks.

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
- `legal_record_leads`: optional private review-only legal/court record leads when `--include-legal-record-leads` is provided.

Personal donation details are not published by this sync.
The 2024 `不分區政黨/elcand.csv` rows are party ballot choices, not individual candidate records, so they are not written into the current person-candidate schema.
The 2022 township mayors, representatives, and village chiefs are intentionally skipped in this slice.
Political contribution raw `incomes.csv` and `expenditures.csv` detail rows are intentionally not written because they contain personal or transaction-level details. The sync derives only aggregate company summaries from business donation rows with a valid unified business number.
Legal record leads are not public views and do not create public `legal_case` claims automatically.

## Flow

1. Source metadata and seed records live in `data-sources/real-public-data.seed.json`.
2. `scripts/sync-real-public-data.mjs` reads the seed, validates references, and calculates a SHA-256 source hash.
3. Unless `--skip-live-fetch` is provided, the script downloads the official MOI party registry, Legislative Yuan current-officeholder feed, CEC election data ZIP, and Control Yuan party contribution ZIP.
4. The CEC ZIP reader decodes Big5/CP950 file names, maps party codes from `elpaty.csv`, creates legislative/local race records, and imports person-candidate rows from the presidential, legislative, mayor, and councilor `elcand.csv` files.
5. The political contribution parser reads `political party_incomes and expenditures.csv`, converts ROC years to Gregorian years, and writes party-level annual totals.
6. It also reads `incomes.csv`, keeps only `營利事業捐贈收入` rows with a valid unified business number, and aggregates them by party, company, and report year.
7. Dry-run skips database writes and prints a JSON report. It can still fetch external sources and create local caches or monitoring artifacts; it is not an offline test:

```bash
npm run sync:real-data:dry-run
```

8. Write mode requires authorized full-local Supabase service credentials supplied through a controlled local environment. Do not use production credentials for collection or paste secrets into shell history:

```bash
# After verifying the authorized full-local URL and loading server-only credentials:
npm run sync:real-data:write
```

9. The script upserts local base tables by `external_id` or stable natural keys. Collected/private rows are not automatically a reviewed production release.
10. The frontend reads the reviewed `published` interface through `publicDataProvider`; legacy `public_*` views are retired.

### Planned 2026 race reconciliation

Write mode preserves existing public races that are absent from the current
planned mayor/councilor input. Even a successful CEC fetch does not establish
complete coverage. Missing generated races with matching election, type, and
calendar source metadata appear in `plannedLocalRaceReconciliation` as
`review_required`; manual, grassroots, and other-source races are preserved.
This comparison uses a snapshot taken before race upserts change source metadata.

The CLI and `data_sync_runs.report_json` use the same completed report. Missing
owned races set its `needsAttention` to true and change an otherwise `ok` report
to `degraded`. The run row's `status: ok` describes completion of the write;
monitoring must also inspect report health. Fallback comparisons remain visible
with `sourceStatus: fallback` and `coverage: not_proven_complete`. Dry runs report
`not_checked` and do not query stored races. ID lists are capped at 500 with a
total count and truncation flag; no missing-row hide operation is performed.

Official metadata for the five changed councilor regions still updates 48
districts. Older generated IDs can remain alongside replacement IDs, including
fallback `official-*` IDs after historic CEC data becomes available again. Resolve
those differences through separate evidence-based review before hiding rows.

Legal lead mode:

```bash
npm run sync:legal-leads:dry-run
```

```bash
# After verifying the authorized full-local URL and loading server-only credentials:
npm run sync:legal-leads:write
```

## Automation

- [sync-real-public-data.yml](../.github/workflows/sync-real-public-data.yml) is **manual dispatch only**, runs `sync:real-data:dry-run`, and selects Node 22. It has no schedule, write input, or database-secret configuration.
- Daily/weekly full-local monitoring is a separate operation described in [weekly-monitoring.md](weekly-monitoring.md) and [daily-person-news-monitor.md](daily-person-news-monitor.md). Check the actual local scheduler and run artifacts before claiming a schedule is active; this GitHub workflow is not evidence of it.
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
- `legal_record_leads`
- `legal_record_review_queue`
- `data_sync_runs`
- public views for party and contribution summaries.

## Source Policy

- Official sources are preferred: CEC, Control Yuan, and data.gov.tw.
- g0v/Ronny political contribution data can inform UI and field design, but should not be written as official data until licensing and transformation rules are confirmed.
- Human review is intentionally postponed for this branch, but high-risk personal details stay unpublished.
- Company-level political contribution summaries may be public when they come directly from official Control Yuan/data.gov.tw records and include source links.
