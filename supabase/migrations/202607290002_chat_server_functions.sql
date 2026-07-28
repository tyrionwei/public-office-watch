CREATE OR REPLACE FUNCTION upsert_chat_profile(
    p_user_id UUID,
    p_display_name TEXT,
    p_public_code TEXT
)
RETURNS TABLE (
    user_id UUID,
    public_code TEXT,
    current_display_name TEXT,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM auth.users account WHERE account.id = p_user_id
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_UNAUTHENTICATED';
    END IF;

    INSERT INTO chat_profiles AS profile (
        user_id,
        public_code,
        current_display_name
    )
    VALUES (
        p_user_id,
        p_public_code,
        p_display_name
    )
    ON CONFLICT ON CONSTRAINT chat_profiles_pkey DO UPDATE
    SET current_display_name = EXCLUDED.current_display_name,
        updated_at = NOW();

    RETURN QUERY
    SELECT
        profile.user_id,
        profile.public_code,
        profile.current_display_name,
        profile.updated_at
    FROM chat_profiles profile
    WHERE profile.user_id = p_user_id;
END;
$$;

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
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_UNAUTHENTICATED';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT, 0));

    IF NOT COALESCE((
        SELECT setting.is_enabled
        FROM chat_settings setting
        WHERE setting.id = 1
    ), FALSE) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_DISABLED';
    END IF;

    SELECT current_profile.*
    INTO profile
    FROM chat_profiles current_profile
    WHERE current_profile.user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_PROFILE_REQUIRED';
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
        message_id,
        user_id,
        ip_hmac,
        ip_ciphertext,
        encryption_key_version,
        request_id,
        user_agent_hash
    )
    VALUES (
        inserted.id,
        p_user_id,
        p_ip_hmac,
        p_ip_ciphertext,
        p_encryption_key_version,
        p_request_id,
        p_user_agent_hash
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
        inserted.created_at;
END;
$$;

REVOKE ALL ON FUNCTION upsert_chat_profile(UUID, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION create_chat_message(
    UUID, TEXT, UUID, TEXT, TEXT, INTEGER, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION upsert_chat_profile(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION create_chat_message(
    UUID, TEXT, UUID, TEXT, TEXT, INTEGER, TEXT, TEXT
) TO service_role;

COMMENT ON FUNCTION upsert_chat_profile(UUID, TEXT, TEXT) IS
    'Service-only profile write path. Existing users keep their immutable public code.';
COMMENT ON FUNCTION create_chat_message(UUID, TEXT, UUID, TEXT, TEXT, INTEGER, TEXT, TEXT) IS
    'Service-only atomic chat write path with feature flag, moderation, cooldown, duplicate and security-log enforcement.';
