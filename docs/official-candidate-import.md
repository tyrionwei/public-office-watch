# Official candidate snapshot import

The official candidate importer applies registration and qualification updates
without assuming the file format that an election authority will publish.
Source-specific fetchers should convert official data into this normalized JSON
contract before using the importer.

The importer does not accept party or media sources for official statuses. The
snapshot source URL must be hosted on `cec.gov.tw`.

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
people by name. A new source-scoped person is created when `personExternalId`
does not exist, and the existing identity-review workflow may later link that
record to a canonical person.

## Workflow

Run the report before every write:

```bash
npm run import:official-candidates:dry-run -- --input path/to/snapshot.json
```

The report blocks writes when a race is missing or an existing candidate points
to a different person or race. Resolve those conflicts before continuing.

Apply a verified snapshot with:

```bash
npm run import:official-candidates:write -- --input path/to/snapshot.json
```

Writes update candidate status, source, party, and an explicitly supplied ballot
number. The database trigger records status changes in
`candidate_status_history`, and the original normalized snapshot is archived in
`raw_source_records`.

For the 2026 local election, do not run a `registered` import before candidate
registration opens on 2026-08-31. Qualification and ballot numbers should be
applied only after the election authority publishes the corresponding official
list. The write command enforces the registration opening date and rejects
ballot numbers before the official draw on 2026-10-23; dry-run remains available
before those dates so source adapters and race mappings can be tested safely.
