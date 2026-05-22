# Person Profile Enrichment

This note records the next person-profile data direction before widening public UI.

## Implemented First

- `gender`: public `people` field for matching default pixel characters.
- `education`: public text field, initially filled from Legislative Yuan current-member data when available.
- `experience`: public text field, initially filled from Legislative Yuan current-member data when available.

The CEC votedata package already exposes candidate gender codes in `elcand.csv`; the sync maps `1` to `male`, `2` to `female`, and unknown values to `unknown`.

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
