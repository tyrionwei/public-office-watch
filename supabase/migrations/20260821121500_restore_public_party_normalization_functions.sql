-- Published party views normalize display names through these read-only helpers.
-- They cannot mutate data; public execution is required for browser reads.
GRANT EXECUTE ON FUNCTION public.canonical_party_name(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_party_key(TEXT) TO anon, authenticated;
