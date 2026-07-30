DO $$
DECLARE
    target_election_id UUID;
    chiayi_city_region_id UUID;
BEGIN
    SELECT id
    INTO target_election_id
    FROM public.elections
    WHERE external_id = 'planned-2026-local-public-officials';

    IF target_election_id IS NULL THEN
        RAISE EXCEPTION 'Missing planned 2026 local election';
    END IF;

    SELECT id
    INTO chiayi_city_region_id
    FROM public.regions
    WHERE external_id = 'tw-county-10020'
      AND region_type = 'city';

    IF chiayi_city_region_id IS NULL THEN
        RAISE EXCEPTION 'Missing Chiayi City region';
    END IF;

    INSERT INTO public.races (
        id,
        external_id,
        election_id,
        region_id,
        race_type,
        title,
        voting_date,
        status,
        source_name,
        source_url,
        is_public,
        updated_at
    )
    VALUES (
        '9599a0fa-812a-4170-9bde-01a2090f78af',
        'planned-2026-local-cec-chiayi-city-mayor-10020',
        target_election_id,
        chiayi_city_region_id,
        'county_mayor',
        '嘉義市市長選舉',
        DATE '2026-11-28',
        'announced',
        '中央選舉委員會：115年地方公職人員選舉時程',
        'https://www.cec.gov.tw/',
        TRUE,
        NOW()
    )
    ON CONFLICT (external_id) DO UPDATE
    SET election_id = EXCLUDED.election_id,
        region_id = EXCLUDED.region_id,
        race_type = EXCLUDED.race_type,
        title = EXCLUDED.title,
        voting_date = EXCLUDED.voting_date,
        status = EXCLUDED.status,
        source_name = EXCLUDED.source_name,
        source_url = EXCLUDED.source_url,
        is_public = EXCLUDED.is_public,
        updated_at = NOW();
END;
$$;
