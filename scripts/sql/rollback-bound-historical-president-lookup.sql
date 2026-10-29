-- Manual inverse only after approval. Never run as part of forward migrations.
-- Stops if any other view expression has changed since the reviewed revision.
BEGIN;
DO $inverse$
DECLARE definition text; restored text;
BEGIN
 SELECT pg_get_viewdef('public.public_people_list'::regclass,true) INTO definition;
 IF (length(definition)-length(replace(definition,$new$historical_candidate.person_id = '5d623ab5-a2a2-4c40-a094-6b3712d648e5'::uuid$new$,'')))/length($new$historical_candidate.person_id = '5d623ab5-a2a2-4c40-a094-6b3712d648e5'::uuid$new$)<>1 THEN
  RAISE EXCEPTION 'Expected exactly one bounded historical person lookup';
 END IF;
 restored:=replace(definition,$new$historical_candidate.person_id = '5d623ab5-a2a2-4c40-a094-6b3712d648e5'::uuid$new$,$old$historical_candidate.person_id = classified.person_id$old$);
 IF md5(restored)<>'506c396b7174e54cd2a5ded7286a019d' THEN
  RAISE EXCEPTION 'People directory after-definition drift; do not overwrite';
 END IF;
 EXECUTE 'CREATE OR REPLACE VIEW public.public_people_list AS '||restored;
END $inverse$;
COMMIT;
