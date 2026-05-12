SELECT COUNT(*) FROM raw_source_records;
SELECT COUNT(*) FROM source_documents;
SELECT COUNT(*) FROM relation_candidates;
SELECT * FROM relation_candidates ORDER BY created_at DESC LIMIT 20;

SELECT COUNT(*)
FROM person_company_relations
WHERE verification_status = 'verified'
   OR is_public = TRUE;
