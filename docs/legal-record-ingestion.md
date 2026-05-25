# Legal Record Ingestion

This document defines the first safe path for legal/criminal record data.

## Current Status

- `legal_record_leads` stores private review-only legal leads.
- `legal_record_review_queue` exposes pending leads for internal review.
- No legal lead is exposed through public views.
- No legal lead automatically creates a public `legal_case` claim.
- The sync accepts optional local seed input through `data-sources/legal-record-leads.seed.json`.

## Commands

Fetch Judicial Yuan API leads into the private lead seed file:

```bash
JUDICIAL_OPEN_DATA_USER="..." \
JUDICIAL_OPEN_DATA_PASSWORD="..." \
npm run fetch:judicial-legal-leads -- \
  --target-names ./data-sources/legal-record-target-names.example.json \
  --max-docs 50
```

Use public people from Supabase as target names:

```bash
JUDICIAL_OPEN_DATA_USER="..." \
JUDICIAL_OPEN_DATA_PASSWORD="..." \
SUPABASE_URL="http://127.0.0.1:54321" \
SUPABASE_ANON_KEY="..." \
npm run fetch:judicial-legal-leads -- \
  --target-names-from-supabase \
  --max-docs 50
```

Dry-run:

```bash
npm run sync:legal-leads:dry-run
```

Write to Supabase:

```bash
SUPABASE_URL="http://127.0.0.1:54321" \
SUPABASE_SERVICE_ROLE_KEY="..." \
npm run sync:legal-leads:write
```

Use a different lead file:

```bash
node scripts/sync-real-public-data.mjs \
  --weekly \
  --include-legal-record-leads \
  --legal-record-leads ./data-sources/legal-record-leads.seed.json
```

## Lead Format

`legalRecordLeads` is intentionally review-first. A lead may include:

- `leadKey`
- `sourceId`
- `sourceType`
- `sourceName`
- `sourceUrl`
- `courtName`
- `caseYear`
- `caseCode`
- `caseNumber`
- `judgmentDate`
- `caseType`
- `reason`
- `title`
- `summary`
- `rawName`
- `confidenceLevel`
- `sourcePayload`

Name-only matches are allowed only as private leads. They must not be published.

## Matching Rules

- Normalized name match is only a lead, not proof.
- District, party, position, or source text hints can raise the private match score.
- Legal leads are capped below auto-publication.
- A verified public `legal_case` claim requires manual confirmation and an explicit source URL.

## Source Notes

- Primary source planning target: Judicial Yuan open data platform.
- The Judicial Yuan judgment API requires an account/password from the Judicial Yuan open data platform. Auth returns a token that is valid for 6 hours.
- The official API service window is 00:00-06:00 Asia/Taipei. The fetcher enforces this by default.
- The API provides a 7-days-prior judgment change list and individual judgment full text by `jid`.
- The older data.gov.tw dataset `63205` is treated as historical reference because it has been marked for consolidation/removal.
- If the Judicial Yuan API requires account-based access, fetch credentials should stay outside the repo and only normalized leads should be written.

## Fetcher Boundary

- `scripts/fetch-judicial-legal-record-leads.mjs` does not write to Supabase.
- It requires an explicit target-name JSON file.
- It can alternatively load target names from the `public_people` public view when Supabase public env vars are provided.
- It only writes matched lead summaries to `data-sources/legal-record-leads.seed.json`.
- It does not store complete judgment text; `summary` is capped for review context.
