BEGIN;

CREATE TEMP TABLE _chat_channel_data (
    event_year INTEGER NOT NULL,
    family TEXT NOT NULL CHECK (family IN ('election', 'referendum')),
    room_key TEXT NOT NULL,
    entity_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    display_order INTEGER NOT NULL,
    PRIMARY KEY (event_year, family)
) ON COMMIT DROP;

INSERT INTO _chat_channel_data (
    event_year,
    family,
    room_key,
    entity_key,
    display_name,
    display_order
)
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
annual_elections AS (
    SELECT
        event_year,
        pg_catalog.bool_or(election_type IN ('presidential', 'president')) AS has_president,
        pg_catalog.bool_or(election_type IN ('legislative', 'legislator')) AS has_legislator,
        pg_catalog.bool_or(election_type IN (
            'local', 'local_chief', 'councilor',
            'township_representative', 'village_chief'
        )) AS has_local,
        pg_catalog.bool_or(
            COALESCE(election_type, '') NOT IN (
                'presidential', 'president', 'legislative', 'legislator',
                'local', 'local_chief', 'councilor',
                'township_representative', 'village_chief',
                'referendum', 'recall', 'by_election'
            )
        ) AS has_other
    FROM classified
    WHERE event_year IS NOT NULL
      AND COALESCE(election_type, '') NOT IN (
          'referendum', 'recall', 'by_election'
      )
    GROUP BY event_year
),
annual_referendums AS (
    SELECT DISTINCT event_year
    FROM classified
    WHERE event_year IS NOT NULL
      AND election_type = 'referendum'
)
SELECT
    annual.event_year,
    'election',
    'event:' || annual.event_year::TEXT || ':election',
    annual.event_year::TEXT || ':election',
    annual.event_year::TEXT || ' ' || pg_catalog.concat_ws(
        '+',
        CASE
            WHEN annual.has_president AND annual.has_legislator
            THEN '總統副總統及立法委員選舉'
            WHEN annual.has_president
            THEN '總統副總統選舉'
            WHEN annual.has_legislator
            THEN '立法委員選舉'
        END,
        CASE WHEN annual.has_local THEN '地方公職人員選舉' END,
        CASE WHEN annual.has_other THEN '其他選舉' END
    ),
    20
FROM annual_elections AS annual
UNION ALL
SELECT
    annual.event_year,
    'referendum',
    'event:' || annual.event_year::TEXT || ':referendum',
    annual.event_year::TEXT || ':referendum',
    annual.event_year::TEXT || ' 公民投票',
    21
FROM annual_referendums AS annual;

UPDATE public.chat_rooms AS room
SET
    room_key = channel.room_key,
    entity_key = channel.entity_key,
    display_name = channel.display_name,
    display_order = channel.display_order,
    status = 'active',
    updated_at = pg_catalog.now()
FROM _chat_channel_data AS channel
WHERE room.room_type = 'election_event'
  AND room.room_key = 'event:' || channel.event_year::TEXT
  AND channel.family = (
      SELECT preferred.family
      FROM _chat_channel_data AS preferred
      WHERE preferred.event_year = channel.event_year
      ORDER BY preferred.display_order
      LIMIT 1
  );

INSERT INTO public.chat_rooms (
    room_key,
    room_type,
    entity_key,
    display_name,
    status,
    display_order
)
SELECT
    channel.room_key,
    'election_event',
    channel.entity_key,
    channel.display_name,
    'active',
    channel.display_order
FROM _chat_channel_data AS channel
ON CONFLICT (room_key) DO UPDATE
SET
    room_type = EXCLUDED.room_type,
    entity_key = EXCLUDED.entity_key,
    display_name = EXCLUDED.display_name,
    status = EXCLUDED.status,
    display_order = EXCLUDED.display_order,
    updated_at = pg_catalog.now();

DELETE FROM public.chat_room_elections AS mapping
USING public.chat_rooms AS room
JOIN _chat_channel_data AS channel
  ON channel.room_key = room.room_key
WHERE mapping.room_id = room.id;

INSERT INTO public.chat_room_elections (room_id, election_id)
SELECT
    room.id,
    election.id
FROM public.elections AS election
JOIN _chat_channel_data AS channel
  ON channel.event_year = COALESCE(
      EXTRACT(YEAR FROM election.voting_date)::INTEGER,
      election.year
  )
 AND channel.family = CASE
     WHEN election.election_type = 'referendum' THEN 'referendum'
     WHEN election.election_type IN ('recall', 'by_election') THEN NULL
     ELSE 'election'
 END
JOIN public.chat_rooms AS room
  ON room.room_key = channel.room_key
WHERE election.is_public = TRUE
ON CONFLICT (room_id, election_id) DO NOTHING;

UPDATE public.chat_rooms AS room
SET
    status = 'archived',
    updated_at = pg_catalog.now()
WHERE room.room_type = 'election_event'
  AND room.room_key ~ '^event:[0-9]{4}$'
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
           AND room.entity_key LIKE pg_catalog.substring(
               p_event_key, '^([0-9]{4})'
           ) || ':%'
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
        SELECT room.entity_key
        FROM public.chat_rooms AS room
        WHERE room.status = 'active'
          AND room.room_type = 'election_event'
        GROUP BY room.entity_key
        HAVING pg_catalog.count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Chat rooms must be unique per year and channel family';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.chat_rooms AS room
        WHERE room.status = 'active'
          AND room.room_type = 'election_event'
          AND room.entity_key !~ '^[0-9]{4}:(election|referendum)$'
    ) THEN
        RAISE EXCEPTION 'Election chat room keys must identify an election or referendum family';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.chat_room_elections AS mapping
        JOIN public.chat_rooms AS room ON room.id = mapping.room_id
        JOIN public.elections AS election ON election.id = mapping.election_id
        WHERE room.status = 'active'
          AND room.room_type = 'election_event'
          AND (
              (
                  room.entity_key LIKE '%:referendum'
                  AND election.election_type <> 'referendum'
              )
              OR (
                  room.entity_key LIKE '%:election'
                  AND election.election_type IN ('referendum', 'recall', 'by_election')
              )
          )
    ) THEN
        RAISE EXCEPTION 'Chat room election mappings must match their channel family';
    END IF;
END;
$$;

COMMIT;
