BEGIN;

CREATE TEMP TABLE _duplicate_2018_legal_research_ids (
    claim_key TEXT NOT NULL,
    research_id TEXT PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO _duplicate_2018_legal_research_ids VALUES
('research:tnl-dark-guide-legal:eeea0ead346b5447', 'tnl-dark-guide-2018-txg-17-37-涉案紀錄-1'),
('research:tnl-dark-guide-legal:e268937402f0f4a2', 'tnl-dark-guide-2018-khh-8-53-涉案紀錄-1'),
('research:tnl-dark-guide-legal:a5eeabc45e865d8a', 'tnl-dark-guide-2018-tao-1-61-涉案紀錄-1'),
('research:tnl-dark-guide-legal:2c9be2c533dd6bb4', 'tnl-dark-guide-2018-nwt-4-50-涉案紀錄-1'),
('research:tnl-dark-guide-legal:f1eb9d30438f4be3', 'tnl-dark-guide-2018-tpe-1-12-涉案紀錄-1'),
('research:tnl-dark-guide-legal:6141bd9c513df961', 'tnl-dark-guide-2018-nwt-5-47-涉案紀錄-1'),
('research:tnl-dark-guide-legal:3cc4e7ed172d2e03', 'tnl-dark-guide-2018-tnn-6-43-涉案紀錄-1'),
('research:tnl-dark-guide-legal:5aec1265ee452578', 'tnl-dark-guide-2018-khh-2-58-涉案紀錄-1'),
('research:tnl-dark-guide-legal:8e8df1a6fc2cf99c', 'tnl-dark-guide-2018-tpe-1-14-涉案紀錄-1'),
('research:tnl-dark-guide-legal:f542fd707ae91872', 'tnl-dark-guide-2018-khh-5-96-涉案紀錄-1'),
('research:tnl-dark-guide-legal:80e12c1dc692548d', 'tnl-dark-guide-2018-khh-10-56-涉案紀錄-1'),
('research:tnl-dark-guide-legal:8c6933702f87336a', 'tnl-dark-guide-2018-txg-15-39-涉案紀錄-1'),
('research:tnl-dark-guide-legal:5a06d6bd4d878c63', 'tnl-dark-guide-2018-tao-4-41-涉案紀錄-1'),
('research:tnl-dark-guide-legal:3e1f475acb9d9368', 'tnl-dark-guide-2018-nwt-7-57-涉案紀錄-1'),
('research:tnl-dark-guide-legal:82b9147f10199654', 'tnl-dark-guide-2018-nwt-1-52-涉案紀錄-1'),
('research:tnl-dark-guide-legal:db114cb21845b476', 'tnl-dark-guide-2018-tao-10-54-涉案紀錄-1');

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _duplicate_2018_legal_research_ids) <> 16 THEN
        RAISE EXCEPTION 'Expected exactly 16 duplicate 2018 legal research ids';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _duplicate_2018_legal_research_ids mapping
        LEFT JOIN person_claims claim ON claim.claim_key = mapping.claim_key
        WHERE claim.claim_key IS NULL
          OR claim.claim_type <> 'legal_case'
          OR claim.review_status <> 'verified'
          OR claim.visibility <> 'review_only'
          OR claim.is_public IS DISTINCT FROM FALSE
    ) THEN
        RAISE EXCEPTION 'A duplicate 2018 research id targets a missing or ineligible legal claim';
    END IF;
END
$$;

UPDATE person_claims claim
SET claim_json = jsonb_set(
        claim.claim_json,
        '{researchIds}',
        COALESCE(claim.claim_json->'researchIds', '[]'::jsonb) || jsonb_build_array(mapping.research_id),
        TRUE
    ),
    updated_at = NOW()
FROM _duplicate_2018_legal_research_ids mapping
WHERE claim.claim_key = mapping.claim_key
  AND NOT COALESCE(claim.claim_json->'researchIds', '[]'::jsonb) ? mapping.research_id;

DO $$
BEGIN
    IF (
        SELECT COUNT(*) FROM _duplicate_2018_legal_research_ids mapping
        JOIN person_claims claim ON claim.claim_key = mapping.claim_key
        WHERE claim.claim_json->'researchIds' ? mapping.research_id
    ) <> 16 THEN
        RAISE EXCEPTION 'Duplicate 2018 legal research id linkage guard failed';
    END IF;
END
$$;

COMMIT;
