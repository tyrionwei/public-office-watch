-- Full-local regression; existing fixture changes are always rolled back.
BEGIN;
SET LOCAL statement_timeout='60s';
DO $$
DECLARE
 target uuid := 'b2b89529-4a8b-4387-84d0-63e068a1f928';
 candidate_key uuid; race_key uuid; election_key uuid; d date;
BEGIN
 SELECT c.candidate_id,ca.race_id,r.election_id INTO STRICT candidate_key,race_key,election_key
 FROM public.person_claims c JOIN public.candidates ca ON ca.id=c.candidate_id
 JOIN public.races r ON r.id=ca.race_id WHERE c.id=target;
 SELECT min(voting_opens_on) INTO d FROM published.platform_fulfillment_results(target);
 IF d IS DISTINCT FROM DATE '2023-12-25' THEN RAISE EXCEPTION 'Mayor opens at term anniversary, got %',d; END IF;
 IF public.candidate_holds_office(candidate_key,'2022-12-24') THEN RAISE EXCEPTION 'Elected is not incumbent before inauguration'; END IF;
 IF NOT public.candidate_holds_office(candidate_key,'2022-12-25') THEN RAISE EXCEPTION 'Inauguration must activate incumbent'; END IF;
 IF public.candidate_holds_office(candidate_key,'2026-12-25') THEN RAISE EXCEPTION 'Previous term must expire'; END IF;
 -- An election in December can belong to a February term of the following year.
 UPDATE public.races SET race_type='legislator',voting_date='2019-12-15' WHERE id=race_key;
 SELECT starts_on INTO d FROM public.race_office_term(race_key);
 IF d IS DISTINCT FROM DATE '2020-02-01' THEN RAISE EXCEPTION 'Cross-year term failed: %',d; END IF;
 UPDATE public.races SET race_type='president',voting_date='2024-01-13' WHERE id=race_key;
 SELECT min(voting_opens_on) INTO d FROM published.platform_fulfillment_results(target);
 IF d IS DISTINCT FROM DATE '2025-05-20' THEN RAISE EXCEPTION 'President anniversary failed: %',d; END IF;
 UPDATE public.races SET race_type='local_chief',voting_date='2010-11-27' WHERE id=race_key;
 IF EXISTS(SELECT FROM published.platform_fulfillment_results(target) WHERE voting_is_open) THEN RAISE EXCEPTION 'Unsupported old local terms must stay closed'; END IF;
 UPDATE public.races SET voting_date='2022-12-18' WHERE id=race_key;
 SELECT starts_on INTO d FROM public.race_office_term(race_key);
 IF d IS DISTINCT FROM DATE '2022-12-25' THEN RAISE EXCEPTION 'Delayed regular election must use regular inauguration'; END IF;
 UPDATE public.elections SET election_type='by_election' WHERE id=election_key;
 IF EXISTS(SELECT FROM published.platform_fulfillment_results(target) WHERE voting_is_open) THEN RAISE EXCEPTION 'By-election requires explicit term evidence'; END IF;
 INSERT INTO public.race_office_term_overrides VALUES(race_key,'2023-03-01','2026-12-25','https://example.test/fixture','transaction fixture');
 SELECT min(voting_opens_on) INTO d FROM published.platform_fulfillment_results(target);
 IF d IS DISTINCT FROM DATE '2024-03-01' THEN RAISE EXCEPTION 'By-election override failed'; END IF;
 INSERT INTO public.candidate_office_tenures VALUES(candidate_key,'2023-03-05','2024-01-01','https://example.test/fixture','delayed inauguration and early departure');
 IF public.candidate_holds_office(candidate_key,'2023-03-04') OR public.candidate_holds_office(candidate_key,'2024-01-01') THEN RAISE EXCEPTION 'Individual tenure boundaries failed'; END IF;
 SELECT min(voting_opens_on) INTO d FROM published.platform_fulfillment_results(target);
 IF d IS DISTINCT FROM DATE '2024-03-05' THEN RAISE EXCEPTION 'Individual start overrides race term'; END IF;
 UPDATE public.candidates SET election_result='not_elected' WHERE id=candidate_key;
 IF EXISTS(SELECT FROM published.platform_fulfillment_results(target)) OR public.candidate_holds_office(candidate_key,'2023-06-01') THEN RAISE EXCEPTION 'Losing candidacy must not open or become incumbent'; END IF;
 UPDATE public.candidates SET election_result='elected' WHERE id=candidate_key;
 UPDATE public.person_claims SET claim_json=jsonb_set(claim_json,'{contentSplit,reviewStatus}','"needs_review"') WHERE id=target;
 IF EXISTS(SELECT FROM published.platform_fulfillment_results(target)) THEN RAISE EXCEPTION 'Unreviewed split must be excluded'; END IF;
 SELECT result_id,race_id INTO STRICT target,race_key FROM public.party_list_race_results WHERE is_public AND platform_items_reviewed_at IS NOT NULL AND allocated_seats>0 LIMIT 1;
 SELECT min(voting_opens_on) INTO d FROM published.platform_fulfillment_results(target);
 IF extract(month FROM d)<>2 OR extract(day FROM d)<>1 THEN RAISE EXCEPTION 'Party uses legislative term'; END IF;
 UPDATE public.party_list_race_results SET allocated_seats=0 WHERE result_id=target;
 IF EXISTS(SELECT FROM published.platform_fulfillment_results(target) WHERE voting_is_open) THEN RAISE EXCEPTION 'No-seat party must stay closed'; END IF;
 RAISE NOTICE 'PASS: inauguration, expiry, cross-year, presidential/legislative/local terms, delayed election, by-election, individual exceptions, elected result, review and party seats';
END;
$$;
ROLLBACK;
