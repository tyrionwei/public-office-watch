BEGIN;

INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    is_anonymous,
    created_at,
    updated_at
)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    '018f9e79-7399-7fd0-bfca-5aae32014bd9',
    'authenticated',
    'authenticated',
    TRUE,
    NOW(),
    NOW()
);

DO $$
BEGIN
    BEGIN
        PERFORM *
        FROM upsert_chat_profile(
            '018f9e79-7399-7fd0-bfca-5aae32014bd9',
            '本機測試者',
            'A7K2F9',
            FALSE
        );
        RAISE EXCEPTION 'expected CHAT_TERMS_REQUIRED';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM <> 'CHAT_TERMS_REQUIRED' THEN
                RAISE;
            END IF;
    END;
END;
$$;

SELECT *
FROM upsert_chat_profile(
    '018f9e79-7399-7fd0-bfca-5aae32014bd9',
    '本機測試者',
    'A7K2F9',
    TRUE
);

DO $$
BEGIN
    BEGIN
        PERFORM *
        FROM create_chat_message(
            '018f9e79-7399-7fd0-bfca-5aae32014bd9',
            '聊天室應維持關閉',
            NULL,
            REPEAT('a', 64),
            'gcm.test.disabled',
            1,
            'chat-local-disabled',
            REPEAT('b', 64)
        );
        RAISE EXCEPTION 'expected CHAT_DISABLED';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM <> 'CHAT_DISABLED' THEN
                RAISE;
            END IF;
    END;
END;
$$;

UPDATE chat_settings
SET is_enabled = TRUE,
    updated_at = NOW()
WHERE id = 1;

CREATE TEMP TABLE first_chat_message AS
SELECT *
FROM create_chat_message(
    '018f9e79-7399-7fd0-bfca-5aae32014bd9',
    '第一則本機測試訊息',
    NULL,
    REPEAT('a', 64),
    'gcm.test.first',
    1,
    'chat-local-first',
    REPEAT('b', 64)
);

DO $$
BEGIN
    BEGIN
        PERFORM *
        FROM create_chat_message(
            '018f9e79-7399-7fd0-bfca-5aae32014bd9',
            '冷卻時間內的訊息',
            NULL,
            REPEAT('a', 64),
            'gcm.test.cooldown',
            1,
            'chat-local-cooldown',
            REPEAT('b', 64)
        );
        RAISE EXCEPTION 'expected CHAT_COOLDOWN';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM <> 'CHAT_COOLDOWN' THEN
                RAISE;
            END IF;
    END;
END;
$$;

UPDATE chat_messages
SET created_at = NOW() - INTERVAL '9 seconds'
WHERE id = (SELECT id FROM first_chat_message);

DO $$
BEGIN
    BEGIN
        PERFORM *
        FROM create_chat_message(
            '018f9e79-7399-7fd0-bfca-5aae32014bd9',
            '第一則本機測試訊息',
            NULL,
            REPEAT('a', 64),
            'gcm.test.duplicate',
            1,
            'chat-local-duplicate',
            REPEAT('b', 64)
        );
        RAISE EXCEPTION 'expected CHAT_DUPLICATE';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM <> 'CHAT_DUPLICATE' THEN
                RAISE;
            END IF;
    END;
END;
$$;

SELECT *
FROM create_chat_message(
    '018f9e79-7399-7fd0-bfca-5aae32014bd9',
    '這是一則回覆',
    (SELECT id FROM first_chat_message),
    REPEAT('a', 64),
    'gcm.test.reply',
    1,
    'chat-local-reply',
    REPEAT('b', 64)
);

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM chat_messages
        WHERE user_id = '018f9e79-7399-7fd0-bfca-5aae32014bd9'
    ) <> 2 THEN
        RAISE EXCEPTION 'expected two chat messages';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM chat_message_security_logs
        WHERE user_id = '018f9e79-7399-7fd0-bfca-5aae32014bd9'
    ) <> 2 THEN
        RAISE EXCEPTION 'expected one security log per message';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM chat_profiles profile
        JOIN chat_settings setting ON setting.id = 1
        WHERE profile.user_id = '018f9e79-7399-7fd0-bfca-5aae32014bd9'
          AND profile.terms_version = setting.terms_version
          AND profile.terms_accepted_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'expected current terms acceptance';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM chat_messages
        WHERE reply_to_message_id = (SELECT id FROM first_chat_message)
          AND reply_to_display_name_snapshot = '本機測試者'
          AND reply_to_public_code_snapshot = 'A7K2F9'
          AND reply_to_body_snapshot = '第一則本機測試訊息'
    ) THEN
        RAISE EXCEPTION 'expected immutable reply snapshots';
    END IF;

    IF has_function_privilege(
        'anon',
        'create_chat_message(uuid,text,uuid,text,text,integer,text,text)',
        'EXECUTE'
    ) OR has_function_privilege(
        'authenticated',
        'create_chat_message(uuid,text,uuid,text,text,integer,text,text)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'public roles must not execute chat write functions';
    END IF;
END;
$$;

ROLLBACK;
