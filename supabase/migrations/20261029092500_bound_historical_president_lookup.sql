-- The enclosing CASE already restricts this branch to the same person UUID.
-- Make its evidence lookup uncorrelated; keep every public/identity/election
-- predicate unchanged. No cache trigger, role, ACL, or data is changed here.
BEGIN;
DO $migration$
DECLARE definition text; before_metadata jsonb;
BEGIN
 SELECT pg_get_viewdef('public.public_people_list'::regclass,true) INTO definition;
 IF md5(definition)<>'506c396b7174e54cd2a5ded7286a019d' THEN
  RAISE EXCEPTION 'People directory definition drift; review before applying';
 END IF;
 IF (length(definition)-length(replace(definition,$old$historical_candidate.person_id = classified.person_id$old$,'')))/length($old$historical_candidate.person_id = classified.person_id$old$)<>1 THEN
  RAISE EXCEPTION 'Expected exactly one historical person correlation';
 END IF;
 SELECT jsonb_build_object('owner',relowner,'acl',relacl,'options',reloptions) INTO before_metadata
 FROM pg_class WHERE oid='public.public_people_list'::regclass;
 EXECUTE 'CREATE OR REPLACE VIEW public.public_people_list AS '||replace(definition,$old$historical_candidate.person_id = classified.person_id$old$,$new$historical_candidate.person_id = '5d623ab5-a2a2-4c40-a094-6b3712d648e5'::uuid$new$);
 IF (SELECT jsonb_build_object('owner',relowner,'acl',relacl,'options',reloptions) FROM pg_class
  WHERE oid='public.public_people_list'::regclass) IS DISTINCT FROM before_metadata THEN
  RAISE EXCEPTION 'People directory security metadata changed';
 END IF;
END $migration$;
COMMIT;
