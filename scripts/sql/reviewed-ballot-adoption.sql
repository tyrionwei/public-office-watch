-- Session-local adoption functions. No publication/review/qualification updates.
CREATE OR REPLACE FUNCTION pg_temp.ballot_adopt(batch jsonb, reverse_change boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE before_image jsonb; after_image jsonb; item jsonb; actual jsonb; expected jsonb; facts jsonb; ev jsonb;
        new_count integer:=0; replay_count integer:=0; v_id uuid; undo boolean:=reverse_change;
BEGIN
 IF jsonb_typeof(batch)<>'array' OR jsonb_array_length(batch)=0 THEN RAISE EXCEPTION 'empty/invalid batch'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(batch) x GROUP BY x->'before'->>'id' HAVING count(*)>1)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(batch) x GROUP BY x->'before'->>'race_id',x->'after'->>'candidate_no' HAVING count(*)>1) THEN RAISE EXCEPTION 'duplicate subject/race ballot'; END IF;
 LOCK TABLE public.candidates, published.candidate_facts, public.candidate_lifecycle_events IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE public.races, public.elections, public.regions, public.person_claims IN SHARE MODE;
 FOR item IN SELECT value FROM jsonb_array_elements(batch) LOOP
  before_image:=item->'before'; after_image:=item->'after';
  item:=jsonb_set(item,'{event}',to_jsonb(jsonb_populate_record(NULL::public.candidate_lifecycle_events,item->'event')));
  v_id:=(before_image->>'id')::uuid;
  IF (before_image-'candidate_no') IS DISTINCT FROM (after_image-'candidate_no')
    OR NOT coalesce(after_image->>'candidate_no' ~ '^[1-9][0-9]{0,19}$',false)
    OR item->>'source_review_status' IS DISTINCT FROM 'ai_verified'
    OR (item->'event'->>'is_public')::boolean IS DISTINCT FROM false
    OR item->'event'->>'candidate_id' IS DISTINCT FROM v_id::text
    OR item->'event'->>'event_type' IS DISTINCT FROM 'ballot_number_assigned'
    OR item->'event'->'event_data'->>'candidateNo' IS DISTINCT FROM after_image->>'candidate_no'
  THEN RAISE EXCEPTION 'invalid number-only proposal %',v_id; END IF;
  SELECT to_jsonb(c) INTO actual FROM public.candidates c WHERE c.id=v_id;
  IF actual IS DISTINCT FROM before_image AND actual IS DISTINCT FROM after_image THEN RAISE EXCEPTION 'candidate before/after drift %',v_id; END IF;
  IF (SELECT to_jsonb(r) FROM public.races r WHERE r.id=(before_image->>'race_id')::uuid) IS DISTINCT FROM item->'race'
   OR (SELECT to_jsonb(e) FROM public.elections e WHERE e.id=(item->'race'->>'election_id')::uuid) IS DISTINCT FROM item->'election'
   OR (SELECT to_jsonb(g) FROM public.regions g WHERE g.id=(item->'race'->>'region_id')::uuid) IS DISTINCT FROM item->'region'
  THEN RAISE EXCEPTION 'scope drift %',v_id; END IF;
  IF EXISTS(SELECT 1 FROM public.person_claims c WHERE c.claim_json->'identityAudit'->>'status'='pending' AND (c.claim_json->'identityAudit'->>'candidateId'=v_id::text OR c.claim_json->>'candidateExternalId'=before_image->>'external_id')) THEN RAISE EXCEPTION 'pending identity guard %',v_id; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(item->'reviewed_identity_claims') q LEFT JOIN public.person_claims c ON c.id=(q->>'id')::uuid WHERE to_jsonb(c) IS DISTINCT FROM q) THEN RAISE EXCEPTION 'identity evidence drift %',v_id; END IF;
  IF EXISTS(SELECT 1 FROM public.candidates c WHERE c.race_id=(before_image->>'race_id')::uuid AND c.id<>v_id AND c.candidate_no=after_image->>'candidate_no') THEN RAISE EXCEPTION 'ballot occupied %',v_id; END IF;
  SELECT to_jsonb(f) INTO facts FROM published.candidate_facts f WHERE f.candidate_id=v_id;
  expected:=CASE WHEN actual=after_image THEN item->'facts_after' ELSE item->'facts_before' END;
  IF coalesce(facts,'null'::jsonb) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'published facts drift %',v_id; END IF;
  SELECT to_jsonb(e) INTO ev FROM public.candidate_lifecycle_events e WHERE e.external_id=item->'event'->>'external_id';
  IF (SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id),'[]') FROM public.candidate_lifecycle_events e WHERE e.candidate_id=v_id AND e.external_id<>item->'event'->>'external_id') IS DISTINCT FROM item->'baseline_events' THEN RAISE EXCEPTION 'existing events drift %',v_id; END IF;
  IF actual=after_image THEN
   IF ev IS DISTINCT FROM item->'event' THEN RAISE EXCEPTION 'event replay/conflict %',v_id; END IF;
   IF NOT undo THEN replay_count:=replay_count+1; CONTINUE; END IF;
  ELSE
   IF ev IS NOT NULL THEN RAISE EXCEPTION 'unexpected existing event %',v_id; END IF;
   IF undo THEN replay_count:=replay_count+1; CONTINUE; END IF;
  END IF;
  expected:=CASE WHEN undo THEN before_image ELSE after_image END;
  UPDATE public.candidates SET candidate_no=expected->>'candidate_no' WHERE candidates.id=v_id;
  IF (SELECT to_jsonb(c) FROM public.candidates c WHERE c.id=v_id) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'protected candidate changed by native trigger %',v_id; END IF;
  IF facts IS NOT NULL THEN
   UPDATE published.candidate_facts SET candidate_no=expected->>'candidate_no' WHERE candidate_id=v_id;
   IF (SELECT to_jsonb(f) FROM published.candidate_facts f WHERE candidate_id=v_id) IS DISTINCT FROM (CASE WHEN undo THEN item->'facts_before' ELSE item->'facts_after' END) THEN RAISE EXCEPTION 'protected facts changed %',v_id; END IF;
  END IF;
  IF undo THEN DELETE FROM public.candidate_lifecycle_events WHERE external_id=item->'event'->>'external_id';
  ELSE INSERT INTO public.candidate_lifecycle_events SELECT * FROM jsonb_populate_record(NULL::public.candidate_lifecycle_events,item->'event'); END IF;
  new_count:=new_count+1;
 END LOOP;
 RETURN jsonb_build_object('changed',new_count,'replayed',replay_count,'rollback',undo);
END $fn$;
