-- Synthetic, disposable PostgreSQL regression; never run against the application DB.
\set ON_ERROR_STOP on
DO $safety$
BEGIN
 IF current_database() <> 'pow_registration_guard_test'
    OR to_regclass('public.person_claims') IS NOT NULL
    OR to_regclass('public.candidates') IS NOT NULL THEN
  RAISE EXCEPTION 'Use an empty disposable pow_registration_guard_test database';
 END IF;
END $safety$;

DO $roles$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $roles$;
CREATE TABLE public.person_claims (
 id uuid PRIMARY KEY, person_id uuid, candidate_id uuid, claim_type text NOT NULL,
 claim_json jsonb NOT NULL DEFAULT '{}', review_status text NOT NULL DEFAULT 'verified',
 visibility text NOT NULL DEFAULT 'public', is_public boolean NOT NULL DEFAULT true,
 source_url text, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.candidates (
 id uuid PRIMARY KEY, person_id uuid, race_id uuid, is_public boolean NOT NULL DEFAULT true,
 external_id text, candidate_name text, source_url text
);

\ir ../../supabase/migrations/20260930060000_hold_registration_profile_parent_changes.sql

-- The candidate trigger already exists in full-local; attach it to these fixtures too.
CREATE TRIGGER hold_registration_candidate_profiles AFTER UPDATE ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.hold_changed_registration_profiles();

BEGIN;
INSERT INTO public.candidates(id, candidate_name, source_url) VALUES
 ('30000000-0000-4000-8000-000000000001', 'Fixture A', 'https://example.gov.tw/a'),
 ('30000000-0000-4000-8000-000000000002', 'Fixture B', 'https://example.gov.tw/b');
INSERT INTO public.person_claims(id, candidate_id, claim_type, claim_json, source_url) VALUES
 ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'candidacy', '{"registrationEvidence":{"fixture":"A"}}', 'https://example.gov.tw/a'),
 ('10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'candidacy', '{"registrationEvidence":{"fixture":"B"}}', 'https://example.gov.tw/b'),
 ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'birth_date', '{"registrationProposal":{"parentClaimId":"10000000-0000-4000-8000-000000000001"},"officialProfilePolicy":{"eligible":true}}', 'https://example.gov.tw/a'),
 ('20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'education', '{"registrationProposal":{"parentClaimId":"10000000-0000-4000-8000-000000000001"},"officialProfilePolicy":{"eligible":true}}', 'https://example.gov.tw/a'),
 ('20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', 'birth_date', '{"registrationProposal":{"parentClaimId":"10000000-0000-4000-8000-000000000002"},"officialProfilePolicy":{"eligible":true}}', 'https://example.gov.tw/b');
CREATE TEMP TABLE original_parent AS SELECT * FROM public.person_claims WHERE id = '10000000-0000-4000-8000-000000000001';
CREATE TEMP TABLE unrelated_profile AS SELECT * FROM public.person_claims WHERE id = '20000000-0000-4000-8000-000000000003';

CREATE FUNCTION pg_temp.assert_held(expected_reason text) RETURNS void LANGUAGE plpgsql AS $test$
BEGIN
 IF (SELECT count(*) FROM public.person_claims WHERE id IN ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')
      AND NOT is_public AND review_status = 'pending' AND visibility = 'private'
      AND claim_json->'officialProfilePolicy'->>'eligible' = 'false'
      AND claim_json->'officialProfilePolicy'->>'reason' = expected_reason) <> 2 THEN
  RAISE EXCEPTION 'Birthday and education were not both held: %', expected_reason;
 END IF;
 IF EXISTS (SELECT 1 FROM unrelated_profile old LEFT JOIN public.person_claims actual USING(id)
            WHERE to_jsonb(old) IS DISTINCT FROM to_jsonb(actual)) THEN
  RAISE EXCEPTION 'Unrelated parent profile changed';
 END IF;
END $test$;

SAVEPOINT unrelated_change;
UPDATE public.person_claims SET updated_at = clock_timestamp() WHERE id = '10000000-0000-4000-8000-000000000001';
DO $test$ BEGIN
 IF (SELECT count(*) FROM public.person_claims WHERE claim_type IN ('birth_date','education') AND is_public) <> 3 THEN
  RAISE EXCEPTION 'Unrelated parent metadata invalidated profiles';
 END IF;
END $test$;
ROLLBACK TO unrelated_change;

SAVEPOINT candidate_rebind;
UPDATE public.person_claims SET candidate_id = '30000000-0000-4000-8000-000000000002' WHERE id = '10000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_held('registration_parent_changed');
-- Restoring the link is not a new profile approval.
UPDATE public.person_claims SET candidate_id = '30000000-0000-4000-8000-000000000001' WHERE id = '10000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_held('registration_parent_changed');
ROLLBACK TO candidate_rebind;

SAVEPOINT type_change;
UPDATE public.person_claims SET claim_type = 'other' WHERE id = '10000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_held('registration_parent_changed');
ROLLBACK TO type_change;

SAVEPOINT source_change;
UPDATE public.person_claims SET source_url = 'https://example.gov.tw/replaced' WHERE id = '10000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_held('registration_parent_changed');
ROLLBACK TO source_change;

SAVEPOINT parent_delete;
DELETE FROM public.person_claims WHERE id = '10000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_held('registration_parent_deleted');
INSERT INTO public.person_claims SELECT * FROM original_parent;
SELECT pg_temp.assert_held('registration_parent_deleted');
ROLLBACK TO parent_delete;

SAVEPOINT existing_candidate_guard;
UPDATE public.candidates SET source_url = 'https://example.gov.tw/new-candidate-source' WHERE id = '30000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_held('registration_candidate_changed');
ROLLBACK TO existing_candidate_guard;

ROLLBACK;
SELECT 'registration parent guards: all synthetic regression assertions passed';
