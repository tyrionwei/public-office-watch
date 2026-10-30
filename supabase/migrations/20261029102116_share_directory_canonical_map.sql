-- Share only the four existing canonical-map references in public_people.
-- No identity decisions, visibility/policy predicates, triggers or grants change.
BEGIN;
DO $migration$
DECLARE definition text; metadata jsonb;
BEGIN
 SELECT pg_get_viewdef('public.public_people'::regclass,true) INTO definition;
 IF md5(definition)<>'c3cb90853c4b78fd8dd44fdedfd21791' THEN RAISE EXCEPTION 'Public people definition drift'; END IF;
 SELECT jsonb_build_object('owner',relowner,'acl',relacl,'options',reloptions) INTO metadata FROM pg_class WHERE oid='public.public_people'::regclass;
 definition:=replace(definition,'person_canonical_map','shared_canonical_map');
 definition:=replace(definition,'WITH mapped_people AS (','WITH shared_canonical_map AS MATERIALIZED (SELECT * FROM public.person_canonical_map), mapped_people AS (');
 EXECUTE 'CREATE OR REPLACE VIEW public.public_people AS '||definition;
 IF (SELECT jsonb_build_object('owner',relowner,'acl',relacl,'options',reloptions) FROM pg_class WHERE oid='public.public_people'::regclass) IS DISTINCT FROM metadata THEN
  RAISE EXCEPTION 'Public people security metadata changed'; END IF;
END $migration$;
COMMIT;
