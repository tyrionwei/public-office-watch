# Official candidate snapshot import

The official candidate workflow detects new Central Election Commission source
material, preserves raw snapshots, and stages normalized registration or
qualification records for local review. It does not assume the file format that
an election authority will publish. Source-specific fetchers should convert
official data into the normalized JSON contract below.

The importer does not accept party or media sources for official statuses. The
snapshot source URL must be hosted on `cec.gov.tw`.

## Source discovery

The initial manifest monitors the central CEC announcement entry points:

```bash
npm run discover:cec-candidate-sources -- \
  --output tmp/cec-candidate-source-state.json \
  --snapshot-dir tmp/cec-candidate-source-snapshots
```

On later runs, add `--previous tmp/cec-candidate-source-state.json` to report
new and removed candidate-list links. Raw source files use content hashes in
their filenames, so unchanged pages do not create duplicate files. A source
adapter should only be added after the CEC publishes an actual candidate-list
format; the discovery step never guesses candidate records from headlines.

## Input contract

```json
{
  "schemaVersion": 1,
  "electionYear": 2026,
  "candidacyStatus": "registered",
  "source": {
    "name": "中央選舉委員會",
    "url": "https://web.cec.gov.tw/path-to-official-list",
    "publishedAt": "2026-09-01",
    "retrievedAt": "2026-09-01T10:00:00+08:00"
  },
  "records": [
    {
      "candidateExternalId": "cec-2026-candidate-stable-id",
      "personExternalId": "cec-2026-person-stable-id",
      "raceExternalId": "existing-race-external-id",
      "personName": "姓名",
      "party": "政黨",
      "candidateNo": null,
      "isIncumbent": false
    }
  ]
}
```

Allowed official statuses are `registered`, `qualified`, and
`withdrawn_or_disqualified`. Political-party nominations and personal
announcements must use a separate source flow and may not be promoted through
this importer.

All external IDs must be source-stable identifiers. The importer never merges
people by name. A source-scoped person may be created only after review, while
exact-name records are shown as review candidates.

## Review workflow

Generate the fail-closed report and review template:

```bash
npm run import:official-candidates:dry-run -- --input path/to/snapshot.json
```

The report blocks the batch when a race is missing or an existing official
candidate points to a different person or race. Exact-name people are shown as
review candidates, but are never merged automatically.

Stage source records, claims, identity suggestions, and the normalized snapshot
in local Supabase:

```bash
npm run import:official-candidates:stage -- --input path/to/snapshot.json
```

Review decisions use this shape:

```json
{
  "schemaVersion": 1,
  "reviewedBy": "reviewer",
  "decisions": [
    {
      "candidateExternalId": "cec-2026-candidate-stable-id",
      "personName": "姓名",
      "decision": "use_existing",
      "personId": "existing-person-uuid",
      "reason": "CEC external ID and election context confirmed",
      "reviewedAt": "2026-09-02T10:00:00+08:00"
    }
  ]
}
```

Allowed decisions are `use_existing`, `create_new`, and `reject`. Apply only the
reviewed subset with:

```bash
npm run import:official-candidates:apply-reviewed -- \
  --input path/to/snapshot.json \
  --apply-reviewed path/to/review.json
```

Both staging and applying are restricted to local Supabase. Newly created people
and candidates remain private. If an already-public candidate is confirmed, its
existing visibility is preserved while official status, source, party, and an
explicitly supplied ballot number are updated. The database trigger records
status changes in `candidate_status_history`. A later, separate release migration
is still required to publish new candidates.

For the 2026 local election, reviewed records cannot be applied before candidate
registration opens on 2026-08-31. Ballot numbers are rejected before the
official draw on 2026-10-23. Dry-run and local staging remain available before
those dates so source adapters and race mappings can be tested safely.
