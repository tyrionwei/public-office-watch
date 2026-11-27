-- Set-based birthday projection for the people touched by one claim statement.
-- Keeps direct demographics writes guarded; no rows or API privileges change.
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
)::text,'UTF8')),'hex')) IS DISTINCT FROM '2a7d6d64bfc043bbbaa12491ae8dd1f8d133535c3edadccdd515442f2b597038' THEN
   RAISE EXCEPTION 'Birthday projection baseline has changed; migration stopped';
 END IF;
END
$pow_guard$;
CREATE OR REPLACE FUNCTION public.guard_official_demographics()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE v text;
BEGIN
 -- Use an existing cache only inside the trusted definer's scope, and only
 -- if the physical session-local table belongs to that same trusted owner.
 IF EXISTS (
   SELECT FROM pg_catalog.pg_class c
   JOIN pg_catalog.pg_proc fn ON fn.oid='public.sync_official_profile_demographics()'::regprocedure
   WHERE c.oid=pg_catalog.to_regclass('pg_temp.pow_official_birth_batch')
   AND c.relnamespace=pg_catalog.pg_my_temp_schema()
   AND c.relpersistence='t' AND c.relkind='r'
   AND c.relowner=fn.proowner AND pg_catalog.pg_get_userbyid(fn.proowner)=current_user
 ) THEN
   SELECT t.birth_value INTO v FROM pg_temp.pow_official_birth_batch t WHERE t.person_id=NEW.person_id;
   IF FOUND THEN
     NEW.birth_date:=CASE WHEN v ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND pg_input_is_valid(v,'date') THEN v::date END;
     RETURN NEW;
   END IF;
 END IF;
 SELECT p.birth_value INTO v FROM public.official_profile_values p WHERE p.person_id=NEW.person_id;
 NEW.birth_date:=CASE WHEN v ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND pg_input_is_valid(v,'date') THEN v::date END;
 RETURN NEW;
END $f$;

CREATE OR REPLACE FUNCTION public.sync_official_profile_demographics()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE affected uuid[];
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT array_agg(DISTINCT t.person_id) INTO affected FROM new_claims t WHERE t.claim_type='birth_date';
 ELSIF TG_OP='DELETE' THEN
  SELECT array_agg(DISTINCT t.person_id) INTO affected FROM old_claims t WHERE t.claim_type='birth_date';
 ELSE
  SELECT array_agg(DISTINCT t.person_id) INTO affected FROM (
    SELECT person_id FROM old_claims WHERE claim_type='birth_date'
    UNION ALL SELECT person_id FROM new_claims WHERE claim_type='birth_date'
  ) t;
 END IF;
 IF affected IS NULL THEN RETURN NULL; END IF;
 -- CREATE without IF NOT EXISTS refuses any pre-existing name rather than trusting it.
 CREATE TEMP TABLE pg_temp.pow_official_birth_batch(person_id uuid PRIMARY KEY,birth_value text) ON COMMIT DROP;
 INSERT INTO pg_temp.pow_official_birth_batch
 WITH ids AS MATERIALIZED (
  SELECT DISTINCT m.canonical_person_id id FROM public.person_canonical_map m WHERE m.person_id=ANY(affected)
 ), birth AS MATERIALIZED (
  SELECT v.person_id, v.birth_value FROM public.official_profile_values v WHERE v.person_id IN (SELECT id FROM ids)
 )
 SELECT ids.id, birth.birth_value FROM ids LEFT JOIN birth ON birth.person_id=ids.id;
 INSERT INTO published.person_demographics(person_id,birth_date,observed_at)
 SELECT person_id,NULL,CURRENT_DATE FROM pg_temp.pow_official_birth_batch ORDER BY person_id
 ON CONFLICT(person_id) DO UPDATE SET birth_date=NULL,updated_at=now();
 DROP TABLE pg_temp.pow_official_birth_batch;
 RETURN NULL;
END $f$;
DROP TRIGGER sync_official_profile_demographics ON public.person_claims;
CREATE TRIGGER sync_official_birth_insert AFTER INSERT ON public.person_claims
 REFERENCING NEW TABLE AS new_claims FOR EACH STATEMENT EXECUTE FUNCTION public.sync_official_profile_demographics();
CREATE TRIGGER sync_official_birth_update AFTER UPDATE ON public.person_claims
 REFERENCING OLD TABLE AS old_claims NEW TABLE AS new_claims FOR EACH STATEMENT EXECUTE FUNCTION public.sync_official_profile_demographics();
CREATE TRIGGER sync_official_birth_delete AFTER DELETE ON public.person_claims
 REFERENCING OLD TABLE AS old_claims FOR EACH STATEMENT EXECUTE FUNCTION public.sync_official_profile_demographics();

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
   RAISE EXCEPTION 'Birthday projection migration did not match the reviewed definition';
 END IF;
END
$pow_guard$;
COMMIT;
