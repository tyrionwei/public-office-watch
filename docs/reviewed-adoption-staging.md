# Reviewed release input staging

This is restricted transport for PR62, not a public upload service. The two tables live outside API-exposed schemas. PUBLIC, anon, authenticated and service_role have no privileges; RLS has no client policies. Use only the already authorized management channel as postgres. Do not expose this schema or add a browser RPC.

`scripts/prepare-reviewed-adoption-stage.py --private-input <private-artifact-directory>` checks the approved original SQL digest and reconstructs its body byte-for-byte after replacing the two identical ballot literals with one validated temporary payload reference. Output remains private: it contains complete before-values and source evidence. Never commit its output or include it in static assets.

Upload init and numbered requests separately. Each request is bounded below the previously successful request size; this is not a claim about the provider's maximum. A repeated index only succeeds with the same hash; DB CHECK binds hash to bytes. Uploading is not business adoption. Never issue FINAL-APPLY until every staged hash and the current approved scope are confirmed.

FINAL-APPLY is one transaction. It locks staging tables, validates manifest, ordered chunks, whole SHA256, bytes and 1182 unique before/after UUIDs, then reuses all original fresh-check/policy/qualification checks. Status becomes applied in the same commit. Statement45s / transaction90s / lock1s / idle10s limits remain. No trigger is disabled. Final refresh timeout remains a separate risk.

After any uncertain response, read package status and business state; never resend blindly. Failure retains staged evidence. Rollback SQL refuses to drop nonempty staging; retention/cleanup requires a separate explicit decision. No automatic DELETE or CASCADE.

Isolation coverage: exact reconstruction, idempotent upload, missing/altered/duplicate/extra chunks, already-applied refusal, browser/service-role permission denials, full original business success, late error rollback, and fresh-value drift refusal. Positive/error rollback compares all 19 affected business/cache/staging tables. Reuse existing six-group review and UI evidence; staging does not alter the approved scope or qualify HOLD rows.
