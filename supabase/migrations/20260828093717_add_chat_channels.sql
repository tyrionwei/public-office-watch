BEGIN;

CREATE TABLE public.chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_key TEXT NOT NULL UNIQUE CHECK (room_key ~ '^[a-z0-9][a-z0-9:_-]{0,159}$'),
    room_type TEXT NOT NULL CHECK (room_type IN ('global', 'region', 'election_event')),
    entity_key TEXT,
    display_name TEXT NOT NULL CHECK (
        pg_catalog.char_length(display_name) BETWEEN 1 AND 80
        AND display_name = pg_catalog.btrim(display_name)
    ),
    region_id UUID REFERENCES public.regions(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CHECK (
        (room_type = 'global' AND entity_key IS NULL AND region_id IS NULL)
        OR (room_type = 'region' AND entity_key IS NOT NULL AND region_id IS NOT NULL)
        OR (room_type = 'election_event' AND entity_key IS NOT NULL AND region_id IS NULL)
    )
);

CREATE TABLE public.chat_room_elections (
    room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    PRIMARY KEY (room_id, election_id)
);

CREATE INDEX chat_rooms_region_idx
    ON public.chat_rooms (region_id)
    WHERE status = 'active';
CREATE INDEX chat_rooms_type_entity_idx
    ON public.chat_rooms (room_type, entity_key)
    WHERE status = 'active';
CREATE INDEX chat_room_elections_election_idx
    ON public.chat_room_elections (election_id, room_id);

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_room_elections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can read active chat rooms"
ON public.chat_rooms
FOR SELECT
TO anon, authenticated
USING (status = 'active');

REVOKE ALL ON TABLE public.chat_rooms
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.chat_room_elections
FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.chat_rooms TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_rooms TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_room_elections TO service_role;

INSERT INTO public.chat_rooms (
    id, room_key, room_type, display_name, display_order
)
VALUES (
    '00000000-0000-4000-8000-000000000001',
    'global',
    'global',
    '全站大廳',
    0
);

INSERT INTO public.chat_rooms (
    room_key, room_type, entity_key, display_name, region_id, display_order
)
SELECT
    'region:' || region.id::TEXT,
    'region',
    region.id::TEXT,
    region.name,
    region.id,
    10
FROM public.regions AS region
WHERE region.is_public = TRUE
  AND region.region_type IN ('municipality', 'county', 'city')
ON CONFLICT (room_key) DO NOTHING;

WITH classified AS (
    SELECT
        election.id,
        election.name,
        COALESCE(EXTRACT(YEAR FROM election.voting_date)::INTEGER, election.year) AS event_year,
        election.voting_date,
        election.election_type,
        CASE
            WHEN election.election_type IN ('presidential', 'president', 'legislative', 'legislator')
            THEN 'national'
            WHEN election.election_type IN (
                'local', 'local_chief', 'councilor',
                'township_representative', 'village_chief'
            )
            THEN 'local'
            WHEN election.election_type = 'referendum' THEN 'referendum'
            WHEN election.election_type = 'recall' THEN 'recall'
            WHEN election.election_type = 'by_election' THEN 'by_election'
            ELSE 'other'
        END AS event_family
    FROM public.elections AS election
    WHERE election.is_public = TRUE
),
events AS (
    SELECT
        COALESCE(event_year::TEXT, 'unknown')
            || '-' || COALESCE(voting_date::TEXT, 'undated')
            || '-' || event_family AS event_key,
        event_year,
        event_family,
        pg_catalog.bool_or(election_type IN ('presidential', 'president')) AS has_president,
        pg_catalog.bool_or(election_type IN ('legislative', 'legislator')) AS has_legislator,
        pg_catalog.min(name) AS fallback_name
    FROM classified
    GROUP BY event_year, voting_date, event_family
)
INSERT INTO public.chat_rooms (
    room_key, room_type, entity_key, display_name, display_order
)
SELECT
    'event:' || event.event_key,
    'election_event',
    event.event_key,
    CASE
        WHEN event.event_family = 'national' AND event.has_president AND event.has_legislator
        THEN event.event_year::TEXT || ' 總統副總統及立法委員選舉'
        WHEN event.event_family = 'national' AND event.has_president
        THEN event.event_year::TEXT || ' 總統副總統選舉'
        WHEN event.event_family = 'national'
        THEN event.event_year::TEXT || ' 立法委員選舉'
        WHEN event.event_family = 'local'
        THEN event.event_year::TEXT || ' 地方公職人員選舉'
        WHEN event.event_family = 'referendum'
        THEN event.event_year::TEXT || ' 公民投票'
        WHEN event.event_family = 'recall'
        THEN event.event_year::TEXT || ' 罷免投票'
        WHEN event.event_family = 'by_election'
        THEN event.event_year::TEXT || ' 補選'
        ELSE event.fallback_name
    END,
    20
