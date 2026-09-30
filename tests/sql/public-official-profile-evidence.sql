-- Run in a rollback transaction after the projection migration on full-local.
CREATE TEMP TABLE profile_release_sample ON COMMIT DROP AS
SELECT DISTINCT m.canonical_person_id AS person_id FROM public.person_claims c
JOIN public.person_canonical_map m ON m.person_id=c.person_id
JOIN public.public_people_list_cached p ON p.person_id=m.canonical_person_id
WHERE c.claim_json ? 'registrationProposal' AND c.is_public AND c.review_status='verified' AND c.claim_type IN ('birth_date','education') LIMIT 4;
GRANT SELECT ON profile_release_sample TO anon;
SET LOCAL ROLE anon;
DO $test$
DECLARE payload jsonb; person uuid; item jsonb; count_profile integer:=0;
BEGIN
 payload:=public.public_official_profile_json('birth_date','{"registrationProposal":{"raw":"PRIVATE_SENTINEL"},"registrationProfileReview":{"identity":"PRIVATE_SENTINEL"},"officialProfilePolicy":{"version":"official-profile-v1","eligible":true,"identityVerified":true,"contentVerified":true,"datePrecision":"year","archivedEvidence":"PRIVATE_SENTINEL"}}');
 IF payload::text LIKE '%PRIVATE_SENTINEL%' OR payload->'officialProfilePolicy'->>'datePrecision'<>'year' THEN RAISE EXCEPTION 'Projection leaked private evidence or lost precision'; END IF;
 IF public.public_official_profile_json('party','{"value":"unchanged"}')<>'{"value":"unchanged"}'::jsonb THEN RAISE EXCEPTION 'Unrelated claim changed'; END IF;
 FOR person IN SELECT person_id FROM profile_release_sample LOOP
  payload:=published.person_profiles_for(ARRAY[person]);
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'claim_rows') WHERE value->>'claim_type' IN ('birth_date','education','experience') LOOP
   count_profile:=count_profile+1;
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(item->'claim_json') k WHERE k<>'officialProfilePolicy') OR EXISTS(SELECT 1 FROM jsonb_object_keys(item->'claim_json'->'officialProfilePolicy') k WHERE k NOT IN ('version','eligible','identityVerified','contentVerified','datePrecision')) THEN RAISE EXCEPTION 'Public profile leaked private evidence'; END IF;
   IF item->'claim_json'->'officialProfilePolicy'->>'eligible'<>'true' OR item->>'claim_value' IS NULL THEN RAISE EXCEPTION 'Adopted value missing'; END IF;
  END LOOP;
 END LOOP;
 IF count_profile=0 THEN RAISE EXCEPTION 'No real profile claims exercised'; END IF;
END $test$;
RESET ROLE;
SELECT 'public_official_profile_evidence_passed';
