BEGIN;

GRANT EXECUTE ON FUNCTION public.submit_region_issue_response(UUID, UUID[])
TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
TO authenticated;

COMMENT ON FUNCTION public.submit_region_issue_response(UUID, UUID[]) IS
    'Authenticated entrypoint guarded by Cloudflare proxy HMAC verification.';
COMMENT ON FUNCTION public.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) IS
    'Authenticated entrypoint guarded by Cloudflare proxy HMAC verification.';

COMMIT;
