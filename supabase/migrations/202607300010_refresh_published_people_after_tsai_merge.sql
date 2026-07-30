BEGIN;

SELECT public.refresh_public_people_list_cached();
SELECT published.promote(NULL);

COMMIT;