FROM events AS event
ON CONFLICT (room_key) DO NOTHING;

WITH classified AS (
    SELECT
        election.id,
        COALESCE(EXTRACT(YEAR FROM election.voting_date)::INTEGER, election.year) AS event_year,
        election.voting_date,
        CASE
            WHEN election.election_type IN ('presidential', 'president', 'legislative', 'legislator')
            THEN 'national'
            WHEN election.election_type IN (
                'local', 'local_chief', 'councilor',
                'township_representative', 'village_chief'
            )
            THEN 'local'
            WHEN election.election_type = 'referendum' THEN 'referendum'
            WHEN election.election_type = 'recall' THEN 'recall'
            WHEN election.election_type = 'by_election' THEN 'by_election'
            ELSE 'other'
        END AS event_family
    FROM public.elections AS election
    WHERE election.is_public = TRUE
)
INSERT INTO public.chat_room_elections (room_id, election_id)
SELECT room.id, election.id
FROM classified AS election
JOIN public.chat_rooms AS room
  ON room.room_type = 'election_event'
 AND room.entity_key = COALESCE(election.event_year::TEXT, 'unknown')
    || '-' || COALESCE(election.voting_date::TEXT, 'undated')
    || '-' || election.event_family
ON CONFLICT (room_id, election_id) DO NOTHING;

ALTER TABLE public.chat_messages
ADD COLUMN room_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'
    REFERENCES public.chat_rooms(id) ON DELETE RESTRICT,
ADD COLUMN topic_tag TEXT CHECK (
    topic_tag IS NULL
    OR topic_tag IN (
        'transport', 'housing', 'education', 'healthcare',
        'environment', 'safety', 'other'
    )
);

CREATE INDEX chat_messages_room_cursor_idx
    ON public.chat_messages (room_id, created_at DESC, id DESC);

CREATE VIEW public.public_chat_rooms
WITH (security_barrier = TRUE, security_invoker = TRUE) AS
SELECT
    room.id,
    room.room_key,
    room.room_type,
    room.entity_key,
    room.display_name,
    room.region_id,
    room.display_order
FROM public.chat_rooms AS room
WHERE room.status = 'active';

REVOKE ALL ON TABLE public.public_chat_rooms
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.public_chat_rooms TO anon, authenticated;

CREATE OR REPLACE VIEW public.public_chat_messages
WITH (security_barrier = TRUE) AS
SELECT
    message.id,
    message.display_name_snapshot,
    message.public_code_snapshot,
    CASE
        WHEN message.moderation_status <> 'visible' THEN NULL
        WHEN author.status = 'banned' THEN NULL
        WHEN author.status = 'muted'
             AND (author.muted_until IS NULL OR author.muted_until > pg_catalog.now()) THEN NULL
        ELSE message.body
    END AS body,
    message.reply_to_message_id,
    CASE
        WHEN message.reply_to_message_id IS NULL THEN NULL
        WHEN replied.moderation_status <> 'visible' THEN 'removed'
        WHEN replied_author.status = 'banned' THEN 'removed'
        WHEN replied_author.status = 'muted'
             AND (replied_author.muted_until IS NULL OR replied_author.muted_until > pg_catalog.now()) THEN 'removed'
        ELSE 'available'
    END AS reply_state,
    CASE
        WHEN replied.moderation_status = 'visible'
             AND replied_author.status <> 'banned'
             AND NOT (
                 replied_author.status = 'muted'
                 AND (replied_author.muted_until IS NULL OR replied_author.muted_until > pg_catalog.now())
             )
        THEN message.reply_to_display_name_snapshot
        ELSE NULL
    END AS reply_to_display_name_snapshot,
    CASE
        WHEN replied.moderation_status = 'visible'
             AND replied_author.status <> 'banned'
             AND NOT (
                 replied_author.status = 'muted'
                 AND (replied_author.muted_until IS NULL OR replied_author.muted_until > pg_catalog.now())
             )
        THEN message.reply_to_public_code_snapshot
        ELSE NULL
    END AS reply_to_public_code_snapshot,
    CASE
        WHEN replied.moderation_status = 'visible'
             AND replied_author.status <> 'banned'
             AND NOT (
                 replied_author.status = 'muted'
                 AND (replied_author.muted_until IS NULL OR replied_author.muted_until > pg_catalog.now())
             )
        THEN message.reply_to_body_snapshot
        ELSE NULL
    END AS reply_to_body_snapshot,
    message.created_at,
    CASE
        WHEN message.moderation_status <> 'visible' THEN 'removed'
        WHEN author.status = 'banned' THEN 'author_banned'
        WHEN author.status = 'muted'
             AND (author.muted_until IS NULL OR author.muted_until > pg_catalog.now()) THEN 'author_muted'
        ELSE 'visible'
    END AS visibility_state,
    CASE
        WHEN author.status = 'muted'
             AND (author.muted_until IS NULL OR author.muted_until > pg_catalog.now())
        THEN author.muted_until
        ELSE NULL
    END AS visibility_until,
    message.room_id,
    message.topic_tag,
    room.room_key,
    room.room_type,
    room.display_name AS room_display_name
