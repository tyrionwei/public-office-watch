-- Full-local scoped regression: run after the reviewed release SQL inside a rollback transaction.
DO $checks$ BEGIN
 IF EXISTS(SELECT 1 FROM registration_profile_batch b JOIN public.person_claims c ON c.claim_key=b.r->'claim'->>'claim_key' LEFT JOIN public.official_profile_values v ON v.person_id=(b.r->>'canonicalPersonId')::uuid WHERE b.r->>'decision'='adopt' AND (CASE WHEN c.claim_type='birth_date' THEN v.birth_value ELSE v.education END) IS DISTINCT FROM c.claim_value) THEN RAISE EXCEPTION 'Adopted field projection mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM registration_profile_batch b JOIN published.person_demographics d ON d.person_id=(b.r->>'canonicalPersonId')::uuid WHERE b.r->>'decision'='adopt' AND b.r->'claim'->>'claim_type'='birth_date' AND b.r->'claim'->'claim_json'->'officialProfilePolicy'->>'datePrecision'='year' AND d.birth_date IS NOT NULL) THEN RAISE EXCEPTION 'Masked date created an age'; END IF;
 IF EXISTS(SELECT 1 FROM registration_profile_batch b LEFT JOIN published.person_demographics d ON d.person_id=(b.r->>'canonicalPersonId')::uuid WHERE b.r->>'decision'='adopt' AND b.r->'claim'->>'claim_type'='birth_date' AND b.r->'claim'->'claim_json'->'officialProfilePolicy'->>'datePrecision'='day' AND d.birth_date::text IS DISTINCT FROM b.r->'claim'->>'claim_value') THEN RAISE EXCEPTION 'Full birthday demographic mismatch'; END IF;
 IF (SELECT birth_value FROM public.official_profile_values WHERE person_id='0bdf6d74-e2b2-41ef-8e07-1d2461876731') IS DISTINCT FROM '1966-10-07' THEN RAISE EXCEPTION 'More complete official birthday lost'; END IF;
 IF (SELECT is_public FROM public.candidates WHERE id='072505a7-8cf7-5204-bde5-413bb1dc3ae0') IS DISTINCT FROM false THEN RAISE EXCEPTION 'Jiang candidate unquarantined'; END IF;
 IF EXISTS(SELECT 1 FROM public.public_people_list_cached c JOIN registration_profile_batch b ON c.person_id=(b.r->>'canonicalPersonId')::uuid LEFT JOIN public.official_profile_values v ON v.person_id=c.person_id WHERE ROW(c.education,c.experience) IS DISTINCT FROM ROW(v.education,v.experience)) THEN RAISE EXCEPTION 'Profile cache mismatch'; END IF;
END $checks$;
CREATE TEMP TABLE adopted_sample AS SELECT c.* FROM public.person_claims c WHERE claim_key='registration-profile:official-candidacy:pow-cec-registration-2026-d0bc765d26be006806e4acef5f090b0b:birth_date';
SET LOCAL ROLE service_role;
UPDATE public.person_claims SET candidate_id=NULL,claim_json=jsonb_build_object('registrationProposal',claim_json->'registrationProposal','officialProfilePolicy',jsonb_build_object('reason','official_evidence_pending')),review_status='pending',visibility='private',is_public=false WHERE id=(SELECT id FROM public.person_claims WHERE claim_key='registration-profile:official-candidacy:pow-cec-registration-2026-d0bc765d26be006806e4acef5f090b0b:birth_date');
RESET ROLE;
DO $checks$ BEGIN
 IF EXISTS(SELECT 1 FROM adopted_sample s JOIN public.person_claims c USING(id) WHERE ROW(c.claim_value,c.candidate_id,c.is_public,c.review_status,c.claim_json->'registrationProfileReview',c.claim_json->'registrationProposal',c.claim_json->'officialProfilePolicy') IS DISTINCT FROM ROW(s.claim_value,s.candidate_id,s.is_public,s.review_status,s.claim_json->'registrationProfileReview',s.claim_json->'registrationProposal',s.claim_json->'officialProfilePolicy')) THEN RAISE EXCEPTION 'Reimport lost adoption evidence'; END IF;
END $checks$;
UPDATE public.person_claims SET review_status='pending' WHERE id='52fa760f-7d0d-4109-9cd2-76787fb364fc';
DO $checks$ BEGIN
 IF EXISTS(SELECT 1 FROM adopted_sample s JOIN public.person_claims c USING(id) WHERE c.is_public OR c.review_status<>'pending') THEN RAISE EXCEPTION 'Pending parent did not hold profile'; END IF;
 IF (SELECT birth_value FROM public.official_profile_values WHERE person_id='f38a4e3b-eb96-4022-8fe2-4b731016f511') IS NOT NULL THEN RAISE EXCEPTION 'Held birthday projection retained'; END IF;
END $checks$;
UPDATE public.person_claims SET review_status='verified' WHERE id='52fa760f-7d0d-4109-9cd2-76787fb364fc';
DO $checks$ BEGIN
 IF EXISTS(SELECT 1 FROM adopted_sample s JOIN public.person_claims c USING(id) WHERE c.is_public) THEN RAISE EXCEPTION 'Parent verification autoapproved profile'; END IF;
END $checks$;
CREATE TEMP TABLE partial_sample AS SELECT c.* FROM registration_profile_batch b JOIN public.person_claims c ON c.claim_key=b.r->'claim'->>'claim_key' WHERE b.r->>'decision'='adopt' AND c.claim_type='birth_date' AND c.claim_json->'officialProfilePolicy'->>'datePrecision'='year' LIMIT 1;
UPDATE public.candidates SET source_url=source_url||'#regression-fixture' WHERE id=(SELECT candidate_id FROM partial_sample);
DO $checks$ BEGIN
 IF EXISTS(SELECT 1 FROM partial_sample s JOIN public.person_claims c USING(id) WHERE c.is_public OR c.review_status<>'pending') THEN RAISE EXCEPTION 'Candidate source drift did not hold profile'; END IF;
END $checks$;
SELECT 'registration_profile_regression_passed';
