# Public Data Fetch Recipes

This document records the repeatable ways to fetch and parse public data for this project. It is the human-facing companion to `data-sources/source-fetch-recipes.json`.

Use this before adding a new sync job. The goal is to avoid rediscovering source URLs, encodings, delimiters, fallback behavior, and privacy boundaries.

## Shared Rules

- Prefer official sources first: government open data, CEC, Control Yuan, or agency-hosted download endpoints.
- Never let the frontend read raw source tables directly. Sync jobs write base tables; the web app reads approved public views only.
- Use deterministic external IDs for upserts. Existing syncs use source IDs or stable hashes.
- Keep live-source failures non-destructive. Dry-runs should report fallback or failure clearly without deleting current data.
- Do not commit raw downloaded archives, spreadsheets, SHP files, or scraped HTML. Use `tmp/` or automation workspace storage.
- Political contribution personal donation details stay unpublished. Company-level summaries require review before `is_public = TRUE`.

## Implemented: MOI Party Registry

Source:

- Dataset page: `https://data.gov.tw/dataset/31973`
- Current download URL: `https://data.moi.gov.tw/MoiOD/System/DownloadFile.aspx?DATA=55514697-A736-4FE0-AFA4-61EC85F82929`
- Current script: `scripts/sync-real-public-data.mjs`
- Target table: `parties`
- Target public view: `public_parties`

Fetch method:

1. Download text with a 30 second timeout.
2. Decode as UTF-8 first.
3. If the decoded text contains many replacement characters, retry Big5.
4. Parse as delimited text. Detect delimiter from the header row; support comma, semicolon, and tab.
5. Strip UTF-8 BOM from the first header.
6. Support quoted fields and escaped double quotes.

Useful field candidates:

| Target field | Source header candidates |
| --- | --- |
| `name` | `政黨名稱`, `名稱`, `黨名`, `political_party_name` |
| `registryNo` | `政黨編號`, `編號`, `registry_no`, `party_no` |
| `foundedDateText` | `成立日期`, `founded_date` |
| `filedDateText` | `備案日期`, `filed_date`, `registration_date` |
| `headquartersAddress` | `主事務所地址`, `地址`, `headquarters_address` |
| `contactPhone` | `通訊電話`, `電話`, `contact_phone` |
| `chairpersonName` | `負責人`, `主任委員`, `黨主席`, `chairperson`, `leader` |

Filtering:

- The official registry contains many low-signal parties.
- Product UI currently uses an allowlist of politically meaningful parties.
- The allowlist lives in `relevantPartyNames` inside `scripts/sync-real-public-data.mjs`.

Fallback:

- If the live download fails, use `data-sources/real-public-data.seed.json`.
- The report should set `livePartyRegistry.status` to `fallback` and include `livePartyRegistry.error`.
- This fallback is expected; do not treat it as data loss.

Known issue:

- The MOI download endpoint can fail with a network-level `fetch failed` from local WSL. The automation should keep reporting that state and retry on the next schedule.

## Planned: County/City Boundaries

Source:

- Dataset page: `https://data.gov.tw/dataset/7442`
- Target table: `regions`
- Target public views: `public_regions`, `public_region_election_summary`

Current state:

- The seed already contains Taiwan plus 22 county/city records.
- Raw boundary archives are not committed.

Next parser notes:

- Download official archives to `tmp/`.
- Extract official county/city code, name, and geometry.
- Keep geometry simplification output separate from source provenance.
- Use official code as the stable external ID when possible.

## Implemented First Slice: CEC Election Database

Source:

- `https://db.cec.gov.tw/`
- Open data package: `https://data.gov.tw/dataset/13119`
- ZIP download: `https://data.cec.gov.tw/選舉資料庫/votedata.zip`
- Target tables: `elections`, `races`, `candidates`
- Target public views: `public_elections`, `public_races`, `public_candidates`

Current state:

- The seed contains 2024 presidential and legislative metadata only.
- The sync script imports the 2024 presidential and vice-presidential candidate rows from `2024總統立委/總統/elcand.csv`.
- Party code labels are mapped through `2024總統立委/總統/elpaty.csv`.
- `people.external_id` and `candidates.external_id` exist so future official candidate syncs can upsert safely.

