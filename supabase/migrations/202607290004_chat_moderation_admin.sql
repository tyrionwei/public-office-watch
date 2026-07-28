CREATE TABLE chat_moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    action_type TEXT NOT NULL CHECK (
        action_type IN (
            'chat_enabled',
            'chat_disabled',
            'message_removed',
            'message_restored',
            'user_muted',
            'user_unmuted'
        )
    ),
    message_id UUID REFERENCES chat_messages(id) ON DELETE RESTRICT,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL CHECK (
        reason IN (
            'bot',
            'spam',
            'external_link',
            'advertising',
            'rate_limit_evasion',
            'illegal_or_legal_notice',
            'operator_correction',
            'emergency_shutdown',
            'manual_enable'
        )
    ),
    muted_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_moderation_actions_created
    ON chat_moderation_actions(created_at DESC);

ALTER TABLE chat_moderation_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON chat_moderation_actions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON chat_moderation_actions TO service_role;

CREATE FUNCTION assert_chat_admin(p_admin_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_admin_user_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM auth.users account
        WHERE account.id = p_admin_user_id
          AND COALESCE((account.raw_app_meta_data ->> 'chat_admin')::BOOLEAN, FALSE)
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_ADMIN_FORBIDDEN';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION assert_chat_admin(UUID)
FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION admin_set_chat_enabled(
    p_admin_user_id UUID,
    p_enabled BOOLEAN
)
RETURNS TABLE (
    is_enabled BOOLEAN,
    updated_at TIMESTAMPTZ,
    terms_version TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM assert_chat_admin(p_admin_user_id);

    UPDATE chat_settings setting
    SET is_enabled = p_enabled,
        updated_at = NOW()
    WHERE setting.id = 1;

    INSERT INTO chat_moderation_actions (
        admin_user_id,
        action_type,
        reason
    )
    VALUES (
        p_admin_user_id,
        CASE WHEN p_enabled THEN 'chat_enabled' ELSE 'chat_disabled' END,
        CASE WHEN p_enabled THEN 'manual_enable' ELSE 'emergency_shutdown' END
    );

    RETURN QUERY
    SELECT setting.is_enabled, setting.updated_at, setting.terms_version
    FROM chat_settings setting
    WHERE setting.id = 1;
END;
$$;

CREATE FUNCTION admin_set_chat_message_visibility(
    p_admin_user_id UUID,
    p_message_id UUID,
    p_visible BOOLEAN,
    p_reason TEXT
)
RETURNS TABLE (
    id UUID,
    moderation_status TEXT,
    removed_at TIMESTAMPTZ,
    removal_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    target_message chat_messages%ROWTYPE;
    desired_status TEXT := CASE WHEN p_visible THEN 'visible' ELSE 'removed' END;
BEGIN
    PERFORM assert_chat_admin(p_admin_user_id);

    IF p_visible AND p_reason <> 'operator_correction' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_ADMIN_INVALID_REASON';
    END IF;

    IF NOT p_visible AND p_reason NOT IN (
        'bot',
        'spam',
        'external_link',
        'advertising',
        'rate_limit_evasion',
        'illegal_or_legal_notice'
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_ADMIN_INVALID_REASON';
    END IF;

    SELECT message.*
    INTO target_message
    FROM chat_messages message
    WHERE message.id = p_message_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_ADMIN_MESSAGE_NOT_FOUND';
    END IF;

    IF target_message.moderation_status = 'held' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_ADMIN_MESSAGE_HELD';
    END IF;

    IF target_message.moderation_status <> desired_status THEN
        UPDATE chat_messages message
        SET moderation_status = desired_status,
            removed_at = CASE WHEN p_visible THEN NULL ELSE NOW() END,
            removal_reason = CASE WHEN p_visible THEN NULL ELSE p_reason END
        WHERE message.id = p_message_id;

        INSERT INTO chat_moderation_actions (
            admin_user_id,
            action_type,
            message_id,
            target_user_id,
            reason
        )
        VALUES (
            p_admin_user_id,
            CASE WHEN p_visible THEN 'message_restored' ELSE 'message_removed' END,
            target_message.id,
            target_message.user_id,
            p_reason
        );
    END IF;

    RETURN QUERY
    SELECT message.id, message.moderation_status, message.removed_at, message.removal_reason
    FROM chat_messages message
    WHERE message.id = p_message_id;
END;
$$;

CREATE FUNCTION admin_set_chat_profile_mute(
    p_admin_user_id UUID,
    p_message_id UUID,
    p_muted BOOLEAN,
    p_duration_minutes INTEGER,
    p_reason TEXT
)
RETURNS TABLE (
    public_code TEXT,
    status TEXT,
    muted_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    target_user_id UUID;
    target_profile chat_profiles%ROWTYPE;
    next_muted_until TIMESTAMPTZ;
BEGIN
    PERFORM assert_chat_admin(p_admin_user_id);

    IF p_muted AND (
        p_duration_minutes IS NULL
        OR p_duration_minutes NOT BETWEEN 5 AND 10080
        OR p_reason NOT IN (
            'bot',
            'spam',
            'external_link',
            'advertising',
            'rate_limit_evasion',
            'illegal_or_legal_notice'
        )
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_ADMIN_INVALID_MUTE';
    END IF;

    IF NOT p_muted AND p_reason <> 'operator_correction' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_ADMIN_INVALID_REASON';
    END IF;

    SELECT message.user_id
    INTO target_user_id
    FROM chat_messages message
    WHERE message.id = p_message_id;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_ADMIN_MESSAGE_NOT_FOUND';
    END IF;

    SELECT profile.*
    INTO target_profile
    FROM chat_profiles profile
    WHERE profile.user_id = target_user_id
    FOR UPDATE;

    IF target_profile.status = 'banned' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_ADMIN_TARGET_BANNED';
    END IF;

    next_muted_until := CASE
        WHEN p_muted THEN NOW() + make_interval(mins => p_duration_minutes)
        ELSE NULL
    END;

    UPDATE chat_profiles profile
    SET status = CASE WHEN p_muted THEN 'muted' ELSE 'active' END,
        muted_until = next_muted_until,
        updated_at = NOW()
    WHERE profile.user_id = target_user_id;

    INSERT INTO chat_moderation_actions (
        admin_user_id,
        action_type,
        message_id,
        target_user_id,
        reason,
        muted_until
    )
    VALUES (
        p_admin_user_id,
        CASE WHEN p_muted THEN 'user_muted' ELSE 'user_unmuted' END,
        p_message_id,
        target_user_id,
        p_reason,
        next_muted_until
    );

    RETURN QUERY
    SELECT profile.public_code, profile.status, profile.muted_until
    FROM chat_profiles profile
    WHERE profile.user_id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION admin_set_chat_enabled(UUID, BOOLEAN)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_set_chat_message_visibility(UUID, UUID, BOOLEAN, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_set_chat_profile_mute(UUID, UUID, BOOLEAN, INTEGER, TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION admin_set_chat_enabled(UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION admin_set_chat_message_visibility(UUID, UUID, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION admin_set_chat_profile_mute(UUID, UUID, BOOLEAN, INTEGER, TEXT) TO service_role;

CREATE FUNCTION broadcast_chat_moderation_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    reply_visible BOOLEAN;
BEGIN
    IF OLD.moderation_status IS NOT DISTINCT FROM NEW.moderation_status THEN
        RETURN NEW;
    END IF;

    IF NEW.moderation_status <> 'visible' THEN
        PERFORM realtime.send(
            jsonb_build_object('id', NEW.id),
            'message_removed',
            'global-chat',
            TRUE
        );
        RETURN NEW;
    END IF;

    SELECT replied.moderation_status = 'visible'
    INTO reply_visible
    FROM chat_messages replied
    WHERE replied.id = NEW.reply_to_message_id;

    PERFORM realtime.send(
        jsonb_build_object(
            'id', NEW.id,
            'display_name_snapshot', NEW.display_name_snapshot,
            'public_code_snapshot', NEW.public_code_snapshot,
            'body', NEW.body,
            'reply_to_message_id', NEW.reply_to_message_id,
            'reply_state', CASE WHEN NEW.reply_to_message_id IS NULL THEN NULL WHEN reply_visible THEN 'available' ELSE 'removed' END,
            'reply_to_display_name_snapshot', CASE WHEN reply_visible THEN NEW.reply_to_display_name_snapshot ELSE NULL END,
            'reply_to_public_code_snapshot', CASE WHEN reply_visible THEN NEW.reply_to_public_code_snapshot ELSE NULL END,
            'reply_to_body_snapshot', CASE WHEN reply_visible THEN NEW.reply_to_body_snapshot ELSE NULL END,
            'created_at', NEW.created_at
        ),
        'message_created',
        'global-chat',
        TRUE
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER chat_messages_broadcast_moderation
AFTER UPDATE OF moderation_status ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION broadcast_chat_moderation_change();

CREATE FUNCTION broadcast_chat_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD.is_enabled IS DISTINCT FROM NEW.is_enabled THEN
        PERFORM realtime.send(
            jsonb_build_object(
                'is_enabled', NEW.is_enabled,
                'updated_at', NEW.updated_at,
                'terms_version', NEW.terms_version
            ),
            'status_changed',
            'global-chat',
            TRUE
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER chat_settings_broadcast_status
AFTER UPDATE OF is_enabled ON chat_settings
FOR EACH ROW
EXECUTE FUNCTION broadcast_chat_status_change();

COMMENT ON TABLE chat_moderation_actions IS
    'Restricted audit trail for emergency chat controls and narrowly scoped abuse moderation.';
