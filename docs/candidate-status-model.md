# Candidate status model

Candidate records separate candidacy progress from election results.

## Public fields

- `candidacy_status`: the latest verified stage of the candidacy.
- `election_result`: the outcome of voting, independent from candidacy progress.
- `status_updated_at`: when either status last changed.
- `source_name` and `source_url`: the source supporting the candidate record.

`registration_status` and `is_elected` remain temporarily available as legacy
fields while import scripts and deployed databases migrate. New UI code must not
use them to decide the displayed status.

## Candidacy stages

| Value | Meaning |
| --- | --- |
| `potential` | Publicly discussed or otherwise identified as a possible candidate, but not yet nominated or registered. |
| `party_nominee` | Nominated by a political party. |
| `officially_announced` | The person has publicly announced a candidacy. |
| `registered` | Registration was submitted to the election authority. |
| `qualified` | Candidate qualification was confirmed by the election authority. |
| `withdrawn_or_disqualified` | The candidacy ended through withdrawal or disqualification. |
| `did_not_register` | A nominated or announced person did not file before registration closed, confirmed against a complete official named roster. |
| `unknown` | Available sources do not establish a stage. |

These values describe evidence, not a guaranteed linear workflow. For example,
an independent candidate may move from `officially_announced` directly to
`registered` without a `party_nominee` stage.

## Election results

| Value | Meaning |
| --- | --- |
| `pending` | Voting or result publication has not completed. |
| `elected` | The official result records the candidate as elected. |
| `not_elected` | The official result records the candidate as not elected. |
| `unknown` | No reliable result is available. |

Completed elections display `election_result`. Upcoming elections display
`candidacy_status`. Candidate profile records may show both fields so the
registration evidence and final result remain independently traceable.

## Legacy migration

- `pending` becomes `potential`.
- `registered` and `qualified` retain their meaning.
- `withdrawn` and `disqualified` become `withdrawn_or_disqualified`.
- `not_registered` becomes `did_not_register`.
- Historical `elected` and `not_elected` candidates become `qualified`, with
  their outcome written to `election_result`.
- Active races without an official outcome use `election_result = pending`.

Every migrated candidate receives a private baseline entry in
`candidate_status_history`. Later status changes create additional internal
history rows. They are not public until a separate review and publication flow
is implemented.
