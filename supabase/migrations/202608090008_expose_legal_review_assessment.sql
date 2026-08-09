ALTER TABLE legal_record_leads
    DROP CONSTRAINT IF EXISTS legal_record_leads_source_type_check;

ALTER TABLE legal_record_leads
    ADD CONSTRAINT legal_record_leads_source_type_check CHECK (
        source_type IN (
            'court_document',
            'judicial_api',
            'government_open_data',
            'media_guide',
            'media_report',
            'other'
        )
    );

CREATE OR REPLACE VIEW legal_record_review_queue AS
SELECT
    l.id AS lead_id,
    l.lead_key,
    l.source_type,
    l.source_name,
    l.source_url,
    l.court_name,
    l.case_year,
    l.case_code,
    l.case_number,
    l.judgment_date,
    l.case_type,
    l.reason,
    l.title,
    l.summary,
    l.raw_name,
    l.normalized_name,
    l.matched_person_id AS person_id,
    p.name AS person_name,
    p.party AS person_party,
    p.position AS person_position,
    p.district AS person_district,
    l.match_score,
    l.match_status,
    l.confidence_level,
    l.review_status,
    l.review_note,
    l.updated_at,
    (l.source_payload #>> '{reviewAssessment,identityScore}')::NUMERIC AS identity_score,
    (l.source_payload #>> '{reviewAssessment,caseEvidenceScore}')::NUMERIC AS case_evidence_score,
    l.source_payload #>> '{reviewAssessment,decision}' AS review_decision,
    l.source_payload -> 'candidatePersonIds' AS candidate_person_ids,
    l.source_payload -> 'reviewEvidence' AS review_evidence
FROM legal_record_leads l
LEFT JOIN people p ON p.id = l.matched_person_id
WHERE l.review_status IN ('pending', 'needs_more_evidence')
  AND l.is_public = FALSE
ORDER BY l.match_score DESC, l.updated_at DESC;

COMMENT ON VIEW legal_record_review_queue IS
    'Private criminal-record review queue with separate identity and case-evidence scores. Auto-verification never implies public release.';
