-- Private transport only: no business triggers, public RPC or browser grants.
BEGIN;
CREATE SCHEMA reviewed_adoption_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA reviewed_adoption_private FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE reviewed_adoption_private.packages (
 id uuid PRIMARY KEY, manifest jsonb NOT NULL,
 status text NOT NULL DEFAULT 'staging' CHECK(status IN ('staging','applied')),
 applied_at timestamptz,
 CHECK((status='applied')=(applied_at IS NOT NULL))
);
CREATE TABLE reviewed_adoption_private.chunks (
 package_id uuid NOT NULL REFERENCES reviewed_adoption_private.packages(id),
 part integer NOT NULL CHECK(part>=0), payload bytea NOT NULL,
 sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 PRIMARY KEY(package_id,part),
 CHECK(octet_length(payload) BETWEEN 1 AND 160000),
 CHECK(encode(pg_catalog.sha256(payload),'hex')=sha256)
);
ALTER TABLE reviewed_adoption_private.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviewed_adoption_private.chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA reviewed_adoption_private FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON SCHEMA reviewed_adoption_private IS 'Restricted reviewed release input transport; never an API-exposed schema. Retain failed inputs for inspection; cleanup requires approval.';
COMMIT;
