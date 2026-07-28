CREATE OR REPLACE VIEW public_chat_messages WITH (security_barrier = true) AS
SELECT
    message.id,
    message.display_name_snapshot,
    message.public_code_snapshot,
    CASE
        WHEN message.moderation_status <> 'visible' THEN NULL
        WHEN author.status = 'banned' THEN NULL
        WHEN author.status = 'muted'
             AND (author.muted_until IS NULL OR author.muted_until > NOW()) THEN NULL
        ELSE message.body
    END AS body,
    message.reply_to_message_id,
    CASE
        WHEN message.reply_to_message_id IS NULL THEN NULL
        WHEN replied.moderation_status <> 'visible' THEN 'removed'
        WHEN replied_author.status = 'banned' THEN 'removed'
        WHEN replied_author.status = 'muted'
             AND (replied_author.muted_until IS NULL OR replied_author.muted_until > NOW()) THEN 'removed'
        ELSE 'available'
    END AS reply_state,
    CASE
        WHEN replied.moderation_status = 'visible'
             AND replied_author.status <> 'banned'
             AND NOT (
                 replied_author.status = 'muted'
                 AND (replied_author.muted_until IS NULL OR replied_author.muted_until > NOW())
             )
        THEN message.reply_to_display_name_snapshot
        ELSE NULL
    END AS reply_to_display_name_snapshot,
    CASE
        WHEN replied.moderation_status = 'visible'
             AND replied_author.status <> 'banned'
             AND NOT (
                 replied_author.status = 'muted'
                 AND (replied_author.muted_until IS NULL OR replied_author.muted_until > NOW())
             )
        THEN message.reply_to_public_code_snapshot
        ELSE NULL
    END AS reply_to_public_code_snapshot,
    CASE
        WHEN replied.moderation_status = 'visible'
             AND replied_author.status <> 'banned'
             AND NOT (
                 replied_author.status = 'muted'
                 AND (replied_author.muted_until IS NULL OR replied_author.muted_until > NOW())
             )
        THEN message.reply_to_body_snapshot
        ELSE NULL
    END AS reply_to_body_snapshot,
    message.created_at,
    CASE
        WHEN message.moderation_status <> 'visible' THEN 'removed'
        WHEN author.status = 'banned' THEN 'author_banned'
        WHEN author.status = 'muted'
             AND (author.muted_until IS NULL OR author.muted_until > NOW()) THEN 'author_muted'
        ELSE 'visible'
    END AS visibility_state,
    CASE
        WHEN author.status = 'muted'
             AND (author.muted_until IS NULL OR author.muted_until > NOW())
        THEN author.muted_until
        ELSE NULL
    END AS visibility_until
FROM chat_messages message
CROSS JOIN chat_settings settings
JOIN chat_profiles author ON author.user_id = message.user_id
LEFT JOIN chat_messages replied ON replied.id = message.reply_to_message_id
LEFT JOIN chat_profiles replied_author ON replied_author.user_id = replied.user_id
WHERE settings.id = 1
  AND settings.is_enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_chat_messages_all_cursor
    ON chat_messages(created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION admin_set_chat_profile_mute(
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
    next_status TEXT;
    next_muted_until TIMESTAMPTZ;
BEGIN
    PERFORM assert_chat_admin(p_admin_user_id);

    IF p_muted AND (
        (p_duration_minutes IS NOT NULL AND p_duration_minutes NOT IN (10, 60, 1440, 10080))
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

    next_status := CASE
        WHEN NOT p_muted THEN 'active'
        WHEN p_duration_minutes IS NULL THEN 'banned'
        ELSE 'muted'
    END;
    next_muted_until := CASE
        WHEN p_muted AND p_duration_minutes IS NOT NULL
        THEN NOW() + make_interval(mins => p_duration_minutes)
        ELSE NULL
    END;

    UPDATE chat_profiles profile
    SET status = next_status,
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
        CASE
            WHEN NOT p_muted THEN 'user_unmuted'
            WHEN p_duration_minutes IS NULL THEN 'user_banned'
            ELSE 'user_muted'
        END,
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

CREATE OR REPLACE FUNCTION broadcast_public_chat_message()
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
            'created_at', NEW.created_at,
            'visibility_state', 'visible',
            'visibility_until', NULL
        ),
        'message_created',
        'global-chat',
        TRUE
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION broadcast_chat_moderation_change()
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
            'created_at', NEW.created_at,
            'visibility_state', 'visible',
            'visibility_until', NULL
        ),
        'message_created',
        'global-chat',
        TRUE
    );
    RETURN NEW;
END;
$$;

CREATE FUNCTION broadcast_chat_profile_moderation_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD.status IS NOT DISTINCT FROM NEW.status
       AND OLD.muted_until IS NOT DISTINCT FROM NEW.muted_until THEN
        RETURN NEW;
    END IF;

    PERFORM realtime.send(
        jsonb_build_object(
            'public_code', NEW.public_code,
            'visibility_state', CASE
                WHEN NEW.status = 'banned' THEN 'author_banned'
                WHEN NEW.status = 'muted'
                     AND (NEW.muted_until IS NULL OR NEW.muted_until > NOW()) THEN 'author_muted'
                ELSE 'visible'
            END,
            'visibility_until', CASE WHEN NEW.status = 'muted' THEN NEW.muted_until ELSE NULL END
        ),
        'profile_moderation_changed',
        'global-chat',
        TRUE
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER chat_profiles_broadcast_moderation
AFTER UPDATE OF status, muted_until ON chat_profiles
FOR EACH ROW
EXECUTE FUNCTION broadcast_chat_profile_moderation_change();

COMMENT ON VIEW public_chat_messages IS
    'Public chat read model; moderated and restricted-author messages retain position but never expose their body.';
