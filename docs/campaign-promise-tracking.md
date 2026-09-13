# Campaign promise tracking

## Scope

Campaign platforms belong to a specific candidacy, not directly to a person. The canonical path is:

```text
person -> candidate -> race -> election
```

This keeps the same person's promises from different years, offices, districts, or parties separate.

The first implementation phase uses `person_claims.candidate_id` and retains the complete source text in the existing `platform` claim. Historical backfills are limited to elected candidates and the CEC bulletin for that exact election. A row is publishable only when the candidate has a unique stable identifier, the person and race match the bulletin, and both `is_elected` and `election_result = 'elected'` are present.

A platform without an exact `candidate_id` stays local with `review_status = 'pending'`, `visibility = 'review_only'`, and `is_public = false`. It must not appear in the standalone public person profile. A current council or officeholder profile may be retained as a separate current-agenda lead, but it is not historical election-platform evidence unless an exact CEC bulletin confirms the candidacy.

On the person page, election-scoped platforms appear inside the matching candidacy record. Unscoped claims are excluded from both the public person profile and race comparison until reviewed. The race comparison uses the same candidate-scoped claim.

Every official-bulletin backfill retains:

- the CEC source URL;
- the preserved local PDF filename and SHA-256;
- the source page and extraction method;
- the exact candidate, race, and election identifiers;
- the complete reviewed platform text.

The 2022 elected-executive source batch covers all 226 elected county/city mayors, township/city mayors, and indigenous district chiefs. The collection and staging commands are:

```text
npm run fetch:cec-elected-platforms
npm run extract:cec-elected-platform-review
npm run stage:cec-elected-platform-review:local
```

The fetch step accepts only the verified 2022 CEC archive layout and stores the official URL, local PDF, and SHA-256. The extractor uses the PDF text layer, reviewed table geometry, or a source-hash-bound manual crop, but every OCR result remains private and non-canonical. The staging step rejects non-local Supabase hosts and creates private pending claims only; a reviewer must visually transcribe and approve text before publication. Local candidate records that have been merged to canonical people keep their exact candidate ID and use the current local canonical `person_id`.

The elected-representative extension uses the current `https://bulletin.cec.gov.tw/` archive and requires an explicit scope:

```text
node scripts/fetch-cec-elected-representative-platforms.mjs --scope 2022-councilor --download
node scripts/fetch-cec-elected-representative-platforms.mjs --scope 2024-legislator --download
```

It targets elected 2022 council candidates and elected 2024 regional or indigenous legislative candidates that do not already have a verified or pending candidate-scoped platform claim. Party-list legislators are outside this pass because the local CEC candidacy model does not represent them as individual district candidacies.

Bulletin selection first matches election year, office, jurisdiction, and district. It then confirms the candidate name from the PDF text layer when available. A unique official district bulletin whose text layer cannot expose the name is retained at lower confidence for private visual review. Multiple possible bulletin volumes remain unresolved and do not create a claim until a reviewer selects the correct volume.

The shared extractor accepts these reports through explicit paths. Entries with OCR crops are marked `pending_manual_transcription`; entries whose source is known but whose platform area cannot be located are marked `pending_manual_localization`. Both remain `review_status = 'pending'`, `visibility = 'private'`, and `is_public = false`:

```text
node scripts/extract-cec-elected-platform-review.mjs --input <review.json> --output <platform-review.json> --crop-dir <crops> --layout-dir <layouts>
node scripts/stage-cec-elected-platform-review.mjs --input <platform-review.json> --output <staging.json> --apply-local
```

An OCR crop is only a navigation aid, not proof that the platform is complete. Before approval, the reviewer must compare it with the candidate's complete block in the official bulletin page. A crop that omits a column, category, continuation, or the beginning or end of a line stays private until the complete text is transcribed.

The first five visually verified public records are 蔡文益、李明哲、蕭淑芬、林慧如、陳建名. The other 221 records are local private transcription work. The preserved file named `cec-2022-dongshi-mayor.pdf` is actually the Chiayi County Dongshi Township bulletin, not the Yunlin County Dongshi Township bulletin, so it must not be used for 張健福.

Unsuccessful candidates are intentionally outside this historical phase. Current or future candidate platforms already collected by a separate reviewed candidate workflow are not deleted by this rule.

## Planned promise records

The next data phase should split a reviewed platform into individually traceable promises. Each promise should retain:

- exact `candidate_id` and therefore its race and election;
- original wording and source URL;
- a short neutral title;
- topic classification;
- promise type, such as action, legislation, budget, construction, or outcome;
- measurable target and target date when the source supplies them;
- review status and the person who approved the interpretation.

Splitting text may be machine-assisted, but publication requires review because one sentence can contain several commitments and some political statements are not measurable promises.

## Fulfilment assessments

Assessments are versioned evidence records rather than edits to the original promise. Recommended public statuses are:

- `not_started`
- `in_progress`
- `partially_completed`
- `substantially_completed`
- `completed`
- `not_fulfilled`
- `not_assessable`

Every public assessment must include a dated source and a neutral explanation. A change of government policy, budget passage, construction start, or announced plan is evidence of progress, but is not automatically evidence of completion.

## Completion rate

Do not publish a single percentage until the assessed coverage is also available. When there is enough reviewed evidence, display both:

```text
Estimated completion: 62%
Assessed coverage: 13 of 20 promises
```

The percentage should be the average reviewed progress of assessable promises only. `not_assessable` promises stay in the total platform count but are excluded from the percentage denominator. The UI must label the result as an evidence-based estimate, not an objective score of political performance.

The first public version should prefer status counts over a percentage. Add the percentage only after the review workflow has produced stable and repeatable assessments across more than one officeholder.
