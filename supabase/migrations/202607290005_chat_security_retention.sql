CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

ALTER TABLE chat_moderation_actions
    DROP CONSTRAINT chat_moderation_actions_action_type_check,
    DROP CONSTRAINT chat_moderation_actions_reason_check;

ALTER TABLE chat_moderation_actions
    ADD CONSTRAINT chat_moderation_actions_action_type_check CHECK (
        action_type IN (
            'chat_enabled',
            'chat_disabled',
            'message_removed',
            'message_restored',
            'user_muted',
            'user_unmuted',
            'security_hold_applied',
            'security_hold_released'
        )
    ),
    ADD CONSTRAINT chat_moderation_actions_reason_check CHECK (
        reason IN (
            'bot',
            'spam',
            'external_link',
            'advertising',
            'rate_limit_evasion',
            'illegal_or_legal_notice',
            'operator_correction',
            'emergency_shutdown',
            'manual_enable',
            'legal_investigation',
            'major_security_incident',
            'hold_released'
        )
    );

CREATE FUNCTION admin_set_chat_security_hold(
    p_admin_user_id UUID,
    p_message_id UUID,
    p_held BOOLEAN,
    p_reason TEXT
)
RETURNS TABLE (
    message_id UUID,
    security_log_present BOOLEAN,
    legal_hold_active BOOLEAN,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    target_log chat_message_security_logs%ROWTYPE;
BEGIN
    PERFORM assert_chat_admin(p_admin_user_id);

    IF p_held AND p_reason NOT IN (
        'legal_investigation',
        'major_security_incident'
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_ADMIN_INVALID_HOLD_REASON';
    END IF;

    IF NOT p_held AND p_reason <> 'hold_released' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_ADMIN_INVALID_HOLD_REASON';
    END IF;

    SELECT security_log.*
    INTO target_log
    FROM chat_message_security_logs security_log
    WHERE security_log.message_id = p_message_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_ADMIN_SECURITY_LOG_NOT_FOUND';
    END IF;

    IF (target_log.legal_hold_until IS NOT NULL) IS DISTINCT FROM p_held THEN
        UPDATE chat_message_security_logs security_log
        SET legal_hold_until = CASE WHEN p_held THEN 'infinity'::TIMESTAMPTZ ELSE NULL END
        WHERE security_log.message_id = p_message_id;

        INSERT INTO chat_moderation_actions (
            admin_user_id,
            action_type,
            message_id,
            target_user_id,
            reason
        )
        VALUES (
            p_admin_user_id,
            CASE WHEN p_held THEN 'security_hold_applied' ELSE 'security_hold_released' END,
            p_message_id,
            target_log.user_id,
            p_reason
        );
    END IF;

    RETURN QUERY
    SELECT
        security_log.message_id,
        TRUE,
        security_log.legal_hold_until IS NOT NULL,
        security_log.expires_at
    FROM chat_message_security_logs security_log
    WHERE security_log.message_id = p_message_id;
END;
$$;

CREATE FUNCTION cleanup_expired_chat_security_logs(p_batch_size INTEGER DEFAULT 1000)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH expired_logs AS (
        SELECT security_log.message_id
        FROM chat_message_security_logs security_log
        WHERE security_log.expires_at <= NOW()
          AND security_log.legal_hold_until IS NULL
        ORDER BY security_log.expires_at, security_log.message_id
        LIMIT LEAST(GREATEST(COALESCE(p_batch_size, 1000), 1), 5000)
        FOR UPDATE SKIP LOCKED
    ), deleted_logs AS (
        DELETE FROM chat_message_security_logs security_log
        USING expired_logs expired
        WHERE security_log.message_id = expired.message_id
        RETURNING security_log.message_id
    )
    SELECT COUNT(*)::INTEGER
    INTO deleted_count
    FROM deleted_logs;

    RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION admin_set_chat_security_hold(UUID, UUID, BOOLEAN, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cleanup_expired_chat_security_logs(INTEGER)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION admin_set_chat_security_hold(UUID, UUID, BOOLEAN, TEXT)
TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_chat_security_logs(INTEGER)
TO service_role;

SELECT cron.schedule(
    'chat-security-log-cleanup',
    '17 3 * * *',
    'SELECT public.cleanup_expired_chat_security_logs(1000);'
);
