BEGIN;

-- A future candidacy describes the office sought, not a current job. The view
-- already exposes upcoming_candidate_label separately, so do not also place it
-- in the generic position field consumed by profile facts and structured data.
DO $$
DECLARE
    view_definition TEXT;
    old_projection CONSTANT TEXT :=
        E'COALESCE(official_current_offices.current_office_label, current_offices.current_office_label, upcoming_candidates.upcoming_candidate_label,\n        CASE';
    new_projection CONSTANT TEXT :=
        E'COALESCE(official_current_offices.current_office_label, current_offices.current_office_label,\n        CASE';
BEGIN
    SELECT pg_get_viewdef('public.public_people'::REGCLASS, TRUE)
    INTO view_definition;

    IF STRPOS(view_definition, old_projection) = 0 THEN
        RAISE EXCEPTION 'public_people position projection no longer matches the expected definition';
    END IF;

    view_definition := REPLACE(view_definition, old_projection, new_projection);

    EXECUTE 'CREATE OR REPLACE VIEW public.public_people AS '
        || RTRIM(view_definition, E' \n\t;');
END;
$$;

SELECT public.refresh_public_people_list_cached();
SELECT published.promote(NULL);

DO $$
BEGIN
    -- This row is present in the full local research database and may not yet
    -- exist in every deployment that receives the schema migration.
    IF EXISTS (
        SELECT 1 FROM public.people
        WHERE id = '96c49dbf-21a1-467d-8acf-2e5f3b9a933f'::UUID
    ) AND NOT EXISTS (
        SELECT 1
        FROM public.public_people_list
        WHERE person_id = '96c49dbf-21a1-467d-8acf-2e5f3b9a933f'::UUID
          AND position IS NULL
          AND current_office_label IS NULL
          AND upcoming_candidate_label = '臺北市市長'
          AND list_status = 'candidate'
    ) THEN
        RAISE EXCEPTION 'Candidate office is still projected as Guo Xi current position';
    END IF;
END;
$$;

COMMIT;
