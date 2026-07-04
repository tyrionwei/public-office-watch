UPDATE person_claims
SET
    confidence_level = 'B',
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    auto_reviewed_at = COALESCE(auto_reviewed_at, NOW()),
    updated_at = NOW(),
    scoring_version = 'votetw-public-claims-20260704',
    scoring_reasons = jsonb_build_array(
        'VoteTW historical election result claims are source-attributed public election facts.'
    )
WHERE source_name = 'VoteTW historical election results'
  AND review_status = 'pending'
  AND visibility = 'review_only'
  AND claim_type IN (
      'name',
      'party',
      'position',
      'district',
      'external_id'
  );

UPDATE person_claims
SET
    confidence_level = 'C',
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    auto_reviewed_at = COALESCE(auto_reviewed_at, NOW()),
    updated_at = NOW(),
    scoring_version = 'votetw-public-claims-20260704',
    scoring_reasons = jsonb_build_array(
        'VoteTW profile enrichment is public and source-attributed, but not official; sensitive legal claims remain review-only.'
    )
WHERE source_name = 'VoteTW'
  AND review_status = 'pending'
  AND visibility = 'review_only'
  AND claim_type IN (
      'external_id',
      'birth_date',
      'gender',
      'party_affiliation',
      'education',
      'experience'
  );
