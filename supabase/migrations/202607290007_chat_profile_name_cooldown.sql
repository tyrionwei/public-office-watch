ALTER TABLE chat_profiles
ADD COLUMN display_name_updated_at TIMESTAMPTZ;

UPDATE chat_profiles
SET display_name_updated_at = created_at
WHERE display_name_updated_at IS NULL;

ALTER TABLE chat_profiles
ALTER COLUMN display_name_updated_at SET DEFAULT NOW(),
ALTER COLUMN display_name_updated_at SET NOT NULL;

DROP FUNCTION upsert_chat_profile(UUID, TEXT, TEXT, BOOLEAN);

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
    display_name_updated_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    current_terms_version TEXT;
    existing_display_name TEXT;
    existing_display_name_updated_at TIMESTAMPTZ;
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

    SELECT
        profile.current_display_name,
        profile.display_name_updated_at,
        profile.terms_version,
        profile.terms_accepted_at
    INTO
        existing_display_name,
        existing_display_name_updated_at,
        existing_terms_version,
        existing_terms_accepted_at
    FROM chat_profiles profile
    WHERE profile.user_id = p_user_id
    FOR UPDATE;

    IF existing_display_name IS NOT NULL
       AND existing_display_name IS DISTINCT FROM p_display_name
       AND existing_display_name_updated_at > NOW() - INTERVAL '30 minutes' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_NAME_COOLDOWN';
    END IF;

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
        terms_accepted_at,
        display_name_updated_at
    )
    VALUES (
        p_user_id,
        p_public_code,
        p_display_name,
        current_terms_version,
        NOW(),
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
        display_name_updated_at = CASE
            WHEN profile.current_display_name IS DISTINCT FROM EXCLUDED.current_display_name THEN NOW()
            ELSE profile.display_name_updated_at
        END,
        updated_at = NOW();

    RETURN QUERY
    SELECT
        profile.user_id,
        profile.public_code,
        profile.current_display_name,
        profile.terms_version,
        profile.terms_accepted_at,
        profile.display_name_updated_at,
        profile.updated_at
    FROM chat_profiles profile
    WHERE profile.user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION upsert_chat_profile(UUID, TEXT, TEXT, BOOLEAN)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_chat_profile(UUID, TEXT, TEXT, BOOLEAN)
TO service_role;