FROM public.chat_messages AS message
JOIN public.chat_rooms AS room
  ON room.id = message.room_id
 AND room.status = 'active'
CROSS JOIN public.chat_settings AS settings
JOIN public.chat_profiles AS author ON author.user_id = message.user_id
LEFT JOIN public.chat_messages AS replied ON replied.id = message.reply_to_message_id
LEFT JOIN public.chat_profiles AS replied_author ON replied_author.user_id = replied.user_id
WHERE settings.id = 1
  AND settings.is_enabled = TRUE;

CREATE OR REPLACE FUNCTION public.get_public_chat_messages(
    p_before_created_at TIMESTAMPTZ DEFAULT NULL,
    p_before_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS SETOF public.public_chat_messages
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT message.*
    FROM public.public_chat_messages AS message
    WHERE message.room_id = '00000000-0000-4000-8000-000000000001'
      AND (
          p_before_created_at IS NULL
          OR (message.created_at, message.id) < (p_before_created_at, p_before_id)
      )
    ORDER BY message.created_at DESC, message.id DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 50);
$$;

CREATE FUNCTION public.get_public_chat_messages(
    p_room_id UUID,
    p_before_created_at TIMESTAMPTZ DEFAULT NULL,
    p_before_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_topic_tag TEXT DEFAULT NULL
)
RETURNS SETOF public.public_chat_messages
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT message.*
    FROM public.public_chat_messages AS message
    WHERE (
            p_room_id = '00000000-0000-4000-8000-000000000001'
            OR message.room_id = p_room_id
          )
      AND (p_topic_tag IS NULL OR message.topic_tag = p_topic_tag)
      AND (
          p_before_created_at IS NULL
          OR (message.created_at, message.id) < (p_before_created_at, p_before_id)
      )
    ORDER BY message.created_at DESC, message.id DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 50);
$$;

