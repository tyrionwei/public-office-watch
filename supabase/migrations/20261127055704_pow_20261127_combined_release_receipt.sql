-- Staging only. Applying this schema migration does not import or publish data.
BEGIN;
CREATE SCHEMA pow_release_20261127 AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA pow_release_20261127 FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE pow_release_20261127.input (
    kind text PRIMARY KEY CHECK (kind IN ('candidates','polling','provenance')),
    body jsonb NOT NULL CHECK (jsonb_typeof(body) IN ('array','object')),
    artifact_sha256 text NOT NULL CHECK (artifact_sha256 ~ '^[a-f0-9]{64}$'),
    staged_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE pow_release_20261127.receipt (
    id boolean PRIMARY KEY DEFAULT true CHECK (id),
    manifest jsonb NOT NULL CHECK (jsonb_typeof(manifest) = 'object'),
    previous_public_release uuid NOT NULL,
    next_public_release uuid NOT NULL CHECK (next_public_release <> previous_public_release),
    created_at timestamptz NOT NULL DEFAULT now(),
    reverted_at timestamptz
);
ALTER TABLE pow_release_20261127.input ENABLE ROW LEVEL SECURITY;
ALTER TABLE pow_release_20261127.receipt ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA pow_release_20261127 FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON SCHEMA pow_release_20261127 IS 'Operator-only POW 2026-11-27 release staging and rollback receipts; no Data API access.';
COMMIT;
