DO $test$ BEGIN
 IF (SELECT canonical_person_id FROM public.person_canonical_map WHERE person_id='23d0ca10-ef18-45f9-b942-c370c7e37684') IS DISTINCT FROM '23d0ca10-ef18-45f9-b942-c370c7e37684'::uuid THEN RAISE EXCEPTION 'invalid merge still active';END IF;
 IF (SELECT canonical_person_id FROM public.person_canonical_map WHERE person_id='8e6d15ea-714d-4472-a312-0aa4663d70a9') IS DISTINCT FROM '0f2525a9-8484-4885-a0b6-156a4b4880ea'::uuid THEN RAISE EXCEPTION 'valid historical mapping lost';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.candidates WHERE id='072505a7-8cf7-5204-bde5-413bb1dc3ae0' AND person_id='0f2525a9-8484-4885-a0b6-156a4b4880ea' AND candidate_name='江聰明' AND NOT is_public) THEN RAISE EXCEPTION 'uncertain candidate not held correctly';END IF;
 IF EXISTS(SELECT 1 FROM published.candidates WHERE candidate_id='072505a7-8cf7-5204-bde5-413bb1dc3ae0') THEN RAISE EXCEPTION 'pending candidate published';END IF;
 IF (SELECT person_id FROM published.candidate_facts WHERE candidate_id='57596ad7-aeb5-426c-a38a-d3847bbf6e75') IS DISTINCT FROM '23d0ca10-ef18-45f9-b942-c370c7e37684'::uuid THEN RAISE EXCEPTION 'historical candidate still under invalid canonical';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.person_merge_decisions WHERE duplicate_person_id='0bdf6d74-e2b2-41ef-8e07-1d2461876731' AND canonical_person_id='6fbed1cc-d8b6-4be7-9860-e002016c8cb0' AND status='rejected') THEN RAISE EXCEPTION 'different-person decision missing';END IF;
 IF EXISTS(SELECT 1 FROM public.person_duplicate_review_queue WHERE confidence_level='A' AND evidence_json->>'externalId' LIKE 'cec-historical:%') THEN RAISE EXCEPTION 'record key still A level';END IF;
 IF (SELECT birth_value FROM public.official_profile_values WHERE person_id='0bdf6d74-e2b2-41ef-8e07-1d2461876731') IS DISTINCT FROM '1966-10-07' THEN RAISE EXCEPTION 'visually reviewed official birth not adopted';END IF;
 IF (SELECT candidate_name FROM public.candidates WHERE id='94fa3737-3aa4-4b5b-996a-1f1d6161e198') IS DISTINCT FROM '謝龍介' THEN RAISE EXCEPTION 'previous correction lost';END IF;
END $test$;
SET LOCAL ROLE service_role;
UPDATE public.candidates SET is_public=true WHERE id='072505a7-8cf7-5204-bde5-413bb1dc3ae0';
UPDATE public.person_claims SET claim_json='{}',review_status='verified',visibility='public',is_public=true WHERE id='aed98fd1-a1d3-4231-a245-b1079f2d3d3f';
UPDATE public.candidates SET is_public=true,person_id='23d0ca10-ef18-45f9-b942-c370c7e37684',candidate_name='江聰明 wrong import' WHERE id='072505a7-8cf7-5204-bde5-413bb1dc3ae0';
UPDATE public.person_identity_matches SET match_status='auto_matched',evidence_json='{}' WHERE id='2fccf7bf-b15f-4834-a13b-ded72e187442';
UPDATE public.person_merge_decisions SET status='verified',evidence_json='{}' WHERE id='363a4dd2-9de5-48f9-b3da-4b3e2eea1013';
RESET ROLE;
DO $test$ BEGIN
 IF EXISTS(SELECT 1 FROM public.candidates WHERE id='072505a7-8cf7-5204-bde5-413bb1dc3ae0' AND (is_public OR person_id<>'0f2525a9-8484-4885-a0b6-156a4b4880ea'::uuid OR candidate_name<>'江聰明')) THEN RAISE EXCEPTION 'candidate reimport bypassed identity hold';END IF;
 IF EXISTS(SELECT 1 FROM public.person_claims WHERE id='aed98fd1-a1d3-4231-a245-b1079f2d3d3f' AND (is_public OR review_status='verified')) THEN RAISE EXCEPTION 'claim reimport bypassed identity hold';END IF;
END $test$;
DO $test$ BEGIN
 IF (SELECT match_status FROM public.person_identity_matches WHERE id='2fccf7bf-b15f-4834-a13b-ded72e187442')<>'possible_match' THEN RAISE EXCEPTION 'source attribution review overwritten'; END IF;
 IF (SELECT status FROM public.person_merge_decisions WHERE id='363a4dd2-9de5-48f9-b3da-4b3e2eea1013')<>'archived' THEN RAISE EXCEPTION 'invalid merge reactivated'; END IF;
END $test$;
SELECT 'bounded identity regression passed';
