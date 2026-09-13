-- Include immediately after reviewed-office-release.sql in the same rollback transaction.
SELECT pg_temp.assert_true(NOT EXISTS(
 SELECT 1 FROM pg_depend d JOIN pg_rewrite w ON w.oid=d.objid
 WHERE d.refobjid IN ('public.candidate_holds_office_source(uuid,date)'::regprocedure,'public.candidate_office_term_source(uuid)'::regprocedure)
),'no view is bound to a source-copy function');
-- Reuse the earlier approved-shaped transaction fixture with the fresh revision.
UPDATE package SET p=jsonb_set(jsonb_set(p,'{expectedOfficeRevision}',to_jsonb((SELECT revision FROM public.office_release_state))),'{packageId}',to_jsonb(gen_random_uuid()));
SELECT public.apply_reviewed_office_release(p) FROM package;
GRANT SELECT ON fixture TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE f record; v text; n integer; ended boolean;
BEGIN
 SELECT * INTO f FROM fixture;
 FOREACH v IN ARRAY ARRAY['public.public_candidates','published.candidates'] LOOP
 EXECUTE format('SELECT count(*),bool_and(NOT office_is_current) FROM %s WHERE person_id=%L::uuid AND candidate_id=%L::uuid',v,f.person_id,f.candidate_id) INTO n,ended;
 IF n<>1 OR ended IS DISTINCT FROM true THEN RAISE EXCEPTION 'Candidate view % did not expose the approved early departure',v; END IF;
 END LOOP;
END;
$$;
RESET ROLE;

CREATE TEMP TABLE live_candidate AS SELECT c.* FROM published.candidate_facts c
 JOIN published.races r USING(race_id) WHERE c.election_year=2026 AND r.race_type='city_councilor' AND c.election_result='pending' LIMIT 1;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM live_candidate),'live candidacy fixture exists');
UPDATE published.candidate_facts SET person_id=(SELECT person_id FROM fixture) WHERE candidate_id=(SELECT candidate_id FROM live_candidate);
SELECT pg_temp.assert_true(public.reviewed_office_snapshot(person_id,'2026-09-13')->>'list_status'='candidate','former officeholder running again is a candidate') FROM fixture;
UPDATE public.races SET is_public=false WHERE id=(SELECT race_id FROM live_candidate);
SELECT pg_temp.assert_true(public.reviewed_office_snapshot(person_id,'2026-09-13')->>'list_status'='former','hidden race does not contribute candidacy') FROM fixture;
UPDATE public.races SET is_public=true WHERE id=(SELECT race_id FROM live_candidate);
UPDATE published.candidate_facts SET candidacy_status='withdrawn_or_disqualified' WHERE candidate_id=(SELECT candidate_id FROM live_candidate);
SELECT pg_temp.assert_true(public.reviewed_office_snapshot(person_id,'2026-09-13')->>'list_status'='former','withdrawal is read live without another office release') FROM fixture;
UPDATE published.candidate_facts SET candidacy_status='qualified',election_result='not_elected' WHERE candidate_id=(SELECT candidate_id FROM live_candidate);
SELECT pg_temp.assert_true(public.reviewed_office_snapshot(person_id,'2026-12-01')->>'list_status'='former','loss is read live') FROM fixture;
UPDATE published.candidate_facts SET election_result='elected' WHERE candidate_id=(SELECT candidate_id FROM live_candidate);
INSERT INTO public.reviewed_office_terms
 SELECT c.candidate_id,f.person_id,c.race_id,'local','2026-12-25','2030-12-25',NULL,'https://example.test/future','fixture','transaction fixture',t.current_snapshot,t.former_snapshot,t.release_id
 FROM live_candidate c,fixture f,public.reviewed_office_terms t WHERE t.candidate_id=f.candidate_id;
SELECT pg_temp.assert_true(public.reviewed_office_snapshot(person_id,'2026-12-01')->>'list_status'='candidate','returning winner remains candidate before inauguration') FROM fixture;
SELECT pg_temp.assert_true(public.reviewed_office_snapshot(person_id,'2026-12-25')->>'list_status'='current','returning winner starts office on inauguration') FROM fixture;
UPDATE published.candidate_facts current SET person_id=old.person_id,candidacy_status=old.candidacy_status,election_result=old.election_result FROM live_candidate old WHERE current.candidate_id=old.candidate_id;
SELECT pg_temp.assert_true((public.office_release_baseline(ARRAY(SELECT person_id FROM fixture))->>'candidacyContextVersion')='1','baseline supplies versioned live candidacy context');
