CREATE TABLE chat_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO chat_settings (id, is_enabled)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE chat_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    public_code TEXT NOT NULL UNIQUE CHECK (
        public_code ~ '^[0-9A-HJKMNP-TV-Z]{6}$'
    ),
    current_display_name TEXT NOT NULL CHECK (
        CHAR_LENGTH(current_display_name) BETWEEN 2 AND 12
        AND current_display_name = BTRIM(current_display_name)
        AND POSITION(E'\n' IN current_display_name) = 0
        AND POSITION(E'\r' IN current_display_name) = 0
    ),
    status TEXT NOT NULL DEFAULT 'active' CHECK (
        status IN ('active', 'muted', 'banned')
    ),
    muted_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    display_name_snapshot TEXT NOT NULL CHECK (
        CHAR_LENGTH(display_name_snapshot) BETWEEN 2 AND 12
        AND display_name_snapshot = BTRIM(display_name_snapshot)
        AND POSITION(E'\n' IN display_name_snapshot) = 0
        AND POSITION(E'\r' IN display_name_snapshot) = 0
    ),
    public_code_snapshot TEXT NOT NULL CHECK (
        public_code_snapshot ~ '^[0-9A-HJKMNP-TV-Z]{6}$'
    ),
    body TEXT NOT NULL CHECK (
        CHAR_LENGTH(body) BETWEEN 1 AND 50
        AND body = BTRIM(body)
        AND POSITION(E'\n' IN body) = 0
        AND POSITION(E'\r' IN body) = 0
    ),
    reply_to_message_id UUID REFERENCES chat_messages(id) ON DELETE RESTRICT,
    reply_to_display_name_snapshot TEXT,
    reply_to_public_code_snapshot TEXT,
    reply_to_body_snapshot TEXT,
    moderation_status TEXT NOT NULL DEFAULT 'visible' CHECK (
        moderation_status IN ('visible', 'removed', 'held')
    ),
    removed_at TIMESTAMPTZ,
    removal_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (
            reply_to_message_id IS NULL
            AND reply_to_display_name_snapshot IS NULL
            AND reply_to_public_code_snapshot IS NULL
            AND reply_to_body_snapshot IS NULL
        )
        OR
        (
            reply_to_message_id IS NOT NULL
            AND CHAR_LENGTH(reply_to_display_name_snapshot) BETWEEN 2 AND 12
            AND reply_to_public_code_snapshot ~ '^[0-9A-HJKMNP-TV-Z]{6}$'
            AND CHAR_LENGTH(reply_to_body_snapshot) BETWEEN 1 AND 20
        )
    )
);

CREATE INDEX idx_chat_messages_public_cursor
    ON chat_messages(created_at DESC, id DESC)
    WHERE moderation_status = 'visible';

CREATE INDEX idx_chat_messages_user_cooldown
    ON chat_messages(user_id, created_at DESC);

CREATE TABLE chat_message_security_logs (
    message_id UUID PRIMARY KEY REFERENCES chat_messages(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    ip_hmac TEXT NOT NULL CHECK (ip_hmac ~ '^[0-9a-f]{64}$'),
    ip_ciphertext TEXT NOT NULL,
    encryption_key_version INTEGER NOT NULL CHECK (encryption_key_version > 0),
    request_id TEXT NOT NULL UNIQUE,
    user_agent_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '180 days'),
    legal_hold_until TIMESTAMPTZ,
    CHECK (expires_at >= created_at)
);

CREATE INDEX idx_chat_security_expiry
    ON chat_message_security_logs(expires_at)
    WHERE legal_hold_until IS NULL;

ALTER TABLE chat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message_security_logs ENABLE ROW LEVEL SECURITY;

CREATE VIEW public_chat_status WITH (security_barrier = true) AS
SELECT is_enabled, updated_at
FROM chat_settings
WHERE id = 1;

CREATE VIEW public_chat_messages WITH (security_barrier = true) AS
SELECT
    message.id,
    message.display_name_snapshot,
    message.public_code_snapshot,
    message.body,
    message.reply_to_message_id,
    CASE
        WHEN message.reply_to_message_id IS NULL THEN NULL
        WHEN replied.moderation_status = 'visible' THEN 'available'
        ELSE 'removed'
    END AS reply_state,
    CASE
        WHEN replied.moderation_status = 'visible'
        THEN message.reply_to_display_name_snapshot
        ELSE NULL
    END AS reply_to_display_name_snapshot,
    CASE
        WHEN replied.moderation_status = 'visible'
        THEN message.reply_to_public_code_snapshot
        ELSE NULL
    END AS reply_to_public_code_snapshot,
    CASE
        WHEN replied.moderation_status = 'visible'
        THEN message.reply_to_body_snapshot
        ELSE NULL
    END AS reply_to_body_snapshot,
    message.created_at
FROM chat_messages message
CROSS JOIN chat_settings settings
LEFT JOIN chat_messages replied ON replied.id = message.reply_to_message_id
WHERE settings.id = 1
  AND settings.is_enabled = TRUE
  AND message.moderation_status = 'visible';

REVOKE ALL ON chat_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON chat_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON chat_messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON chat_message_security_logs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public_chat_status FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public_chat_messages FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public_chat_status TO anon, authenticated;
GRANT SELECT ON public_chat_messages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_message_security_logs TO service_role;

COMMENT ON TABLE chat_settings IS
    'Single-row emergency feature flag. Chat remains disabled until the server and UI phases are complete.';
COMMENT ON TABLE chat_profiles IS
    'Private anonymous-auth profiles with a stable six-character public code.';
COMMENT ON TABLE chat_messages IS
    'Short plain-text chat messages with immutable author and reply snapshots.';
COMMENT ON TABLE chat_message_security_logs IS
    'Restricted 180-day abuse and legal-response records. Raw IP is encrypted outside the database.';
COMMENT ON VIEW public_chat_messages IS
    'Public chat read model; removed reply targets do not expose their saved snapshots.';
