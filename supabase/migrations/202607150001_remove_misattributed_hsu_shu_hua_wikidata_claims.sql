DELETE FROM person_claims
WHERE person_id = 'e34c3d98-dbf0-433e-bbd3-4b0a7e7f3ce4'
  AND source_name = 'Wikidata 人物補充資料'
  AND claim_json->>'wikidataQid' = 'Q18659220';
