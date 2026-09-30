BEGIN;

-- Classify the office, not a substring in a place name (e.g. 縣長治鄉).
CREATE OR REPLACE FUNCTION public.people_directory_chief_role(label text, district text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $function$
DECLARE
 value text := regexp_replace(coalesce(label,''), '\s+', '', 'g');
 city text := regexp_replace(coalesce(district,''), '\s+', '', 'g');
 deputy boolean;
BEGIN
 IF value ~ '(鄉長|鎮長|區長|村長|里長|代表|鄉鎮市長|縣轄市長)' THEN RETURN NULL; END IF;
 value := regexp_replace(value, '(候選人|參選人|選舉)$', '');
 value := regexp_replace(value, '^(19|20)[0-9]{2}年', '');
 value := regexp_replace(value, '^(曾任|前任|現任|代理|前|現)', '');
 deputy := value ~ '副(市長|縣長|縣市長|直轄市長)$';
 value := regexp_replace(value, '副(市長|縣長|縣市長|直轄市長)$', '\1');
 IF value ~ '(縣長|縣市長|直轄市長)$'
 OR value ~ '^(曾任|前任|現任|代理|前|現)?(臺北|台北|新北|桃園|臺中|台中|臺南|台南|高雄|基隆|新竹|嘉義)市市?長$'
 OR (value = '市長' AND city ~ '^(臺北|台北|新北|桃園|臺中|台中|臺南|台南|高雄|基隆|新竹|嘉義)市$') THEN
  RETURN CASE WHEN deputy THEN 'local_deputy' ELSE 'local_chief' END;
 END IF;
 RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public.people_directory_chief_role(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.people_directory_chief_role(text,text) TO anon, authenticated, service_role;

-- Keep the deployed view's identity, official-profile and term-calendar logic.
DO $patch$
DECLARE
 definition text := pg_get_viewdef('public.public_people_list'::regclass, true);
 old_deputy text := $$classified.list_position ~ '(副市長|副縣長|副縣市長)'::text$$;
 old_chief text := $$classified.list_position ~ '(市長|縣長)'::text$$;
 new_deputy text := $$public.people_directory_chief_role(classified.list_position, COALESCE(classified.assignment_region_name, classified.district)) = 'local_deputy'::text$$;
 new_chief text := $$public.people_directory_chief_role(classified.list_position, COALESCE(classified.assignment_region_name, classified.district)) = 'local_chief'::text$$;
BEGIN
 IF position(old_chief in definition)>0 AND position(old_deputy in definition)>0 THEN
  definition := replace(replace(definition,old_deputy,new_deputy),old_chief,new_chief);
  EXECUTE 'CREATE OR REPLACE VIEW public.public_people_list AS ' || definition;
 ELSIF position('people_directory_chief_role' in definition)=0 THEN
  RAISE EXCEPTION 'Unexpected people directory classification; review baseline before applying';
 END IF;
END;
$patch$;

REFRESH MATERIALIZED VIEW public.public_people_list_cached;
DO $refresh$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='published' AND c.relname='people_directory_snapshot' AND c.relkind='m') THEN
  REFRESH MATERIALIZED VIEW published.people_directory_snapshot;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='published' AND c.relname='people_directory' AND c.relkind='m') THEN
  REFRESH MATERIALIZED VIEW published.people_directory;
 END IF;
END;
$refresh$;
COMMIT;