CREATE FUNCTION public.get_public_chat_rooms(
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
       OR (room.room_type = 'election_event' AND room.entity_key = p_event_key)
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

CREATE FUNCTION published.chat_messages(
    p_room_id UUID,
    p_before_created_at TIMESTAMPTZ DEFAULT NULL,
    p_before_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_topic_tag TEXT DEFAULT NULL
)
RETURNS SETOF public.public_chat_messages
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT message.*
    FROM public.get_public_chat_messages(
        p_room_id,
        p_before_created_at,
        p_before_id,
        LEAST(GREATEST(COALESCE(p_limit, 50), 1), 50),
        p_topic_tag
    ) AS message;
$$;

CREATE FUNCTION published.chat_rooms(
    p_region_id UUID DEFAULT NULL,
    p_event_key TEXT DEFAULT NULL,
    p_election_id UUID DEFAULT NULL
)
RETURNS SETOF public.public_chat_rooms
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT room.*
    FROM public.get_public_chat_rooms(p_region_id, p_event_key, p_election_id) AS room;
$$;

CREATE FUNCTION published.chat_room_directory()
RETURNS SETOF public.public_chat_rooms
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT room.*
    FROM public.public_chat_rooms AS room
    ORDER BY
        CASE room.room_type WHEN 'global' THEN 0 WHEN 'region' THEN 1 ELSE 2 END,
        room.display_order,
        room.display_name,
        room.id;
$$;

REVOKE ALL ON FUNCTION public.get_public_chat_messages(UUID, TIMESTAMPTZ, UUID, INTEGER, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_chat_rooms(UUID, TEXT, UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION published.chat_messages(UUID, TIMESTAMPTZ, UUID, INTEGER, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION published.chat_rooms(UUID, TEXT, UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION published.chat_room_directory()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_public_chat_messages(UUID, TIMESTAMPTZ, UUID, INTEGER, TEXT)
TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_chat_rooms(UUID, TEXT, UUID)
TO service_role;
GRANT EXECUTE ON FUNCTION published.chat_messages(UUID, TIMESTAMPTZ, UUID, INTEGER, TEXT)
TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION published.chat_rooms(UUID, TEXT, UUID)
TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION published.chat_room_directory()
TO anon, authenticated, service_role;

CREATE FUNCTION public.create_chat_channel_message(
    p_user_id UUID,
    p_room_id UUID,
    p_topic_tag TEXT,
    p_body TEXT,
    p_reply_to_message_id UUID,
    p_ip_hmac TEXT,
    p_ip_ciphertext TEXT,
    p_encryption_key_version INTEGER,
    p_request_id TEXT,
    p_user_agent_hash TEXT
)
RETURNS TABLE (
    id UUID,
    display_name_snapshot TEXT,
    public_code_snapshot TEXT,
    body TEXT,
    reply_to_message_id UUID,
    reply_state TEXT,
    reply_to_display_name_snapshot TEXT,
    reply_to_public_code_snapshot TEXT,
    reply_to_body_snapshot TEXT,
    created_at TIMESTAMPTZ,
    room_id UUID,
    topic_tag TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    profile public.chat_profiles%ROWTYPE;
    room public.chat_rooms%ROWTYPE;
    replied public.chat_messages%ROWTYPE;
    inserted public.chat_messages%ROWTYPE;
    latest_message_at TIMESTAMPTZ;
    chat_enabled BOOLEAN;
    current_terms_version TEXT;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_UNAUTHENTICATED';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_user_id::TEXT, 0)
    );

    SELECT setting.is_enabled, setting.terms_version
    INTO chat_enabled, current_terms_version
    FROM public.chat_settings AS setting
    WHERE setting.id = 1;

    IF NOT COALESCE(chat_enabled, FALSE) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_DISABLED';
    END IF;

    SELECT candidate_room.*
    INTO room
    FROM public.chat_rooms AS candidate_room
    WHERE candidate_room.id = p_room_id
      AND candidate_room.status = 'active';

    IF room.id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_ROOM_UNAVAILABLE';
    END IF;

    IF p_topic_tag IS NOT NULL
       AND p_topic_tag NOT IN (
           'transport', 'housing', 'education', 'healthcare',
           'environment', 'safety', 'other'
       ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_INVALID_TOPIC';
    END IF;

    SELECT current_profile.*
    INTO profile
    FROM public.chat_profiles AS current_profile
    WHERE current_profile.user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_PROFILE_REQUIRED';
    END IF;

    IF profile.terms_version IS DISTINCT FROM current_terms_version
       OR profile.terms_accepted_at IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_TERMS_REQUIRED';
    END IF;
    IF profile.status = 'banned' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_BANNED';
    END IF;
    IF profile.status = 'muted'
       AND (profile.muted_until IS NULL OR profile.muted_until > pg_catalog.now()) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_MUTED';
    END IF;

    IF p_body IS NULL
       OR pg_catalog.char_length(p_body) NOT BETWEEN 1 AND 50
       OR p_body <> pg_catalog.btrim(p_body)
       OR p_body ~ E'[\r\n]' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_INVALID_BODY';
    END IF;

    SELECT message.created_at
    INTO latest_message_at
    FROM public.chat_messages AS message
    WHERE message.user_id = p_user_id
    ORDER BY message.created_at DESC
    LIMIT 1;

    IF latest_message_at > pg_catalog.now() - INTERVAL '8 seconds' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_COOLDOWN';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.chat_messages AS message
        WHERE message.user_id = p_user_id
          AND message.body = p_body
          AND message.created_at > pg_catalog.now() - INTERVAL '5 minutes'
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_DUPLICATE';
    END IF;

    IF p_reply_to_message_id IS NOT NULL THEN
        SELECT message.*
        INTO replied
        FROM public.chat_messages AS message
        WHERE message.id = p_reply_to_message_id
          AND message.moderation_status = 'visible';

        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_REPLY_UNAVAILABLE';
        END IF;
        IF replied.room_id <> p_room_id THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_REPLY_WRONG_ROOM';
        END IF;
    END IF;

    INSERT INTO public.chat_messages (
        user_id, display_name_snapshot, public_code_snapshot, body,
        reply_to_message_id, reply_to_display_name_snapshot,
        reply_to_public_code_snapshot, reply_to_body_snapshot,
        room_id, topic_tag
    )
    VALUES (
        p_user_id, profile.current_display_name, profile.public_code, p_body,
        p_reply_to_message_id,
        CASE WHEN p_reply_to_message_id IS NULL THEN NULL ELSE replied.display_name_snapshot END,
        CASE WHEN p_reply_to_message_id IS NULL THEN NULL ELSE replied.public_code_snapshot END,
        CASE WHEN p_reply_to_message_id IS NULL THEN NULL ELSE pg_catalog.left(replied.body, 20) END,
        p_room_id, p_topic_tag
    )
    RETURNING * INTO inserted;

    INSERT INTO public.chat_message_security_logs (
        message_id, user_id, ip_hmac, ip_ciphertext,
        encryption_key_version, request_id, user_agent_hash
    )
    VALUES (
        inserted.id, p_user_id, p_ip_hmac, p_ip_ciphertext,
        p_encryption_key_version, p_request_id, p_user_agent_hash
    );

    RETURN QUERY
    SELECT
        inserted.id,
        inserted.display_name_snapshot,
        inserted.public_code_snapshot,
        inserted.body,
        inserted.reply_to_message_id,
        CASE WHEN inserted.reply_to_message_id IS NULL THEN NULL ELSE 'available' END,
        inserted.reply_to_display_name_snapshot,
        inserted.reply_to_public_code_snapshot,
        inserted.reply_to_body_snapshot,
        inserted.created_at,
        inserted.room_id,
        inserted.topic_tag;
END;
$$;

REVOKE ALL ON FUNCTION public.create_chat_channel_message(
    UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT, INTEGER, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_chat_channel_message(
    UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT, INTEGER, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.broadcast_public_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    target_room public.chat_rooms%ROWTYPE;
    payload JSONB;
BEGIN
    SELECT room.*
    INTO target_room
    FROM public.chat_rooms AS room
    WHERE room.id = NEW.room_id;

    payload := pg_catalog.jsonb_build_object(
        'id', NEW.id,
        'display_name_snapshot', NEW.display_name_snapshot,
        'public_code_snapshot', NEW.public_code_snapshot,
        'body', NEW.body,
        'reply_to_message_id', NEW.reply_to_message_id,
        'reply_state', CASE WHEN NEW.reply_to_message_id IS NULL THEN NULL ELSE 'available' END,
        'reply_to_display_name_snapshot', NEW.reply_to_display_name_snapshot,
        'reply_to_public_code_snapshot', NEW.reply_to_public_code_snapshot,
        'reply_to_body_snapshot', NEW.reply_to_body_snapshot,
        'created_at', NEW.created_at,
        'visibility_state', 'visible',
        'visibility_until', NULL,
        'room_id', NEW.room_id,
        'topic_tag', NEW.topic_tag,
        'room_key', target_room.room_key,
        'room_type', target_room.room_type,
        'room_display_name', target_room.display_name
    );

    PERFORM realtime.send(payload, 'message_created', 'chat-room:' || target_room.room_key, TRUE);
    IF target_room.room_key <> 'global' THEN
        PERFORM realtime.send(payload, 'message_created', 'chat-room:global', TRUE);
    ELSE
        PERFORM realtime.send(payload, 'message_created', 'global-chat', TRUE);
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_chat_moderation_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    reply_visible BOOLEAN;
    target_room public.chat_rooms%ROWTYPE;
    payload JSONB;
BEGIN
    IF OLD.moderation_status IS NOT DISTINCT FROM NEW.moderation_status THEN
        RETURN NEW;
    END IF;

    SELECT room.*
    INTO target_room
    FROM public.chat_rooms AS room
    WHERE room.id = NEW.room_id;

    IF NEW.moderation_status <> 'visible' THEN
        payload := pg_catalog.jsonb_build_object('id', NEW.id);
        PERFORM realtime.send(payload, 'message_removed', 'chat-room:' || target_room.room_key, TRUE);
        IF target_room.room_key <> 'global' THEN
            PERFORM realtime.send(payload, 'message_removed', 'chat-room:global', TRUE);
        ELSE
            PERFORM realtime.send(payload, 'message_removed', 'global-chat', TRUE);
        END IF;
        RETURN NEW;
    END IF;

    SELECT replied.moderation_status = 'visible'
    INTO reply_visible
    FROM public.chat_messages AS replied
    WHERE replied.id = NEW.reply_to_message_id;

    payload := pg_catalog.jsonb_build_object(
        'id', NEW.id,
        'display_name_snapshot', NEW.display_name_snapshot,
        'public_code_snapshot', NEW.public_code_snapshot,
        'body', NEW.body,
        'reply_to_message_id', NEW.reply_to_message_id,
        'reply_state', CASE
            WHEN NEW.reply_to_message_id IS NULL THEN NULL
            WHEN reply_visible THEN 'available'
            ELSE 'removed'
        END,
        'reply_to_display_name_snapshot', CASE WHEN reply_visible THEN NEW.reply_to_display_name_snapshot ELSE NULL END,
        'reply_to_public_code_snapshot', CASE WHEN reply_visible THEN NEW.reply_to_public_code_snapshot ELSE NULL END,
        'reply_to_body_snapshot', CASE WHEN reply_visible THEN NEW.reply_to_body_snapshot ELSE NULL END,
        'created_at', NEW.created_at,
        'visibility_state', 'visible',
        'visibility_until', NULL,
        'room_id', NEW.room_id,
        'topic_tag', NEW.topic_tag,
        'room_key', target_room.room_key,
        'room_type', target_room.room_type,
        'room_display_name', target_room.display_name
    );

    PERFORM realtime.send(payload, 'message_created', 'chat-room:' || target_room.room_key, TRUE);
    IF target_room.room_key <> 'global' THEN
        PERFORM realtime.send(payload, 'message_created', 'chat-room:global', TRUE);
    ELSE
        PERFORM realtime.send(payload, 'message_created', 'global-chat', TRUE);
    END IF;
    RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "authenticated users can receive global chat broadcasts"
ON realtime.messages;
DROP POLICY IF EXISTS "anonymous users can receive global chat broadcasts"
ON realtime.messages;

CREATE POLICY "authenticated users can receive chat broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
    realtime.messages.extension = 'broadcast'
    AND (
        (SELECT realtime.topic()) = 'global-chat'
        OR EXISTS (
            SELECT 1
            FROM public.chat_rooms AS room
            WHERE room.status = 'active'
              AND (SELECT realtime.topic()) = 'chat-room:' || room.room_key
        )
    )
);

CREATE POLICY "anonymous users can receive chat broadcasts"
ON realtime.messages
FOR SELECT
TO anon
USING (
    realtime.messages.extension = 'broadcast'
    AND (
        (SELECT realtime.topic()) = 'global-chat'
        OR EXISTS (
            SELECT 1
            FROM public.chat_rooms AS room
            WHERE room.status = 'active'
              AND (SELECT realtime.topic()) = 'chat-room:' || room.room_key
        )
    )
);

COMMENT ON TABLE public.chat_rooms IS
    'Curated public chat channels. Contextual navigation is supplemented by a complete public directory.';
COMMENT ON TABLE public.chat_room_elections IS
    'Maps grouped election-event chat rooms to their source election records.';
COMMENT ON COLUMN public.chat_messages.topic_tag IS
    'Optional fixed public-issue tag; it is not a user-created room or forum topic.';
COMMENT ON FUNCTION public.create_chat_channel_message(
    UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT, INTEGER, TEXT, TEXT
) IS
    'Service-only atomic chat write path with room validation, global cooldown and same-room replies.';

NOTIFY pgrst, 'reload schema';

COMMIT;
