CREATE MATERIALIZED VIEW public_people_list_cached AS
SELECT *
FROM public_people_list
WITH DATA;

CREATE UNIQUE INDEX public_people_list_cached_person_id_idx
    ON public_people_list_cached (person_id);

CREATE INDEX public_people_list_cached_party_status_idx
    ON public_people_list_cached (
        party,
        list_status,
        list_is_grassroots,
        list_status_order,
        list_role_order,
        name
    );

CREATE INDEX public_people_list_cached_filters_idx
    ON public_people_list_cached (
        list_is_grassroots,
        list_status,
        list_role,
        list_status_order,
        list_role_order,
        name
    );

CREATE OR REPLACE FUNCTION refresh_public_people_list_cached()
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
    REFRESH MATERIALIZED VIEW public_people_list_cached;
$$;

REVOKE ALL ON public_people_list_cached FROM PUBLIC;
GRANT SELECT ON public_people_list_cached TO anon, authenticated;

REVOKE ALL ON FUNCTION refresh_public_people_list_cached() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_public_people_list_cached() TO service_role;

COMMENT ON MATERIALIZED VIEW public_people_list_cached IS
    'Indexed public people projection refreshed after canonical data syncs.';

COMMENT ON FUNCTION refresh_public_people_list_cached() IS
    'Refreshes the indexed public people projection after trusted data writes.';
