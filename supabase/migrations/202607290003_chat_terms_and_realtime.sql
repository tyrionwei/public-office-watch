ALTER TABLE chat_settings
ADD COLUMN terms_version TEXT NOT NULL DEFAULT '2026-07-29-v1'
CHECK (terms_version = BTRIM(terms_version) AND CHAR_LENGTH(terms_version) BETWEEN 1 AND 40);

ALTER TABLE chat_profiles
ADD COLUMN terms_version TEXT,
ADD COLUMN terms_accepted_at TIMESTAMPTZ,
ADD CONSTRAINT chat_profiles_terms_acceptance_check CHECK (
    (terms_version IS NULL AND terms_accepted_at IS NULL)
    OR
    (
        terms_version IS NOT NULL
        AND terms_version = BTRIM(terms_version)
        AND CHAR_LENGTH(terms_version) BETWEEN 1 AND 40
        AND terms_accepted_at IS NOT NULL
    )
);

CREATE OR REPLACE VIEW public_chat_status WITH (security_barrier = true) AS
SELECT is_enabled, updated_at, terms_version
FROM chat_settings
WHERE id = 1;

DROP FUNCTION upsert_chat_profile(UUID, TEXT, TEXT);

CREATE FUNCTION upsert_chat_profile(
    p_user_id UUID,
    p_display_name TEXT,
    p_public_code TEXT,
    p_accept_terms BOOLEAN
)
RETURNS TABLE (
    user_id UUID,
    public_code TEXT,
    current_display_name TEXT,
    terms_version TEXT,
    terms_accepted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    current_terms_version TEXT;
    existing_terms_version TEXT;
    existing_terms_accepted_at TIMESTAMPTZ;
BEGIN
    IF p_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM auth.users account WHERE account.id = p_user_id
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_UNAUTHENTICATED';
    END IF;

    SELECT setting.terms_version
    INTO current_terms_version
    FROM chat_settings setting
    WHERE setting.id = 1;

    IF current_terms_version IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_TERMS_UNAVAILABLE';
    END IF;

    SELECT profile.terms_version, profile.terms_accepted_at
    INTO existing_terms_version, existing_terms_accepted_at
    FROM chat_profiles profile
    WHERE profile.user_id = p_user_id;

    IF (
        existing_terms_version IS DISTINCT FROM current_terms_version
        OR existing_terms_accepted_at IS NULL
    ) AND NOT COALESCE(p_accept_terms, FALSE) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_TERMS_REQUIRED';
    END IF;

    INSERT INTO chat_profiles AS profile (
        user_id,
        public_code,
        current_display_name,
        terms_version,
        terms_accepted_at
    )
    VALUES (
        p_user_id,
        p_public_code,
        p_display_name,
        current_terms_version,
        NOW()
    )
    ON CONFLICT ON CONSTRAINT chat_profiles_pkey DO UPDATE
    SET current_display_name = EXCLUDED.current_display_name,
        terms_version = CASE
            WHEN COALESCE(p_accept_terms, FALSE) THEN EXCLUDED.terms_version
            ELSE profile.terms_version
        END,
        terms_accepted_at = CASE
            WHEN COALESCE(p_accept_terms, FALSE) THEN EXCLUDED.terms_accepted_at
            ELSE profile.terms_accepted_at
        END,
        updated_at = NOW();

    RETURN QUERY
    SELECT
        profile.user_id,
        profile.public_code,
        profile.current_display_name,
        profile.terms_version,
        profile.terms_accepted_at,
        profile.updated_at
    FROM chat_profiles profile
    WHERE profile.user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION upsert_chat_profile(UUID, TEXT, TEXT, BOOLEAN)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_chat_profile(UUID, TEXT, TEXT, BOOLEAN)
TO service_role;

CREATE OR REPLACE FUNCTION create_chat_message(
    p_user_id UUID,
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
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    profile chat_profiles%ROWTYPE;
    replied chat_messages%ROWTYPE;
    inserted chat_messages%ROWTYPE;
    latest_message_at TIMESTAMPTZ;
    chat_enabled BOOLEAN;
    current_terms_version TEXT;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_UNAUTHENTICATED';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT, 0));

    SELECT setting.is_enabled, setting.terms_version
    INTO chat_enabled, current_terms_version
    FROM chat_settings setting
    WHERE setting.id = 1;

    IF NOT COALESCE(chat_enabled, FALSE) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_DISABLED';
    END IF;

    SELECT current_profile.*
    INTO profile
    FROM chat_profiles current_profile
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
       AND (profile.muted_until IS NULL OR profile.muted_until > NOW()) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_MUTED';
    END IF;

    IF p_body IS NULL
       OR CHAR_LENGTH(p_body) NOT BETWEEN 1 AND 50
       OR p_body <> BTRIM(p_body)
       OR POSITION(E'\n' IN p_body) > 0
       OR POSITION(E'\r' IN p_body) > 0 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_INVALID_BODY';
    END IF;

    SELECT message.created_at
    INTO latest_message_at
    FROM chat_messages message
    WHERE message.user_id = p_user_id
    ORDER BY message.created_at DESC
    LIMIT 1;

    IF latest_message_at > NOW() - INTERVAL '8 seconds' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_COOLDOWN';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM chat_messages message
        WHERE message.user_id = p_user_id
          AND message.body = p_body
          AND message.created_at > NOW() - INTERVAL '5 minutes'
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_DUPLICATE';
    END IF;

    IF p_reply_to_message_id IS NOT NULL THEN
        SELECT message.*
        INTO replied
        FROM chat_messages message
        WHERE message.id = p_reply_to_message_id
          AND message.moderation_status = 'visible';

        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_REPLY_UNAVAILABLE';
        END IF;
    END IF;

    INSERT INTO chat_messages (
        user_id,
        display_name_snapshot,
        public_code_snapshot,
        body,
        reply_to_message_id,
        reply_to_display_name_snapshot,
        reply_to_public_code_snapshot,
        reply_to_body_snapshot
    )
    VALUES (
        p_user_id,
        profile.current_display_name,
        profile.public_code,
        p_body,
        p_reply_to_message_id,
        CASE WHEN p_reply_to_message_id IS NULL THEN NULL ELSE replied.display_name_snapshot END,
        CASE WHEN p_reply_to_message_id IS NULL THEN NULL ELSE replied.public_code_snapshot END,
        CASE WHEN p_reply_to_message_id IS NULL THEN NULL ELSE LEFT(replied.body, 20) END
    )
    RETURNING * INTO inserted;

    INSERT INTO chat_message_security_logs (
        message_id, user_id, ip_hmac, ip_ciphertext,
        encryption_key_version, request_id, user_agent_hash
    )
    VALUES (
        inserted.id, p_user_id, p_ip_hmac, p_ip_ciphertext,
        p_encryption_key_version, p_request_id, p_user_agent_hash
    );

    RETURN QUERY SELECT
        inserted.id,
        inserted.display_name_snapshot,
        inserted.public_code_snapshot,
        inserted.body,
        inserted.reply_to_message_id,
        CASE WHEN inserted.reply_to_message_id IS NULL THEN NULL ELSE 'available' END,
        inserted.reply_to_display_name_snapshot,
        inserted.reply_to_public_code_snapshot,
        inserted.reply_to_body_snapshot,
        inserted.created_at;
END;
$$;

CREATE FUNCTION get_public_chat_messages(
    p_before_created_at TIMESTAMPTZ DEFAULT NULL,
    p_before_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS SETOF public_chat_messages
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT message.*
    FROM public_chat_messages message
    WHERE p_before_created_at IS NULL
       OR (message.created_at, message.id) < (p_before_created_at, p_before_id)
    ORDER BY message.created_at DESC, message.id DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 50);
$$;

REVOKE ALL ON FUNCTION get_public_chat_messages(TIMESTAMPTZ, UUID, INTEGER)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_public_chat_messages(TIMESTAMPTZ, UUID, INTEGER)
TO anon, authenticated;

CREATE FUNCTION broadcast_public_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM realtime.send(
        jsonb_build_object(
            'id', NEW.id,
            'display_name_snapshot', NEW.display_name_snapshot,
            'public_code_snapshot', NEW.public_code_snapshot,
            'body', NEW.body,
            'reply_to_message_id', NEW.reply_to_message_id,
            'reply_state', CASE WHEN NEW.reply_to_message_id IS NULL THEN NULL ELSE 'available' END,
            'reply_to_display_name_snapshot', NEW.reply_to_display_name_snapshot,
            'reply_to_public_code_snapshot', NEW.reply_to_public_code_snapshot,
            'reply_to_body_snapshot', NEW.reply_to_body_snapshot,
            'created_at', NEW.created_at
        ),
        'message_created',
        'global-chat',
        TRUE
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER chat_messages_broadcast_insert
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION broadcast_public_chat_message();

CREATE POLICY "authenticated users can receive global chat broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
    (SELECT realtime.topic()) = 'global-chat'
    AND realtime.messages.extension = 'broadcast'
);
