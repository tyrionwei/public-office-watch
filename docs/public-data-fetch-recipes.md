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

- The seed contains 2024 presidential and legislative metadata. The sync also creates a 2022 local election event from the official archive.
- The sync script imports 2024 presidential, vice-presidential, regional legislator, plain indigenous legislator, and mountain indigenous legislator candidate rows.
- The sync script imports 2022 direct municipality mayor, county/city mayor, and councilor candidate rows. Township mayors, representatives, and village chiefs are intentionally skipped in this slice.
- Candidate gender codes are mapped from `elcand.csv` into `people.gender` for default character selection.
- Party code labels are mapped through `2024總統立委/總統/elpaty.csv`.
- The sync script dynamically creates 73 regional legislator races plus plain/mountain indigenous legislator races before writing candidates.
- The sync script dynamically creates 2022 mayor and councilor races before writing local candidates.
- `不分區政黨/elcand.csv` contains party ballot choices rather than individual nominee rows, so it is recorded as skipped for the current person-candidate schema.
- `people.external_id` and `candidates.external_id` exist so future official candidate syncs can upsert safely.

Fetch method:

1. Download the official CEC `votedata.zip` archive.
2. Decode ZIP entry names as Big5/CP950.
3. Read `elpaty.csv` for party code labels.
4. Read `elcand.csv` for candidate number, name, party code, elected marker, and vice-president marker.
5. Create regional and indigenous legislator race records for the 2024 legislative election.
6. Create mayor and councilor race records for the 2022 local election.
7. Populate `people`, then populate `candidates` linked to the presidential, legislative, mayor, and councilor races.

Next parser notes:

- Prefer official export/download endpoints over browser scraping.
- Separate election event metadata from race rows and candidate rows.
- Candidate ingestion should populate `people` first, then `candidates`.
- Candidate rows should link by `personExternalId` and `raceExternalId`.
- Candidate ingestion should populate `public_candidates` only after source fields and status mapping are verified.
- The current completed 2024 presidential slice treats a candidate number as elected when any row in that president/vice-president pair has `*` in the elected marker field.
- Legislative rows map `*` directly to `registration_status = elected`; blank rows become `not_elected`.
- 2022 elected mayor/councilor rows are treated as current local officeholders for the 2022-2026 term. Later resignations, recalls, or by-elections need a separate update source.
- Add a dedicated party-list ballot-choice model before showing `不分區政黨` rows as election choices.
- Gender code mapping: `1` is stored as `male`, `2` as `female`, anything else as `unknown`.

## Implemented: Planned 2026 Local Race Shells

Source:

- CEC public site: `https://www.cec.gov.tw/`
- Derived base: `cec-2022-local-public-officials`
- Current script: `scripts/sync-real-public-data.mjs`
- Target tables: `elections`, `races`
- Target public views: `public_elections`, `public_races`, `public_region_election_summary`, `public_home_election_ticker`

Current state:

- The sync creates `115年地方公職人員選舉` as a planned 2026 local election event.
- Mayor and councilor race shells are copied from completed 2022 local race districts.
- Included race types are `municipality_mayor`, `county_mayor`, `city_councilor`, and `county_councilor`.
- Voting date is currently stored as `2026-11-28`.
- These rows are election/race shells only. Do not create future candidates from 2022 candidate data.

Reasoning:

- CEC may publish candidate and final district details later than the product needs an upcoming election surface.
- Local mayor and councilor district structures usually remain stable enough to use the completed 2022 structure as a default shell.
- When official 2026 race metadata is available, reconcile or replace these rows by stable `external_id`.

Public cleanup:

- Old `example.invalid` sample election, race, candidate, person, and media rows are marked `is_public = FALSE` by migration.
- Local sample seed files still exist for smoke testing, but they no longer create public-facing sample records.

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
- The feed includes `sex`, `degree`, and `experience`; these now populate public profile fields where available.

Useful field candidates:

| Target field | Source header candidates |
| --- | --- |
| `name` | `name` |
| `alias` | `ename` |
| `party` | `partyGroup`, `party` |
| `district` | `areaName` |
| `gender` | `sex` |
| `education` | `degree` |
| `experience` | `experience` |
| `source freshness` | `onboardDate`, `leaveFlag`, `leaveDate` |

Fallback:

- If the live download fails, keep seed `people` rows.
- The report should set `liveCurrentOfficeholders.status` to `fallback` and include `liveCurrentOfficeholders.error`.

Next parser notes:

- Extend this source family later for local officeholders; keep Legislative Yuan sync separate from local officials.
- Do not infer current local office from old election results alone after a new election cycle or resignation period.
- Keep `source_url` on the base person row for traceability.

## Implemented First Slice: Political Contributions

Official sources:

- Control Yuan public search: `https://ardata.cy.gov.tw/home`
- Data.gov party contribution package: `https://data.gov.tw/dataset/175227`
- ZIP download: `https://ardata.cy.gov.tw/api/v1/Search/download?AccountNumber=&DownloadType=3&ElectionArea=&ElectionName=&SearchType=4&Version=&YearOrSerial=113`

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

Current state:

- The sync reads `political party_incomes and expenditures.csv` from the official 113年度政黨政治獻金 ZIP.
- ROC year `113` is normalized to Gregorian year `2024`.
- Only rows matching parties already included in `public_parties` are written.
- `incomes.csv` and `expenditures.csv` are intentionally skipped because they contain personal or transaction-level details.

Field mapping:

| Target field | Source column |
| --- | --- |
| `income_total` | `收入合計` |
| `expense_total` | `支出合計` |
| `balance_amount` | `本期結餘` |
| `individual_donation_total` | `個人捐贈收入` |
| `business_donation_total` | `營利事業捐贈收入` |
| `civil_group_donation_total` | `人民團體捐贈收入` |
| `anonymous_donation_total` | `匿名捐贈收入` |
| `other_income_total` | `其他收入` |

Next parser notes:

- Consider storing all official parties before widening summaries beyond the current party allowlist.
- Add audit dates or accountant metadata only if the UI needs them.
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
