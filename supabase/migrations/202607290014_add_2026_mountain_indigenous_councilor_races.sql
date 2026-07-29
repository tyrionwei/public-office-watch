DO $$
DECLARE
    target_election_id UUID;
    changhua_region_id UUID;
    hsinchu_city_region_id UUID;
BEGIN
    SELECT id
    INTO target_election_id
    FROM public.elections
    WHERE external_id = 'planned-2026-local-public-officials';

    IF target_election_id IS NULL THEN
        RAISE EXCEPTION 'Missing planned 2026 local election';
    END IF;

    SELECT id
    INTO changhua_region_id
    FROM public.regions
    WHERE external_id = 'tw-county-10007'
      AND region_type = 'county';

    SELECT id
    INTO hsinchu_city_region_id
    FROM public.regions
    WHERE external_id = 'tw-county-10018'
      AND region_type = 'city';

    IF changhua_region_id IS NULL THEN
        RAISE EXCEPTION 'Missing Changhua County region';
    END IF;

    IF hsinchu_city_region_id IS NULL THEN
        RAISE EXCEPTION 'Missing Hsinchu City region';
    END IF;

    INSERT INTO public.races (
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
    VALUES
        (
            'planned-2026-local-cec-changhua-councilor-10-mountain-indigenous',
            target_election_id,
            changhua_region_id,
            'county_councilor',
            '彰化縣第10選舉區山地原住民議員選舉',
            DATE '2026-11-28',
            'announced',
            '彰化縣選舉委員會第457次委員會議紀錄',
            'https://web.cec.gov.tw/api/file/d48c63dd-4ec0-4f5f-89d8-1e5b1f615f8a.pdf',
            TRUE,
            NOW()
        ),
        (
            'planned-2026-local-cec-hsinchu-city-councilor-7-mountain-indigenous',
            target_election_id,
            hsinchu_city_region_id,
            'city_councilor',
            '新竹市第7選舉區山地原住民議員選舉',
            DATE '2026-11-28',
            'announced',
            '新竹市選舉委員會第319次會議紀錄',
            'https://web.cec.gov.tw/api/file/023ea469-045c-4653-b7c7-9489824ce757.pdf',
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