Fetch method:

1. Download the official CEC `votedata.zip` archive.
2. Decode ZIP entry names as Big5/CP950.
3. Read `elpaty.csv` for party code labels.
4. Read `elcand.csv` for candidate number, name, party code, elected marker, and vice-president marker.
5. Populate `people`, then populate `candidates` linked to `cec-2024-president-national`.

Next parser notes:

- Prefer official export/download endpoints over browser scraping.
- Separate election event metadata from race rows and candidate rows.
- Candidate ingestion should populate `people` first, then `candidates`.
- Candidate rows should link by `personExternalId` and `raceExternalId`.
- Candidate ingestion should populate `public_candidates` only after source fields and status mapping are verified.
- The current completed 2024 presidential slice treats a candidate number as elected when any row in that president/vice-president pair has `*` in the elected marker field.
- Add regional legislative race rows before importing 2024 district legislator candidate rows.

## Implemented: Current Legislative Yuan Officeholders

Source:

- Dataset page: `https://data.ly.gov.tw/getds.action?id=16`
- Current download URL: `https://data.ly.gov.tw/odw/ID16Action.action?name=&sex=&party=&partyGroup=&areaName=&term=11&fileType=json`
- Current script: `scripts/sync-real-public-data.mjs`
- Target table: `people`
- Target public view: `public_people`

Fetch method:

1. Download the term 11 JSON feed.
2. The response may include leading/trailing HTML whitespace, so parse the substring between the first `{` and last `}`.
3. Read `dataList`.
4. Keep only rows where `leaveFlag` is `否`.
5. Write rows to `people` with `position = 第11屆立法委員`.

Current state:

- The party detail page can already show officeholders from `public_people`.
- The sync script can upsert `people` by `external_id`.

Useful field candidates:

| Target field | Source header candidates |
| --- | --- |
| `name` | `name` |
| `alias` | `ename` |
| `party` | `partyGroup`, `party` |
| `district` | `areaName` |
| `source freshness` | `onboardDate`, `leaveFlag`, `leaveDate` |

Fallback:

- If the live download fails, keep seed `people` rows.
- The report should set `liveCurrentOfficeholders.status` to `fallback` and include `liveCurrentOfficeholders.error`.

Next parser notes:

- Extend this source family later for local officeholders; keep Legislative Yuan sync separate from local officials.
- Do not infer current local office from old election results alone after a new election cycle or resignation period.
- Keep `source_url` on the base person row for traceability.

## Planned: Political Contributions

Official sources:

- Control Yuan public search: `https://ardata.cy.gov.tw/home`
- Data.gov party contribution package: `https://data.gov.tw/dataset/6562003`

Target tables:

- `party_finance_summaries`
- `party_company_contribution_summaries`

Target public views:

- `public_party_finance_summaries`
- `public_party_company_contribution_summaries`

Rules:

- First publish party-level annual summaries only.
- Do not expose personal donation detail rows.
- Company-level summaries must remain `is_public = FALSE` until review workflow exists.
- g0v/Ronny data may inform field design, but do not write it as official data until licensing and transformation rules are confirmed.

Next parser notes:

- First automate source availability and version checks.
- Then map annual party-level totals.
- Normalize ROC years to Gregorian years where needed.
- Delay company relationship publication until review tooling exists.

## Verification Checklist

Run these before committing data-ingestion changes:

```bash
node scripts/sync-real-public-data.mjs --weekly --skip-live-fetch
node scripts/sync-real-public-data.mjs --weekly
cd apps/web && node node_modules/typescript/bin/tsc -b
cd apps/web && node scripts/check-public-data-boundary.mjs
cd apps/web && node scripts/check-public-view-contracts.mjs
```

For a full frontend production build in WSL:

```bash
cd apps/web
npm run build
```

## When To Create A Codex Skill

Keep this as a project runbook until at least two independent ingestion scripts reuse the same patterns. Create a Codex skill only when the workflow becomes broadly reusable across projects.

Candidate skill trigger:

- Fetch official Taiwan open data.
- Detect UTF-8/Big5.
- Parse CSV/semicolon/tab files.
- Normalize source metadata and write source recipe updates.

Until then, the repo-local runbook plus `source-fetch-recipes.json` is the safer home.
