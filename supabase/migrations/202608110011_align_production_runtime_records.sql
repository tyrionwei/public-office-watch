BEGIN;

UPDATE public.elections
SET name = CASE year
        WHEN 2005 THEN '2005年縣市議員選舉'
        WHEN 2006 THEN '2006年直轄市議員選舉'
        WHEN 2009 THEN '2009年縣市議員選舉'
        WHEN 2010 THEN '2010年直轄市議員選舉'
    END,
    updated_at = NOW()
WHERE election_type = 'councilor'
  AND (
      (year = 2005 AND voting_date = DATE '2005-12-03')
      OR (year = 2006 AND voting_date = DATE '2006-12-09')
      OR (year = 2009 AND voting_date = DATE '2009-12-05')
      OR (year = 2010 AND voting_date = DATE '2010-11-27')
  )
  AND name = year::TEXT || '年直轄市及縣市議員選舉';

UPDATE public.person_claims claim
SET person_id = canonical_map.canonical_person_id,
    updated_at = NOW()
FROM public.person_canonical_map canonical_map
WHERE claim.claim_key LIKE 'research:tnl-dark-guide-family:%'
  AND canonical_map.person_id = claim.person_id
  AND claim.person_id IS DISTINCT FROM canonical_map.canonical_person_id;

-- The Taichung TPP candidate and the Pingtung KMT candidate are different
-- people with the same Chinese name. The compact production map predates the
-- completed identity review and must not collapse the Taichung candidate.
UPDATE public.person_merge_decisions
SET status = 'rejected',
    confidence_level = 'A',
    reason = '同名但不同人：2022 年分屬屏東縣國民黨區域候選人與臺中市民眾黨平地原住民候選人。',
    evidence_json = jsonb_build_object(
        'externalId', 'wikidata:q115116444',
        'correctionReason', 'same-year conflicting city, party and constituency',
        'correctionVersion', 'recent-high-risk-identity-audit-v1',
        'officialPingtungSource', 'https://web.cec.gov.tw/api/file/264bae70-6716-4111-b4bc-fb6981e25249.pdf',
        'officialTaichungSource', 'https://www.tpp.org.tw/newsdetail/2041'
    ),
    reviewed_by = 'system:recent-high-risk-identity-audit',
    reviewed_at = NOW(),
    updated_at = NOW()
WHERE duplicate_person_id = 'd87a57f2-becb-4be7-8272-3a1337ef3845'
  AND canonical_person_id = '505f6c1e-6e82-40e0-ac7e-952755bd0dc5'
  AND status IS DISTINCT FROM 'rejected';

-- These two reviewed family claims are deliberate same-name exceptions. Apply
-- them after the generic canonical map so a stale production-only map cannot
-- reassign either claim to a different person with the same Chinese name.
UPDATE public.person_claims
SET person_id = '9d8e00d6-5386-4449-86e4-9c5c938c561a',
    updated_at = NOW()
WHERE claim_key = 'research:tnl-dark-guide-family:450cdf0cdc813aa4'
  AND person_id IS DISTINCT FROM '9d8e00d6-5386-4449-86e4-9c5c938c561a';

UPDATE public.person_claims
SET person_id = 'd87a57f2-becb-4be7-8272-3a1337ef3845',
    updated_at = NOW()
WHERE claim_key = 'research:tnl-dark-guide-family:f442ee890eed3f95'
  AND person_id IS DISTINCT FROM 'd87a57f2-becb-4be7-8272-3a1337ef3845';

UPDATE public.person_claims claim
SET claim_json = jsonb_set(
        claim.claim_json,
        '{relativePersonId}',
        to_jsonb(canonical_map.canonical_person_id::TEXT),
        false
    ),
    updated_at = NOW()
FROM public.person_canonical_map canonical_map
WHERE claim.claim_key LIKE 'research:tnl-dark-guide-family:%'
  AND claim.claim_json->>'relativePersonId' = canonical_map.person_id::TEXT
  AND canonical_map.person_id IS DISTINCT FROM canonical_map.canonical_person_id;

SELECT public.refresh_public_people_list_cached();
SELECT published.promote(NULL);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.elections
        WHERE year < 2014
          AND (
              name LIKE '%九合一%'
              OR name LIKE '%地方公職人員選舉%'
              OR name LIKE '%直轄市及縣市%'
          )
    ) THEN
        RAISE EXCEPTION 'A pre-2014 election still uses a combined election label';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM published.candidate_facts
        WHERE election_year < 2014
          AND (
              election_name LIKE '%九合一%'
              OR election_name LIKE '%地方公職人員選舉%'
              OR election_name LIKE '%直轄市及縣市%'
          )
    ) THEN
        RAISE EXCEPTION 'Published candidate facts still use a combined election label';
    END IF;

    IF (SELECT COUNT(*) FROM public.person_claims WHERE claim_key LIKE 'research:tnl-dark-guide-family:%') <> 174 THEN
        RAISE EXCEPTION 'TNL family claim count drift after production alignment';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.person_claims
        WHERE claim_key = 'research:tnl-dark-guide-family:450cdf0cdc813aa4'
          AND person_id = '9d8e00d6-5386-4449-86e4-9c5c938c561a'
    ) THEN
        RAISE EXCEPTION 'Sung Yu-chen family claim production alignment failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.person_claims
        WHERE claim_key = 'research:tnl-dark-guide-family:f442ee890eed3f95'
          AND person_id = 'd87a57f2-becb-4be7-8272-3a1337ef3845'
    ) THEN
        RAISE EXCEPTION 'Hung Chih-ming family claim production alignment failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.person_canonical_map
        WHERE person_id = 'd87a57f2-becb-4be7-8272-3a1337ef3845'
          AND canonical_person_id = 'd87a57f2-becb-4be7-8272-3a1337ef3845'
    ) THEN
        RAISE EXCEPTION 'Hung Chih-ming production canonical map remains cross-person';
    END IF;
END
$$;

COMMIT;
