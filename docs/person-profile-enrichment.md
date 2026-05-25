# Person Profile Enrichment

This note records the next person-profile data direction before widening public UI.

## Implemented First

- `gender`: public `people` field for matching default pixel characters.
- `education`: public text field, initially filled from Legislative Yuan current-member data when available.
- `experience`: public text field, initially filled from Legislative Yuan current-member data when available.
- `birth_date`: private/source claim field. It can be captured from official feeds when available, but should be reviewed before broad public display.

The CEC votedata package already exposes candidate gender codes in `elcand.csv`; the sync maps `1` to `male`, `2` to `female`, and unknown values to `unknown`.

## Current Public Profile Behavior

- `public_people` remains the canonical public person row.
- `public_person_claims` supplies reviewed supplemental facts from source ingestion.
- The frontend may backfill missing `gender`, `education`, and `experience` from verified public claims when the base person row is empty or `unknown`.
- Source ingestion can create `birth_date` claims, but they are not used for public profile display in this UI slice.
- Profile modules for platform, finance summary, legal record, and family relationship only render public reviewed claims. If no claim exists, the UI shows an empty state instead of inferred content.
- Legal/criminal and political-family claims should not be generated from name-only matches. They require explicit source evidence and a conservative confidence level.

## New Person Intake Flow

1. Import source records into source tables without immediately publishing them.
2. Normalize names, parties, districts, election years, and source IDs.
3. Match source records to existing people through identity scoring.
4. Create `person_claims` for fields that came from the source record.
5. Score claims by source type, match quality, field type, and evidence strength.
6. Auto-publish only high-confidence public claims; keep weaker claims in review queues.
7. Let public profile pages read only `public_people` and verified `public_person_claims`.

## Reserved UI Modules

- Platform / campaign promises: planned public module, source should be election bulletins or official campaign/public promise sources.
- Legal / controversy records: planned reviewed-summary module only.
- Political family network: planned reviewed relationship module only.

## Legal Record Source Plan

Use court data only as a lead source until review is built.

Possible flow:

1. Fetch Judicial Yuan court-document change lists and full text through the official open API.
2. Store matching cases in a private review table.
3. Match by name first, then require additional signals such as region, office, party, article context, or election bulletin identity.
4. Publish only reviewed summaries with source URLs, case status, confidence, and review timestamp.

Confidence rule:

- `A`: official court document or official notice, same person confirmed by review.
- `B`: official court document, high-confidence automated match, not yet manually reviewed.
- `C`: media, NGO, or civil-society compilation with a traceable source.
- `D`: weak lead; do not publish.

The News Lens 2022 guide and TAWPA 2022 councilor record project are useful references for product framing, but should not be treated as authoritative source imports without licensing and review.

## Political Family Relationship Plan

Potential sources:

- Official biographies where family relationship is explicitly stated.
- Wikidata / Wikipedia as low-confidence leads for parent, spouse, child, sibling, and relative properties.
- News profiles or campaign biographies as review leads.

Public display should avoid inference from shared surnames or districts. A political-family relation needs an explicit source and review status before publication.
