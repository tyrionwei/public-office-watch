-- These four 2012 records were checked individually against CEC or Legislative
-- Yuan records because the historical import contains incorrect district labels.

WITH reviewed_matches (source_person_id, person_id, source_url) AS (
  VALUES
    (
      'b9442f5f-bf7d-4c3d-a490-5ec87223608b'::UUID,
      '8bd0900a-154a-4d3d-9cd6-ff67fefa39f4'::UUID,
      'https://www.ly.gov.tw/EngPages/Detail.aspx?nodeid=12352&pid=158233'
    ),
    (
      'e611ca05-a9ad-43ce-9f4a-b2a8f1cb2b74'::UUID,
      '4f1f31ff-5180-4d96-94e6-1de8d5ed408a'::UUID,
      'https://db.cec.gov.tw/ElecTable/Election/ElecTickets?areaCode=00&cityCode=010&dataLevel=A&dataType=tickets&deptCode=000&legisId=L1&liCode=0000&prvCode=06&subjectId=L0&themeId=081e3c257ceca0979fd3f92797ce4b8a&typeId=ELC'
    ),
    (
      '88933019-104d-451d-b515-b86973d3f43c'::UUID,
      '36defbff-0205-4687-bc82-8416184cab3e'::UUID,
      'https://db.cec.gov.tw/Candidate/?cand_name=%E9%BB%83%E7%8F%8A%E7%8F%8A&is_current=false&page=1'
    ),
    (
      '8707eb9c-7e8d-408b-9029-6f60fc5f695d'::UUID,
      '7eb8e4fd-ebfc-49e4-b6eb-20147f22571f'::UUID,
      'https://web.cec.gov.tw/api/file/15c13b76-23b8-47c0-9970-183e0dcc8733.pdf'
    )
)
INSERT INTO person_identity_matches (
  source_person_id,
  person_id,
  match_status,
  score,
  match_method,
  match_reason,
  evidence_json,
  reviewed_by,
  reviewed_at,
  updated_at
)
SELECT
  reviewed.source_person_id,
  reviewed.person_id,
  'auto_matched',
  100,
  'manual_official_record_review',
  '2012 candidacy and later canonical profile confirmed as the same person using an official record',
  jsonb_build_object(
    'version', 'manual-official-record-review-v1',
    'sourceUrl', reviewed.source_url,
    'note', 'historical source district labels are not treated as identity evidence'
  ),
  'system:official-record-review',
  NOW(),
  NOW()
FROM reviewed_matches AS reviewed
ON CONFLICT (source_person_id, person_id) DO UPDATE
SET
  match_status = EXCLUDED.match_status,
  score = EXCLUDED.score,
  match_method = EXCLUDED.match_method,
  match_reason = EXCLUDED.match_reason,
  evidence_json = EXCLUDED.evidence_json,
  reviewed_by = EXCLUDED.reviewed_by,
  reviewed_at = EXCLUDED.reviewed_at,
  updated_at = EXCLUDED.updated_at;

WITH reviewed_sources (source_person_id) AS (
  VALUES
    ('b9442f5f-bf7d-4c3d-a490-5ec87223608b'::UUID),
    ('e611ca05-a9ad-43ce-9f4a-b2a8f1cb2b74'::UUID),
    ('88933019-104d-451d-b515-b86973d3f43c'::UUID),
    ('8707eb9c-7e8d-408b-9029-6f60fc5f695d'::UUID)
)
UPDATE source_people AS source_person
SET
  is_public = TRUE,
  updated_at = NOW()
FROM reviewed_sources AS reviewed
WHERE source_person.id = reviewed.source_person_id;
