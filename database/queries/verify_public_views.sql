SELECT COUNT(*) FROM public_people;

SELECT COUNT(*) FROM public_companies;

SELECT COUNT(*) FROM public_relation_details;

SELECT *
FROM public_relation_details
ORDER BY relation_updated_at DESC
LIMIT 20;

SELECT COUNT(*)
FROM relation_candidates
WHERE review_status = 'pending';

SELECT COUNT(*)
FROM person_company_relations
WHERE verification_status = 'verified'
  AND is_public = TRUE;
