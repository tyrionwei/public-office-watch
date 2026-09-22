-- Full-local regression: fixture changes always roll back; never run on production.
BEGIN;
SET LOCAL statement_timeout='60s';
DO $$
DECLARE
 claim_id uuid := '35c0b7d5-9925-4300-a87f-fde402e81011';
 vp_id uuid := 'c129f52d-e1cb-4971-a26b-a372efbbdeae';
 candidate_key uuid;
 party_key uuid;
 party_race uuid;
 d date;
 taipei_today date := (now() AT TIME ZONE 'Asia/Taipei')::date;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.person_claims c CROSS JOIN LATERAL published.platform_fulfillment_results(c.id) f
 JOIN public.platform_voting_inaugurations i ON i.candidate_id=c.candidate_id
 WHERE i.starts_on=DATE '2022-12-25' AND f.voting_opens_on=DATE '2023-12-25') THEN RAISE EXCEPTION '2022 local inauguration failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.person_claims WHERE candidate_id='7d3ecf1f-0b4f-4ca3-95a8-ba71b04b109f'
  AND claim_type='platform' AND is_public AND review_status='verified' AND visibility='public'
  AND claim_json #>> '{contentSplit,reviewStatus}' IN ('auto_approved','reviewed')) THEN
  IF (SELECT starts_on FROM public.platform_voting_inaugurations WHERE candidate_id='7d3ecf1f-0b4f-4ca3-95a8-ba71b04b109f') IS DISTINCT FROM DATE '2022-12-25' THEN RAISE EXCEPTION 'Chiayi rerun inauguration failed'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM public.platform_voting_inaugurations WHERE candidate_id='7d3ecf1f-0b4f-4ca3-95a8-ba71b04b109f') THEN RAISE EXCEPTION 'Unprepared Chiayi platform seeded'; END IF;
 END IF;
 SELECT candidate_id INTO STRICT candidate_key FROM public.person_claims WHERE id=claim_id;
 SELECT min(voting_opens_on) INTO d FROM published.platform_fulfillment_results(claim_id);
 IF d IS DISTINCT FROM DATE '2025-05-20' THEN RAISE EXCEPTION 'President inauguration date failed: %',d; END IF;
 IF (SELECT min(voting_opens_on) FROM published.platform_fulfillment_results(vp_id)) IS DISTINCT FROM d THEN RAISE EXCEPTION 'VP date failed'; END IF;
 IF (SELECT count(*) FROM published.platform_fulfillment_results(claim_id))<>12 OR
    (SELECT count(*) FROM published.platform_fulfillment_results(vp_id))<>12 THEN RAISE EXCEPTION 'Merged president/VP platform missing'; END IF;
 IF public.platform_fulfillment_vote_claim_id(claim_id) IS DISTINCT FROM public.platform_fulfillment_vote_claim_id(vp_id) THEN RAISE EXCEPTION 'Shared vote route changed'; END IF;
 IF EXISTS(SELECT FROM public.platform_voting_inaugurations WHERE candidate_id='5df46cd1-24c7-41a2-9c46-a50488e787e3') THEN RAISE EXCEPTION 'Unconfirmed re-announcement seeded'; END IF;
 UPDATE public.platform_voting_inaugurations SET starts_on=(taipei_today-interval '1 year')::date+1 WHERE candidate_id=candidate_key;
 IF EXISTS(SELECT FROM published.platform_fulfillment_results(claim_id) WHERE voting_is_open) THEN RAISE EXCEPTION 'Opened before anniversary'; END IF;
 UPDATE public.platform_voting_inaugurations SET starts_on=(taipei_today-interval '1 year')::date WHERE candidate_id=candidate_key;
 IF NOT EXISTS(SELECT FROM published.platform_fulfillment_results(claim_id) WHERE voting_is_open) THEN RAISE EXCEPTION 'Did not open on anniversary'; END IF;
 UPDATE public.platform_voting_inaugurations SET starts_on=NULL WHERE candidate_id=candidate_key;
 IF EXISTS(SELECT FROM published.platform_fulfillment_results(claim_id) WHERE voting_is_open OR voting_opens_on IS NOT NULL) THEN RAISE EXCEPTION 'Unknown date must close'; END IF;
 IF NOT EXISTS(SELECT FROM published.platform_fulfillment_results(claim_id)) THEN RAISE EXCEPTION 'Unknown date must retain platform'; END IF;
 UPDATE public.platform_voting_inaugurations SET starts_on=DATE '2024-05-20' WHERE candidate_id=candidate_key;
 UPDATE public.candidates SET election_result='not_elected' WHERE id=candidate_key;
 IF EXISTS(SELECT FROM published.platform_fulfillment_results(claim_id)) THEN RAISE EXCEPTION 'Not elected must be excluded'; END IF;
 UPDATE public.candidates SET election_result='elected' WHERE id=candidate_key;
 UPDATE public.person_claims SET claim_json=jsonb_set(claim_json,'{contentSplit,reviewStatus}','"needs_review"') WHERE id=claim_id;
 IF EXISTS(SELECT FROM published.platform_fulfillment_results(claim_id)) THEN RAISE EXCEPTION 'Unreviewed platform allowed'; END IF;
 SELECT result_id,race_id INTO STRICT party_key,party_race FROM public.party_list_race_results WHERE is_public AND platform_items_reviewed_at IS NOT NULL AND allocated_seats>0 AND race_id='fbf84648-d6d7-480b-a0a4-518ad1f39d2b' LIMIT 1;
 IF (SELECT min(voting_opens_on) FROM published.platform_fulfillment_results(party_key)) IS DISTINCT FROM DATE '2025-02-01' THEN RAISE EXCEPTION 'Party date failed'; END IF;
 IF (SELECT min(voting_opens_on) FROM published.platform_fulfillment_results('88ec19b1-8a0d-43c7-914f-053aff1a28cd')) IS DISTINCT FROM DATE '2021-02-01' THEN RAISE EXCEPTION '2020 party date failed'; END IF;
 UPDATE public.party_list_race_results SET allocated_seats=0 WHERE result_id=party_key;
 IF EXISTS(SELECT FROM published.platform_fulfillment_results(party_key) WHERE voting_is_open) THEN RAISE EXCEPTION 'No-seat party opened'; END IF;
 IF has_table_privilege('anon','public.platform_voting_inaugurations','SELECT') OR has_table_privilege('authenticated','public.platform_voting_inaugurations','INSERT') THEN RAISE EXCEPTION 'Schedule ACL leak'; END IF;
 RAISE NOTICE 'PASS: dates, president/VP identity and shared votes, exception, anniversary, missing date, result, review, party threshold, ACL';
END;
$$;
ROLLBACK;
