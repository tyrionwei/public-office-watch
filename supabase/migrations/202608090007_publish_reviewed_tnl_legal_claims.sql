BEGIN;

CREATE TEMP TABLE _tnl_legal_release_targets (
    claim_key TEXT PRIMARY KEY,
    person_id UUID NOT NULL
) ON COMMIT DROP;

INSERT INTO _tnl_legal_release_targets (claim_key, person_id)
SELECT claim.claim_key, claim.person_id
FROM person_claims claim
WHERE claim.claim_type = 'legal_case'
  AND claim.claim_json->>'sourceId' IN (
      'independent-2018-legal-outcome-research',
      'independent-legal-research-batch-2',
      'remaining-independent-legal-source-research',
      'supported-relative-and-campaign-worker-research',
      'supported-third-party-election-event-research',
      'tnl-dark-guide-independent-legal-research',
      'user-reviewed-independent-legal-research'
  );

UPDATE _tnl_legal_release_targets target
SET person_id = mapping.canonical_person_id
FROM person_canonical_map mapping
WHERE mapping.person_id = target.person_id
  AND mapping.merge_status = 'verified'
  AND mapping.canonical_person_id <> target.person_id;

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _tnl_legal_release_targets) <> 137 THEN
        RAISE EXCEPTION 'Expected exactly 137 reviewed TNL legal claims';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM person_claims claim
        JOIN _tnl_legal_release_targets target USING (claim_key)
        WHERE claim.review_status <> 'verified'
           OR claim.confidence_level NOT IN ('A', 'B')
           OR claim.review_score < 70
           OR claim.source_url IS NULL
           OR claim.source_url !~ '^https://'
           OR claim.claim_json->>'caseStage' IS NULL
           OR NOT EXISTS (
               SELECT 1
               FROM jsonb_array_elements(COALESCE(claim.claim_json->'evidenceSources', '[]'::jsonb)) evidence
               WHERE COALESCE(evidence->>'url', '') ~ '^https://'
           )
    ) THEN
        RAISE EXCEPTION 'Reviewed TNL legal release contains a claim that fails the public safety gate';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _tnl_legal_release_targets target
        LEFT JOIN people person ON person.id = target.person_id
        WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'Reviewed TNL legal release targets a missing or private person';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM person_claims existing
        JOIN _tnl_legal_release_targets target
          ON target.person_id = existing.person_id
         AND target.claim_key <> existing.claim_key
        JOIN person_claims incoming ON incoming.claim_key = target.claim_key
        WHERE existing.review_status = 'verified'
          AND existing.visibility = 'public'
          AND existing.is_public = TRUE
          AND regexp_replace(existing.claim_value, '\s+', '', 'g')
              = regexp_replace(incoming.claim_value, '\s+', '', 'g')
    ) THEN
        RAISE EXCEPTION 'Reviewed TNL legal release duplicates an existing public legal claim';
    END IF;
END
$$;

UPDATE person_claims claim
SET person_id = target.person_id,
    visibility = 'public',
    is_public = TRUE,
    claim_json = jsonb_set(
        jsonb_set(
            claim.claim_json,
            '{legalCasePublicEligible}',
            'true'::jsonb,
            true
        ),
        '{publicationGate}',
        COALESCE(claim.claim_json->'publicationGate', '{}'::jsonb)
            || jsonb_build_object(
                'status', 'published',
                'requiresHumanApproval', false,
                'approvedBy', 'project_owner',
                'approvedAt', '2026-08-09T00:00:00+08:00',
                'sourceLinkRequired', true,
                'stageDisclosureRequired', true
            ),
        true
    ),
    updated_at = NOW()
FROM _tnl_legal_release_targets target
WHERE claim.claim_key = target.claim_key
  AND (
      claim.visibility IS DISTINCT FROM 'public'
      OR claim.is_public IS DISTINCT FROM TRUE
      OR claim.claim_json->>'legalCasePublicEligible' IS DISTINCT FROM 'true'
      OR claim.claim_json->'publicationGate'->>'status' IS DISTINCT FROM 'published'
  );

REFRESH MATERIALIZED VIEW public.public_people_list_cached;

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM person_claims claim
        JOIN _tnl_legal_release_targets target USING (claim_key)
        WHERE claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public = TRUE
          AND claim.claim_json->>'legalCasePublicEligible' = 'true'
          AND claim.claim_json->'publicationGate'->>'status' = 'published'
          AND claim.claim_json->'publicationGate'->>'requiresHumanApproval' = 'false'
          AND claim.claim_json->'publicationGate'->>'sourceLinkRequired' = 'true'
          AND claim.claim_json->'publicationGate'->>'stageDisclosureRequired' = 'true'
    ) <> 137 THEN
        RAISE EXCEPTION 'Reviewed TNL legal release final claim verification failed';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM public_person_claims public_claim
        JOIN person_claims claim ON claim.id = public_claim.claim_id
        JOIN _tnl_legal_release_targets target USING (claim_key)
    ) <> 137 THEN
        RAISE EXCEPTION 'Reviewed TNL legal claims are not fully exposed by public_person_claims';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _tnl_legal_release_targets target
        WHERE NOT EXISTS (
            SELECT 1
            FROM public_people_list_cached cached
            WHERE cached.person_id = target.person_id
        )
    ) THEN
        RAISE EXCEPTION 'A reviewed TNL legal claim is missing its public person profile cache';
    END IF;
END
$$;

COMMIT;
