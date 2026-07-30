BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_election_district_label(p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_result TEXT;
    v_match TEXT[];
BEGIN
    IF p_value IS NULL THEN
        RETURN NULL;
    END IF;

    v_result := BTRIM(p_value);
    IF v_result ~ '^0+[0-9]+$' THEN
        RETURN (v_result::NUMERIC)::TEXT;
    END IF;

    LOOP
        v_match := REGEXP_MATCH(
            v_result,
            '第[[:space:]]*0+([0-9]+)[[:space:]]*(選舉區|選區)'
        );
        EXIT WHEN v_match IS NULL;

        v_result := REGEXP_REPLACE(
            v_result,
            '第[[:space:]]*0+([0-9]+)[[:space:]]*(選舉區|選區)',
            '第' || (v_match[1]::NUMERIC)::TEXT || v_match[2]
        );
    END LOOP;

    LOOP
        v_match := REGEXP_MATCH(
            v_result,
            '(^|[^0-9第])0+([0-9]+)[[:space:]]*(選舉區|選區)'
        );
        EXIT WHEN v_match IS NULL;

        v_result := REGEXP_REPLACE(
            v_result,
            '(^|[^0-9第])0+([0-9]+)[[:space:]]*(選舉區|選區)',
            COALESCE(v_match[1], '') || (v_match[2]::NUMERIC)::TEXT || v_match[3]
        );
    END LOOP;

    RETURN v_result;
END;
$$;

UPDATE public.people
SET district = public.normalize_election_district_label(district)
WHERE district IS DISTINCT FROM public.normalize_election_district_label(district);

UPDATE public.source_people
SET
    district = public.normalize_election_district_label(district),
    normalized_region = public.normalize_election_district_label(normalized_region)
WHERE district IS DISTINCT FROM public.normalize_election_district_label(district)
   OR normalized_region IS DISTINCT FROM public.normalize_election_district_label(normalized_region);

UPDATE public.races
SET title = public.normalize_election_district_label(title)
WHERE title IS DISTINCT FROM public.normalize_election_district_label(title);

CREATE OR REPLACE FUNCTION public.normalize_election_district_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF TG_TABLE_NAME = 'people' THEN
        NEW.district := public.normalize_election_district_label(NEW.district);
    ELSIF TG_TABLE_NAME = 'source_people' THEN
        NEW.district := public.normalize_election_district_label(NEW.district);
        NEW.normalized_region := public.normalize_election_district_label(NEW.normalized_region);
    ELSIF TG_TABLE_NAME = 'races' THEN
        NEW.title := public.normalize_election_district_label(NEW.title);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_people_election_district ON public.people;
CREATE TRIGGER trg_normalize_people_election_district
BEFORE INSERT OR UPDATE OF district ON public.people
FOR EACH ROW
EXECUTE FUNCTION public.normalize_election_district_fields();

DROP TRIGGER IF EXISTS trg_normalize_source_people_election_district ON public.source_people;
CREATE TRIGGER trg_normalize_source_people_election_district
BEFORE INSERT OR UPDATE OF district, normalized_region ON public.source_people
FOR EACH ROW
EXECUTE FUNCTION public.normalize_election_district_fields();

DROP TRIGGER IF EXISTS trg_normalize_race_election_district ON public.races;
CREATE TRIGGER trg_normalize_race_election_district
BEFORE INSERT OR UPDATE OF title ON public.races
FOR EACH ROW
EXECUTE FUNCTION public.normalize_election_district_fields();

REVOKE ALL ON FUNCTION public.normalize_election_district_label(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_election_district_fields() FROM PUBLIC;

SELECT public.refresh_public_people_list_cached();
SELECT published.promote(NULL);

COMMENT ON FUNCTION public.normalize_election_district_label(TEXT) IS
    'Normalizes election district numbers to unpadded Arabic numerals without changing source URLs.';
COMMENT ON FUNCTION public.normalize_election_district_fields() IS
    'Keeps stored people, source people, and race district labels normalized on every write.';

COMMIT;
