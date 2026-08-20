-- These helpers are used by migrations, triggers, and trusted server-side roles.
-- They are not public API endpoints and must not be executable through PostgREST.
REVOKE EXECUTE ON FUNCTION public.canonical_party_name(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.canonical_party_key(TEXT) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
    IF TO_REGPROCEDURE('public.rls_auto_enable()') IS NOT NULL THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.canonical_party_name(TEXT) TO service_role, admin_role;
GRANT EXECUTE ON FUNCTION public.canonical_party_key(TEXT) TO service_role, admin_role;
