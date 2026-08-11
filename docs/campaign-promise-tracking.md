# Campaign promise tracking

## Scope

Campaign platforms belong to a specific candidacy, not directly to a person. The canonical path is:

```text
person -> candidate -> race -> election
```

This keeps the same person's promises from different years, offices, districts, or parties separate.

The first implementation phase adds `person_claims.candidate_id` and retains the complete source text in the existing `platform` claim. Legacy claims without a safe candidacy match remain visible on the person page but are excluded from race comparison until reviewed.

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
