BEGIN;

CREATE TEMP TABLE _annual_chat_room_data (
    event_year INTEGER PRIMARY KEY,
    display_name TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _annual_chat_room_data (event_year, display_name)
WITH classified AS (
    SELECT
        COALESCE(
            EXTRACT(YEAR FROM election.voting_date)::INTEGER,
            election.year
        ) AS event_year,
        election.election_type
    FROM public.elections AS election
    WHERE election.is_public = TRUE
),
annual AS (
    SELECT
        event_year,
        pg_catalog.bool_or(election_type IN ('presidential', 'president')) AS has_president,
        pg_catalog.bool_or(election_type IN ('legislative', 'legislator')) AS has_legislator,
        pg_catalog.bool_or(election_type IN (
            'local', 'local_chief', 'councilor',
            'township_representative', 'village_chief'
        )) AS has_local,
        pg_catalog.bool_or(election_type = 'referendum') AS has_referendum,
        pg_catalog.bool_or(election_type = 'recall') AS has_recall,
        pg_catalog.bool_or(election_type = 'by_election') AS has_by_election,
        pg_catalog.bool_or(election_type NOT IN (
            'presidential', 'president', 'legislative', 'legislator',
            'local', 'local_chief', 'councilor',
            'township_representative', 'village_chief',
            'referendum', 'recall', 'by_election'
        )) AS has_other
    FROM classified
    WHERE event_year IS NOT NULL
    GROUP BY event_year
)
SELECT
    event_year,
    event_year::TEXT || ' ' || pg_catalog.concat_ws(
        '+',
        CASE
            WHEN has_president AND has_legislator
            THEN '總統副總統及立法委員選舉'
            WHEN has_president
            THEN '總統副總統選舉'
            WHEN has_legislator
            THEN '立法委員選舉'
        END,
        CASE WHEN has_local THEN '地方公職人員選舉' END,
        CASE WHEN has_referendum THEN '公民投票' END,
        CASE WHEN has_recall THEN '罷免投票' END,
        CASE WHEN has_by_election THEN '補選' END,
        CASE WHEN has_other THEN '其他選舉' END
    )
FROM annual;

INSERT INTO public.chat_rooms (
    room_key,
    room_type,
    entity_key,
    display_name,
    status,
    display_order
)
SELECT
    'event:' || annual.event_year::TEXT,
    'election_event',
    annual.event_year::TEXT,
    annual.display_name,
    'active',
    20
FROM _annual_chat_room_data AS annual
ON CONFLICT (room_key) DO UPDATE
SET
    room_type = EXCLUDED.room_type,
    entity_key = EXCLUDED.entity_key,
    display_name = EXCLUDED.display_name,
    status = EXCLUDED.status,
    display_order = EXCLUDED.display_order,
    updated_at = pg_catalog.now();

INSERT INTO public.chat_room_elections (room_id, election_id)
SELECT DISTINCT
    annual_room.id,
    mapping.election_id
FROM public.chat_room_elections AS mapping
JOIN public.chat_rooms AS source_room
  ON source_room.id = mapping.room_id
 AND source_room.room_type = 'election_event'
JOIN _annual_chat_room_data AS annual
  ON annual.event_year = pg_catalog.substring(
      source_room.entity_key, '^([0-9]{4})'
  )::INTEGER
JOIN public.chat_rooms AS annual_room
  ON annual_room.room_key = 'event:' || annual.event_year::TEXT
ON CONFLICT (room_id, election_id) DO NOTHING;

INSERT INTO public.chat_room_elections (room_id, election_id)
SELECT
    annual_room.id,
    election.id
FROM public.elections AS election
JOIN _annual_chat_room_data AS annual
  ON annual.event_year = COALESCE(
      EXTRACT(YEAR FROM election.voting_date)::INTEGER,
      election.year
  )
JOIN public.chat_rooms AS annual_room
  ON annual_room.room_key = 'event:' || annual.event_year::TEXT
WHERE election.is_public = TRUE
ON CONFLICT (room_id, election_id) DO NOTHING;

UPDATE public.chat_messages AS message
SET room_id = annual_room.id
FROM public.chat_rooms AS source_room
JOIN _annual_chat_room_data AS annual
  ON annual.event_year = pg_catalog.substring(
      source_room.entity_key, '^([0-9]{4})'
  )::INTEGER
JOIN public.chat_rooms AS annual_room
  ON annual_room.room_key = 'event:' || annual.event_year::TEXT
WHERE source_room.room_type = 'election_event'
  AND source_room.id <> annual_room.id
  AND message.room_id = source_room.id;

DELETE FROM public.chat_rooms AS source_room
USING _annual_chat_room_data AS annual
WHERE source_room.room_type = 'election_event'
  AND annual.event_year = pg_catalog.substring(
      source_room.entity_key, '^([0-9]{4})'
  )::INTEGER
  AND source_room.room_key <> 'event:' || annual.event_year::TEXT;


UPDATE public.chat_rooms AS room
SET
    display_order = region.display_order,
    updated_at = pg_catalog.now()
FROM public.regions AS region
WHERE room.room_type = 'region'
  AND room.region_id = region.id
  AND region.display_order IS NOT NULL
  AND room.display_order IS DISTINCT FROM region.display_order;

UPDATE public.chat_rooms AS room
SET
    status = 'archived',
    updated_at = pg_catalog.now()
FROM public.regions AS region
WHERE room.room_type = 'region'
  AND room.region_id = region.id
  AND region.slug LIKE 'historical-%'
  AND room.status <> 'archived';

CREATE OR REPLACE FUNCTION public.get_public_chat_rooms(
    p_region_id UUID DEFAULT NULL,
    p_event_key TEXT DEFAULT NULL,
    p_election_id UUID DEFAULT NULL
)
RETURNS SETOF public.public_chat_rooms
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT room.*
    FROM public.public_chat_rooms AS room
    WHERE room.room_type = 'global'
       OR (room.room_type = 'region' AND room.region_id = p_region_id)
       OR (
           room.room_type = 'election_event'
           AND p_event_key IS NOT NULL
           AND room.entity_key = pg_catalog.substring(
               p_event_key, '^([0-9]{4})'
           )
       )
       OR (
           room.room_type = 'election_event'
           AND EXISTS (
               SELECT 1
               FROM public.chat_room_elections AS mapping
               WHERE mapping.room_id = room.id
                 AND mapping.election_id = p_election_id
           )
       )
    ORDER BY
        CASE room.room_type WHEN 'global' THEN 0 WHEN 'region' THEN 1 ELSE 2 END,
        room.display_order,
        room.display_name,
        room.id;
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.chat_rooms AS room
        JOIN public.regions AS region ON region.id = room.region_id
        WHERE room.status = 'active'
          AND region.slug LIKE 'historical-%'
    ) THEN
        RAISE EXCEPTION 'Historical region chat rooms must not remain active';
    END IF;

    IF EXISTS (
        SELECT room.entity_key
        FROM public.chat_rooms AS room
        WHERE room.status = 'active'
          AND room.room_type = 'election_event'
        GROUP BY room.entity_key
        HAVING pg_catalog.count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Election chat rooms must be unique per year';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.chat_rooms AS room
        WHERE room.status = 'active'
          AND room.room_type = 'election_event'
          AND room.entity_key !~ '^[0-9]{4}$'
    ) THEN
        RAISE EXCEPTION 'Election chat room keys must use a four-digit year';
    END IF;
END;
$$;

COMMIT;
