# Person Enrichment Ingestion

This pipeline creates review-only supplemental person claims from lower-trust public sources.

## Current Sources

- Wikidata: gender, birth date, education, offices/occupations, and family relationships.

Wikidata-derived records are useful for bulk leads, but they are not authoritative enough for automatic publication. They are written to `person_claims` with `review_status = pending`, `visibility = review_only`, and `is_public = false`.

## Commands

Fetch a small batch from Wikidata into the enrichment seed:

```bash
SUPABASE_URL="http://127.0.0.1:54321" \
SUPABASE_ANON_KEY="..." \
npm run fetch:wikidata-person-enrichment -- \
  --target-names-from-supabase \
  --max-people 25
```

Resume from the tracked offset:

```bash
SUPABASE_URL="http://127.0.0.1:54321" \
SUPABASE_ANON_KEY="..." \
npm run fetch:wikidata-person-enrichment:resume
```

If Wikidata rate-limits the request, lower the batch size or increase delay:

```bash
npm run fetch:wikidata-person-enrichment -- \
  --target-names-from-supabase \
  --max-people 10 \
  --request-delay-ms 5000
```

Sync the generated claims into Supabase review queue:

```bash
SUPABASE_URL="http://127.0.0.1:54321" \
SUPABASE_SERVICE_ROLE_KEY="..." \
npm run sync:person-enrichment:write
```

Run the complete local batch:

```bash
npm run run:person-enrichment-batch
```

The batch script:

- resumes Wikidata enrichment from `person-enrichment-progress.json`
- syncs enrichment claims into local Supabase
- verifies Wikidata claims remain out of `public_person_claims`
- optionally runs Judicial Yuan legal lead fetch during the official service window when credentials are available

## Safety Rules

- Family relationships are never auto-published.
- Wikidata gender, birth date, education, and office claims are review-only by default.
- A shared surname or district must never create a family relation.
- Public display requires a verified claim from `public_person_claims`.

## Progress

- `data-sources/person-enrichment-progress.json` records `nextOffset`.
- The scheduled job should run the resume command, then `sync:person-enrichment:write`.
- Prefer `npm run run:person-enrichment-batch` for automation so the command sequence stays deterministic.
- Keep batch size small because Wikidata rate-limits this workspace quickly.
