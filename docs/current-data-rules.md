# Current Data Rules

This document records the current project rules for data ingestion, review, dedupe, and map assets.

## Source Priority

- Official structured sources are preferred: Central Election Commission, Control Yuan, Legislative Yuan, Judicial Yuan, and government open data.
- Official agency profile pages are valid supporting sources, but each county/city parser should stay source-specific until its format is inspected.
- Wikidata and Wikipedia are auxiliary sources. They can fill low-sensitivity fields only after identity is matched or the external ID is verified.
- News and third-party guides can provide leads, but they should not replace official identity evidence.

## Person Identity And Dedupe

- Person records are the primary axis. Offices, candidacies, parties, regions, and districts are history/context records.
- A-level merge evidence requires a shared verified external ID, preferably an official ID. A verified Wikidata QID can also qualify when it has already passed review for the same person.
- Same normalized name, known gender, and verified birth date is a strong candidate, but it is B-level until another stable identifier is available.
- Party, district, position, candidate region, and elected office are context-only signals because they can change.
- Different known gender or different known birth date blocks automatic merge.
- Name-only matches must never create or merge canonical people.

## Claims And Review

- Non-sensitive official claims can be auto-published when linked to a canonical person and scored above the configured threshold.
- Wikidata low-sensitivity claims need either a verified external ID for the same person/QID or `identityMatch.status = matched`.
- Legal/criminal records and family relations are sensitive claims. They stay private/manual-review by default.
- Personal political donation details are not public UI data. Political finance should be shown as party/company aggregates only.
- `source_people` can store source-only official people. Do not create public review claims with `person_id = null` for those records.

## Batch Outputs

- Batch reports, progress files, skipped files, target files, and generated claim seeds are local artifacts.
- Keep source recipes and inventories in Git; keep generated ingestion outputs out of Git.
- Regenerate local artifacts from scripts before syncing when needed.

## Internal UI

- Internal review and progress pages are local/development tools. Production should hide them or require authentication.
- Review pages should display person names where available, not raw IDs.

## Map Assets

- Map visuals should stay pixel-style.
- The map panel background should be an ocean/pixel scene, not a grid or diagonal overlay.
- Decorative clouds, boats, and balloons should avoid the main Taiwan silhouette, island insets, and map labels.
- Project-bound generated map assets belong under `apps/web/public/assets/map`.
