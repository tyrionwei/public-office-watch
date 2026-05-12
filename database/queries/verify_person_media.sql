SELECT COUNT(*) FROM person_media;

SELECT *
FROM public_person_primary_photos
LIMIT 20;

SELECT person_id, name, primary_photo_url, photo_license_type
FROM public_people
WHERE primary_photo_url IS NOT NULL
LIMIT 20;

SELECT candidate_id, person_name, primary_photo_url, photo_license_type
FROM public_candidates
WHERE primary_photo_url IS NOT NULL
LIMIT 20;

SELECT COUNT(*)
FROM person_media
WHERE is_public = TRUE
  AND verification_status <> 'verified';

SELECT COUNT(*)
FROM person_media
WHERE is_public = TRUE
  AND license_type = 'unknown';
