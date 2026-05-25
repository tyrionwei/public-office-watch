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

## Safety Rules

- Family relationships are never auto-published.
- Wikidata gender, birth date, education, and office claims are review-only by default.
- A shared surname or district must never create a family relation.
- Public display requires a verified claim from `public_person_claims`.
