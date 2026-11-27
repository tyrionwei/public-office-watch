# 批次同步出生日期投影

Migration `20261127094600_batch_official_birth_demographics.sql` replaces per-row
claim-to-demographics sync with statement-level transition tables. INSERT,
UPDATE and DELETE retain the same official source, date precision and conflict
rules. The existing row-level guard still checks direct demographics writes.
Only the existing trusted function owner may use the short-lived, session-local
cache it owns; a different owner's temporary table is not accepted. A naming
collision in the trusted operation stops rather than reusing the object.
No public API, privileges or rows change on schema apply.

Both apply and `scripts/sql/rollback-batch-official-birth-demographics.sql` pin
function definitions, owners, privileges, trigger definitions/enabled states
and the official profile view. An unexpected state aborts before replacing
anything. Timeouts apply to these schema transactions only; do not reuse them
as the data adoption time budget. The rollback restores the prior function
and trigger definitions, not any candidate data, and does not edit the
migration ledger. Coordinate with the separate release-data reversal and the
project's reviewed schema-change procedure.

Local validation uses a network-disabled Supabase PostgreSQL 17.6 restore and
private reviewed input, with the two function ACLs matched to the read-only
production check. It compares the same release data before and after, mixed
INSERT / ON CONFLICT UPDATE, eligibility changes and conflict clearing,
unrelated education updates, direct-write tamper protection and exact schema
rollback. A successful repeat apply or rollback over drift is a failure.
The local write timing is not a production latency guarantee.

For the combined release, do not mistake the staging loader for adoption.
Regenerate and re-verify the private operator bundle with the approved schema
allowlist after review. Do not bypass the existing schema gate or switch
production before its final read-only preflight.
