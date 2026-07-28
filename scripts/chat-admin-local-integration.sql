BEGIN;

INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    raw_app_meta_data,
    is_anonymous,
    created_at,
    updated_at
)
VALUES
(
    '00000000-0000-0000-0000-000000000000',
    '118f9e79-7399-7fd0-bfca-5aae32014bd9',
    'authenticated',
    'authenticated',
    'chat-admin@example.test',
    '{"chat_admin": true}'::JSONB,
    FALSE,
    NOW(),
    NOW()
),
(
    '00000000-0000-0000-0000-000000000000',
    '218f9e79-7399-7fd0-bfca-5aae32014bd9',
    'authenticated',
    'authenticated',
    'not-admin@example.test',
    '{}'::JSONB,
    FALSE,
    NOW(),
    NOW()
),
(
    '00000000-0000-0000-0000-000000000000',
    '318f9e79-7399-7fd0-bfca-5aae32014bd9',
    'authenticated',
    'authenticated',
    NULL,
    '{}'::JSONB,
    TRUE,
    NOW(),
    NOW()
);

SELECT *
FROM upsert_chat_profile(
    '318f9e79-7399-7fd0-bfca-5aae32014bd9',
    '管理測試者',
    'M7K2F9',
    TRUE
);

DO $$
BEGIN
    BEGIN
        PERFORM *
        FROM admin_set_chat_enabled(
            '218f9e79-7399-7fd0-bfca-5aae32014bd9',
            TRUE
        );
        RAISE EXCEPTION 'expected CHAT_ADMIN_FORBIDDEN';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM <> 'CHAT_ADMIN_FORBIDDEN' THEN
                RAISE;
            END IF;
    END;
END;
$$;

SELECT *
FROM admin_set_chat_enabled(
    '118f9e79-7399-7fd0-bfca-5aae32014bd9',
    TRUE
);

CREATE TEMP TABLE moderation_message AS
SELECT *
FROM create_chat_message(
    '318f9e79-7399-7fd0-bfca-5aae32014bd9',
    '管理功能本機測試訊息',
    NULL,
    REPEAT('a', 64),
    'gcm.test.admin',
    1,
    'chat-admin-local-message',
    REPEAT('b', 64)
);

SELECT *
FROM admin_set_chat_message_visibility(
    '118f9e79-7399-7fd0-bfca-5aae32014bd9',
    (SELECT id FROM moderation_message),
    FALSE,
    'spam'
);

SELECT *
FROM admin_set_chat_profile_mute(
    '118f9e79-7399-7fd0-bfca-5aae32014bd9',
    (SELECT id FROM moderation_message),
    TRUE,
    60,
    'spam'
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM chat_messages
        WHERE id = (SELECT id FROM moderation_message)
          AND moderation_status = 'removed'
          AND removal_reason = 'spam'
          AND removed_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'expected removed message';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM chat_profiles
        WHERE user_id = '318f9e79-7399-7fd0-bfca-5aae32014bd9'
          AND status = 'muted'
          AND muted_until > NOW()
    ) THEN
        RAISE EXCEPTION 'expected muted profile';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM chat_moderation_actions
        WHERE admin_user_id = '118f9e79-7399-7fd0-bfca-5aae32014bd9'
    ) <> 3 THEN
        RAISE EXCEPTION 'expected three audited admin actions';
    END IF;

    IF has_function_privilege(
        'anon',
        'admin_set_chat_enabled(uuid,boolean)',
        'EXECUTE'
    ) OR has_function_privilege(
        'authenticated',
        'admin_set_chat_message_visibility(uuid,uuid,boolean,text)',
        'EXECUTE'
    ) OR has_function_privilege(
        'anon',
        'admin_set_chat_security_hold(uuid,uuid,boolean,text)',
        'EXECUTE'
    ) OR has_function_privilege(
        'authenticated',
        'cleanup_expired_chat_security_logs(integer)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'public roles must not execute chat admin functions';
    END IF;
END;
$$;

SELECT *
FROM admin_set_chat_security_hold(
    '118f9e79-7399-7fd0-bfca-5aae32014bd9',
    (SELECT id FROM moderation_message),
    TRUE,
    'legal_investigation'
);

UPDATE chat_message_security_logs
SET expires_at = NOW() - INTERVAL '1 day'
WHERE message_id = (SELECT id FROM moderation_message);

DO $$
BEGIN
    IF cleanup_expired_chat_security_logs(1000) <> 0 THEN
        RAISE EXCEPTION 'held security log must not be deleted';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM chat_message_security_logs
        WHERE message_id = (SELECT id FROM moderation_message)
          AND legal_hold_until = 'infinity'::TIMESTAMPTZ
    ) THEN
        RAISE EXCEPTION 'expected active Legal Hold';
    END IF;
END;
$$;

SELECT *
FROM admin_set_chat_security_hold(
    '118f9e79-7399-7fd0-bfca-5aae32014bd9',
    (SELECT id FROM moderation_message),
    FALSE,
    'hold_released'
);

DO $$
BEGIN
    IF cleanup_expired_chat_security_logs(1000) <> 1 THEN
        RAISE EXCEPTION 'released expired security log should be deleted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM chat_message_security_logs
        WHERE message_id = (SELECT id FROM moderation_message)
    ) THEN
        RAISE EXCEPTION 'expected security log cleanup';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM chat_moderation_actions
        WHERE admin_user_id = '118f9e79-7399-7fd0-bfca-5aae32014bd9'
    ) <> 5 THEN
        RAISE EXCEPTION 'expected audited Legal Hold actions';
    END IF;
END;
$$;

SELECT *
FROM admin_set_chat_message_visibility(
    '118f9e79-7399-7fd0-bfca-5aae32014bd9',
    (SELECT id FROM moderation_message),
    TRUE,
    'operator_correction'
);

SELECT *
FROM admin_set_chat_profile_mute(
    '118f9e79-7399-7fd0-bfca-5aae32014bd9',
    (SELECT id FROM moderation_message),
    FALSE,
    NULL,
    'operator_correction'
);

SELECT *
FROM admin_set_chat_enabled(
    '118f9e79-7399-7fd0-bfca-5aae32014bd9',
    FALSE
);

DO $$
BEGIN
    IF (SELECT is_enabled FROM chat_settings WHERE id = 1) THEN
        RAISE EXCEPTION 'expected chat disabled after test';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM chat_messages
        WHERE id = (SELECT id FROM moderation_message)
          AND moderation_status = 'visible'
          AND removal_reason IS NULL
    ) THEN
        RAISE EXCEPTION 'expected restored message';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM chat_profiles
        WHERE user_id = '318f9e79-7399-7fd0-bfca-5aae32014bd9'
          AND status = 'active'
          AND muted_until IS NULL
    ) THEN
        RAISE EXCEPTION 'expected unmuted profile';
    END IF;
END;
$$;

ROLLBACK;
