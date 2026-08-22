BEGIN;

GRANT SELECT ON published.active_party_candidates TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
