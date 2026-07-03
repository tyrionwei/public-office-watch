ALTER TABLE parties
    DROP CONSTRAINT IF EXISTS parties_theme_key_check;

ALTER TABLE parties
    ADD CONSTRAINT parties_theme_key_check CHECK (
        theme_key IN ('dpp', 'kmt', 'tpp', 'npp', 'pfp', 'tsp', 'independent', 'unknown', 'other')
    );
