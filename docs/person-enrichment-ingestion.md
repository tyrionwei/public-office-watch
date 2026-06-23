# Person Enrichment Ingestion

This pipeline creates supplemental person claims with official sources preferred over Wiki/Wikidata.

## Current Sources

- Official sources: Central Election Commission, Legislative Yuan open data, and other government-published person records.
- Wikidata: gender, birth date, education, offices/occupations, and family relationships.

Official records are the primary source for public person data. Wikidata-derived records are useful for bulk leads and fallback enrichment, but they are not allowed to override official data.

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
  --request-delay-ms 2000
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
- Official, non-sensitive A-level claims can be auto-published when they pass the scoring threshold.
- Wikidata claims require a verified external ID for the same person/QID before auto-publication.
- Wikidata education and experience claims are fallback-only: they are auto-published only when the public person field is empty and no non-Wikidata public claim of the same type exists.
- A shared surname or district must never create a family relation.
- Public display requires a verified claim from `public_person_claims`.

## Progress

- `data-sources/person-enrichment-progress.json` records `nextOffset`.
- The scheduled job should run the resume command, then `sync:person-enrichment:write`.
- Prefer `npm run run:person-enrichment-batch` for automation so the command sequence stays deterministic.
- The resume command currently processes 20 people per run with a global 1 request/second Wikidata throttle. It also sends an identifiable User-Agent, uses `maxlag=5`, retries transient `maxlag` / rate-limit responses, and respects `Retry-After` when present.
- If rate limits return, reduce `--max-people` first, then increase `--request-delay-ms`.
