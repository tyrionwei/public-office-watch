CREATE INDEX idx_chat_messages_admin_public_code_cursor
    ON chat_messages(public_code_snapshot, created_at DESC, id DESC);

CREATE FUNCTION admin_search_chat_messages(
    p_admin_user_id UUID,
    p_query TEXT
)
RETURNS TABLE (
    message_id UUID,
    display_name TEXT,
    public_code TEXT,
    body TEXT,
    moderation_status TEXT,
    removed_at TIMESTAMPTZ,
    removal_reason TEXT,
    profile_status TEXT,
    muted_until TIMESTAMPTZ,
    security_log_present BOOLEAN,
    security_expires_at TIMESTAMPTZ,
    security_hold_active BOOLEAN,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    normalized_query TEXT := UPPER(REGEXP_REPLACE(BTRIM(COALESCE(p_query, '')), '^#', ''));
    target_message_id UUID;
BEGIN
    PERFORM assert_chat_admin(p_admin_user_id);

    IF BTRIM(COALESCE(p_query, '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        target_message_id := BTRIM(p_query)::UUID;
    ELSIF normalized_query !~ '^[0-9A-HJKMNP-TV-Z]{6}$' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_ADMIN_INVALID_SEARCH';
    END IF;

    RETURN QUERY
    SELECT
        message.id,
        message.display_name_snapshot,
        message.public_code_snapshot,
        message.body,
        message.moderation_status,
        message.removed_at,
        message.removal_reason,
        COALESCE(profile.status, 'unknown'),
        profile.muted_until,
        security_log.message_id IS NOT NULL,
        security_log.expires_at,
        security_log.legal_hold_until IS NOT NULL,
        message.created_at
    FROM chat_messages message
    LEFT JOIN chat_profiles profile
      ON profile.user_id = message.user_id
    LEFT JOIN chat_message_security_logs security_log
      ON security_log.message_id = message.id
    WHERE (
        target_message_id IS NOT NULL
        AND message.id = target_message_id
    ) OR (
        target_message_id IS NULL
        AND message.public_code_snapshot = normalized_query
    )
    ORDER BY message.created_at DESC, message.id DESC
    LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION admin_search_chat_messages(UUID, TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION admin_search_chat_messages(UUID, TEXT)
TO service_role;
