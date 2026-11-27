-- Operator rollback for 20261127094600 only. No data or migration ledger edits.
-- If a later schema changes these definitions, stop instead of restoring over it.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.person_claims, published.person_demographics IN SHARE ROW EXCLUSIVE MODE;

DO $pow_guard$
BEGIN
 IF (SELECT encode(sha256(convert_to(jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_object('definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text) ORDER BY p.proname)
 FROM pg_proc p WHERE p.oid IN('public.sync_official_profile_demographics()'::regprocedure,'public.guard_official_demographics()'::regprocedure)),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(pg_get_triggerdef(t.oid),t.tgenabled) ORDER BY t.tgname)
 FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgrelid IN('public.person_claims'::regclass,'published.person_demographics'::regclass)
 AND t.tgfoid IN('public.sync_official_profile_demographics()'::regprocedure,'public.guard_official_demographics()'::regprocedure)),
 'profile_view',pg_get_viewdef('public.official_profile_values'::regclass)
)::text,'UTF8')),'hex')) IS DISTINCT FROM '9a6f7b4e82e72882951f6aa27990ac95b4ef115ecdf8461d74c59a175e34f093' THEN
   RAISE EXCEPTION 'Birthday projection no longer matches this migration; rollback stopped';
 END IF;
END
$pow_guard$;
DROP TRIGGER sync_official_birth_insert ON public.person_claims;
DROP TRIGGER sync_official_birth_update ON public.person_claims;
DROP TRIGGER sync_official_birth_delete ON public.person_claims;
CREATE OR REPLACE FUNCTION public.guard_official_demographics()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE v text;
BEGIN
 SELECT p.birth_value INTO v FROM public.official_profile_values p WHERE p.person_id=NEW.person_id;
 NEW.birth_date:=CASE WHEN v ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND pg_input_is_valid(v,'date') THEN v::date END;
 RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.sync_official_profile_demographics()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_id uuid;
BEGIN
 IF TG_OP='INSERT' AND NEW.claim_type<>'birth_date' THEN RETURN NULL; END IF;
 IF TG_OP='DELETE' AND OLD.claim_type<>'birth_date' THEN RETURN NULL; END IF;
 IF TG_OP='UPDATE' AND NEW.claim_type<>'birth_date' AND OLD.claim_type<>'birth_date' THEN RETURN NULL; END IF;
 FOR v_id IN SELECT DISTINCT m.canonical_person_id FROM public.person_canonical_map m
 WHERE m.person_id=ANY(ARRAY[CASE WHEN TG_OP<>'INSERT' THEN OLD.person_id END,CASE WHEN TG_OP<>'DELETE' THEN NEW.person_id END]) LOOP
  INSERT INTO published.person_demographics(person_id,birth_date,observed_at)
  VALUES(v_id,NULL,CURRENT_DATE)
  ON CONFLICT(person_id) DO UPDATE SET birth_date=NULL,updated_at=now();
 END LOOP;
 RETURN NULL;
END $function$
;
CREATE TRIGGER sync_official_profile_demographics AFTER INSERT OR DELETE OR UPDATE ON public.person_claims FOR EACH ROW EXECUTE FUNCTION public.sync_official_profile_demographics();

DO $pow_guard$
BEGIN
 IF (SELECT encode(sha256(convert_to(jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_object('definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text) ORDER BY p.proname)
 FROM pg_proc p WHERE p.oid IN('public.sync_official_profile_demographics()'::regprocedure,'public.guard_official_demographics()'::regprocedure)),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(pg_get_triggerdef(t.oid),t.tgenabled) ORDER BY t.tgname)
 FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgrelid IN('public.person_claims'::regclass,'published.person_demographics'::regclass)
 AND t.tgfoid IN('public.sync_official_profile_demographics()'::regprocedure,'public.guard_official_demographics()'::regprocedure)),
 'profile_view',pg_get_viewdef('public.official_profile_values'::regclass)
)::text,'UTF8')),'hex')) IS DISTINCT FROM '2a7d6d64bfc043bbbaa12491ae8dd1f8d133535c3edadccdd515442f2b597038' THEN
   RAISE EXCEPTION 'Birthday projection rollback did not restore the original definition';
 END IF;
END
$pow_guard$;
COMMIT;
