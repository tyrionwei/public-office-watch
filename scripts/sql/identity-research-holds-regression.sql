-- Full local only; existing people fixture, all changes rolled back.
BEGIN;
DO $$
DECLARE p uuid; h uuid;
BEGIN
 SELECT id INTO p FROM public.people LIMIT 1;
 IF p IS NULL THEN RAISE EXCEPTION 'Requires full local fixture'; END IF;
 -- Remove holds for this fixture only within the rolled-back test.
 DELETE FROM public.person_identity_research_holds WHERE person_id=p;
 INSERT INTO public.person_identity_research_holds(person_id,reason,resume_condition,evidence_json,batch_key)
 VALUES(p,'test','new evidence','{}','regression') RETURNING id INTO h;
 IF NOT EXISTS(SELECT 1 FROM public.active_identity_research_holds WHERE id=h) THEN RAISE EXCEPTION 'Active hold missing'; END IF;
 BEGIN
  UPDATE public.person_identity_research_holds SET released_at=now() WHERE id=h;
  RAISE EXCEPTION 'Missing release reason accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 UPDATE public.person_identity_research_holds SET released_at=now(),release_reason='reviewed source bridge' WHERE id=h;
 IF EXISTS(SELECT 1 FROM public.active_identity_research_holds WHERE id=h) THEN RAISE EXCEPTION 'Released hold active'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.person_identity_research_holds WHERE id=h) THEN RAISE EXCEPTION 'History lost'; END IF;
 IF has_table_privilege('anon','public.person_identity_research_holds','SELECT') OR has_table_privilege('authenticated','public.active_identity_research_holds','SELECT') THEN RAISE EXCEPTION 'Private data exposed'; END IF;
END $$;
ROLLBACK;
