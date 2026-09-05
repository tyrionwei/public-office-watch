BEGIN;
CREATE TABLE public.polling_place_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key TEXT NOT NULL,
    voting_date DATE NOT NULL,
    county_code TEXT NOT NULL CHECK (county_code ~ '^[0-9]{5}$'),
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL CHECK (source_url ~ '^https://'),
    published_on DATE,
    fetched_at TIMESTAMPTZ NOT NULL,
    source_hash TEXT NOT NULL CHECK (source_hash ~ '^[a-f0-9]{64}$'),
    format TEXT NOT NULL CHECK (format IN ('ods','csv','xls','xlsx','html','pdf')),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(event_key, county_code, source_hash)
);
CREATE UNIQUE INDEX polling_place_sources_current_idx
    ON public.polling_place_sources(event_key, county_code) WHERE is_current;
CREATE TABLE public.polling_places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES public.polling_place_sources(id) ON DELETE CASCADE,
    district_code TEXT NOT NULL CHECK (district_code ~ '^[0-9]{8}$'),
    village_code TEXT NOT NULL CHECK (village_code ~ '^[0-9]{11}$'),
    village_name TEXT NOT NULL,
    station_no TEXT NOT NULL,
    station_name TEXT NOT NULL,
    address TEXT NOT NULL,
    coverage_kind TEXT NOT NULL CHECK (coverage_kind IN ('neighborhoods','whole_village','unpartitioned','ambiguous')),
    raw_neighborhoods TEXT NOT NULL,
    source_row INTEGER NOT NULL,
    UNIQUE(source_id, station_no, village_code)
);
CREATE INDEX polling_places_village_idx ON public.polling_places(village_code, source_id);
CREATE TABLE public.polling_place_neighborhoods (
    polling_place_id UUID NOT NULL REFERENCES public.polling_places(id) ON DELETE CASCADE,
    neighborhood_no SMALLINT NOT NULL CHECK (neighborhood_no BETWEEN 1 AND 999),
    PRIMARY KEY(polling_place_id, neighborhood_no)
);
ALTER TABLE public.polling_place_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polling_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polling_place_neighborhoods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.polling_place_sources, public.polling_places, public.polling_place_neighborhoods FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.polling_place_sources, public.polling_places, public.polling_place_neighborhoods TO service_role, admin_role;
CREATE POLICY polling_sources_admin ON public.polling_place_sources TO admin_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY polling_places_admin ON public.polling_places TO admin_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY polling_neighborhoods_admin ON public.polling_place_neighborhoods TO admin_role USING (TRUE) WITH CHECK (TRUE);

-- Bounded public projection of the explicitly published, current official source.
-- Neighborhood selection happens in the browser; there is no neighborhood argument.
CREATE FUNCTION published.polling_places_for_village(p_event_key TEXT, p_village_code TEXT)
RETURNS TABLE (
    id UUID, voting_date DATE, village_code TEXT, village_name TEXT,
    station_no TEXT, station_name TEXT, address TEXT, coverage_kind TEXT,
    raw_neighborhoods TEXT, neighborhoods SMALLINT[],
    source_name TEXT, source_url TEXT, source_published_on DATE
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
    SELECT place.id, source.voting_date, place.village_code, place.village_name,
        place.station_no, place.station_name, place.address, place.coverage_kind,
        place.raw_neighborhoods, ARRAY(
            SELECT neighborhood.neighborhood_no FROM public.polling_place_neighborhoods neighborhood
            WHERE neighborhood.polling_place_id = place.id ORDER BY neighborhood.neighborhood_no
        ), source.source_name, source.source_url, source.published_on
    FROM public.polling_places place
    JOIN public.polling_place_sources source ON source.id = place.source_id
    WHERE place.village_code = p_village_code AND p_village_code ~ '^[0-9]{11}$'
      AND source.event_key = p_event_key AND source.is_public AND source.is_current
    ORDER BY place.station_no, place.id
    LIMIT 101;
$function$;
REVOKE ALL ON FUNCTION published.polling_places_for_village(TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION published.polling_places_for_village(TEXT,TEXT) TO anon, authenticated, service_role, admin_role;
COMMENT ON TABLE public.polling_places IS 'One official station-to-village assignment per source; one station may serve multiple villages.';
NOTIFY pgrst, 'reload schema';
COMMIT;
