# Person Identity Dedupe

Person dedupe is identity-first. Political context can help review, but it must not be the primary merge rule.

## Primary Identity Signals

Use these signals for merge candidates:

- Shared verified external ID, including official IDs and verified Wikidata QIDs.
- Same normalized name, same known gender, and same birth date.

## Context-Only Signals

These fields can change over time and are not stable identity fields:

- Party
- District
- Position
- Candidate region

Context-only signals can move a same-name pair into manual review, but they must not create an automatic merge candidate by themselves.

## Conflict Signals

These should block automatic merge and mark the pair as likely different people:

- Different known gender.
- Different known birth date.

## Current Automation Boundary

- `report-duplicate-people.mjs` uses this policy for file-based review reports.
- `person_duplicate_review_queue` should emit A-level pairs only for primary identity signals.
- `apply-person-merge-decisions.mjs` defaults to A-level pairs only.
- B/C/D pairs require manual review or a separate explicit command.

Party changes, district changes, and career progression should be represented as history or claims, not as identity proofs.
