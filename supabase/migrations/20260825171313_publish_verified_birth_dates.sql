-- Generated from verified public birth-date claims in the full local research database.
-- The payload is compacted for production: source links and review fields are retained;
-- private/raw claim JSON and scoring details are not released.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15min';

CREATE SCHEMA IF NOT EXISTS release_staging_20260826;
REVOKE ALL ON SCHEMA release_staging_20260826 FROM PUBLIC, anon, authenticated;

DROP TABLE IF EXISTS release_staging_20260826.birth_dates;

CREATE UNLOGGED TABLE release_staging_20260826.birth_dates (
    id uuid NOT NULL,
    claim_key text NOT NULL,
    person_external_id text NOT NULL,
    claim_type text NOT NULL,
    claim_value text NOT NULL,
    claim_json jsonb NOT NULL,
    confidence_level text NOT NULL,
    review_status text NOT NULL,
    visibility text NOT NULL,
    source_name text,
    source_url text,
    observed_at timestamptz,
    is_public boolean NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    review_score numeric,
    scoring_version text,
    scoring_reasons jsonb NOT NULL,
    auto_reviewed_at timestamptz
);

REVOKE ALL ON TABLE release_staging_20260826.birth_dates
FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM release_staging_20260826.birth_dates) <> 0 THEN
        RAISE EXCEPTION 'Birth-date release staging setup drift';
    END IF;
END
$$;

COMMIT;
