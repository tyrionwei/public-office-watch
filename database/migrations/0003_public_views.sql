CREATE VIEW public_people AS
SELECT
    id AS person_id,
    name,
    alias,
    party,
    position,
    election_year,
    district,
    updated_at
FROM people
WHERE is_public = TRUE;

CREATE VIEW public_companies AS
SELECT
    id AS company_id,
    unified_business_no,
    name,
    representative_name,
    status,
    capital,
    address_region,
    updated_at
FROM companies
WHERE is_public = TRUE;

CREATE VIEW public_relation_details AS
SELECT
    r.id AS relation_id,
    p.id AS person_id,
    p.name AS person_name,
    p.party AS person_party,
    p.position AS person_position,
    p.district AS person_district,
    c.id AS company_id,
    c.name AS company_name,
    c.unified_business_no,
    r.relation_type,
    r.confidence_level,
    r.evidence_text,
    sd.id AS source_document_id,
    sd.source_name,
    sd.source_url,
    r.verification_status,
    r.created_at AS relation_created_at,
    r.updated_at AS relation_updated_at
FROM person_company_relations r
JOIN people p ON p.id = r.person_id
JOIN companies c ON c.id = r.company_id
LEFT JOIN source_documents sd ON sd.id = r.evidence_source_id AND sd.is_public = TRUE
WHERE r.verification_status = 'verified'
  AND r.is_public = TRUE
  AND p.is_public = TRUE
  AND c.is_public = TRUE;
