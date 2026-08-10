SET statement_timeout = 0;

BEGIN;

-- The two tied candidates were not the only candidates in these races. Keep
-- the CEC election-day percentages instead of recalculating against only the
-- tied pair while retaining the post-draw winner flags from the preceding
-- reconciliation.
UPDATE candidates
SET
    vote_rate = 47.3700,
    updated_at = NOW()
WHERE id IN (
    '59d17f07-88c6-4dfc-853b-5ce5bac5ccaa',
    'd2889206-2590-4b95-8999-00560ab543b1'
);

UPDATE candidates
SET
    vote_rate = 49.6000,
    updated_at = NOW()
WHERE id IN (
    'eac3993d-722a-482c-8062-fd917079a160',
    '1adb587d-3ecc-4fbf-8b4f-f6f0df84820f'
);

SELECT published.promote(NULL);

DO $verify_vote_rates$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM candidates
        WHERE id IN (
            '59d17f07-88c6-4dfc-853b-5ce5bac5ccaa',
            'd2889206-2590-4b95-8999-00560ab543b1'
        )
          AND vote_rate = 47.3700
    ) <> 2 OR (
        SELECT COUNT(*)
        FROM candidates
        WHERE id IN (
            'eac3993d-722a-482c-8062-fd917079a160',
            '1adb587d-3ecc-4fbf-8b4f-f6f0df84820f'
        )
          AND vote_rate = 49.6000
    ) <> 2 THEN
        RAISE EXCEPTION 'Multi-candidate tie vote-rate preservation failed';
    END IF;
END
$verify_vote_rates$;

COMMIT;

RESET statement_timeout;
