-- 信任邊界是既有 verified 審核寫入權限；JSON 標記本身不是新增的核准權限。
-- 已審核的本屆官方登記可完成來源對帳，不建立可供跨屆匯入使用的人物配對。
-- 沿用既有私人 view 的欄位與 ACL；來源、原件內容或歸戶漂移時重新列入待核。
CREATE OR REPLACE VIEW public.identity_unmatched_source_people AS
WITH reviewed_registration_scope AS MATERIALIZED (
    SELECT DISTINCT source_person_id
    FROM public.person_claims
    WHERE claim_type = 'candidacy'
      AND claim_json->'registrationFactAdoption20261008'->>'decision' = 'verified_official_registration_fact'
), confirmed_sources AS MATERIALIZED (
    SELECT DISTINCT source_person_id
    FROM public.person_identity_matches WHERE match_status = 'auto_matched'
), resolved_registration_sources AS MATERIALIZED (
    SELECT DISTINCT source.id
    FROM public.source_people source
    JOIN reviewed_registration_scope scoped ON scoped.source_person_id = source.id
    JOIN public.person_claims claim ON claim.source_person_id = source.id
    JOIN public.candidates candidate ON candidate.id = claim.candidate_id
    JOIN public.people person ON person.id = claim.person_id
    JOIN public.races race ON race.id = candidate.race_id
    JOIN public.elections election ON election.id = race.election_id
    JOIN public.person_canonical_map canonical ON canonical.person_id = person.id
        AND canonical.canonical_person_id = person.id
    WHERE source.source_type = 'official_election'
      AND claim.claim_type = 'candidacy'
      AND claim.review_status = 'verified'
      AND claim.visibility = 'review_only' AND claim.is_public = false
      AND candidate.person_id = person.id
      AND source.election_year = 2026 AND election.year = 2026
      AND candidate.external_id ~ '^pow-cec-registration-2026-[a-f0-9]{32}$'
      AND source.external_person_id = replace(candidate.external_id, 'pow-cec-registration-2026-', 'pow-cec-registration-person-2026-')
      AND race.race_type NOT IN ('village_chief', 'township_representative', 'township_representative_district')
      AND source.external_record_id = candidate.external_id
      AND source.source_person_key = 'official-candidate:' || candidate.external_id
      AND claim.claim_key = 'official-candidacy:' || candidate.external_id
      AND claim.claim_json->>'candidateExternalId' = candidate.external_id
      AND source.external_person_id = claim.claim_json->>'personExternalId'
      AND source.external_person_id = source.source_id
      AND source.source_url = claim.source_url
      AND source.source_url = candidate.source_url
      AND source.source_url ~ '^https://web[.]cec[.]gov[.]tw/api/file/[^/]+[.](pdf|xlsx)$'
      AND source.raw_name = person.name AND source.raw_name = candidate.candidate_name
      AND source.source_payload->>'candidateExternalId' = candidate.external_id
      AND source.source_payload->>'personExternalId' = source.external_person_id
      AND source.source_payload->>'candidacyStatus' = 'registered'
      AND claim.claim_json->>'candidacyStatus' = 'registered'
      AND source.source_payload->'targetRace'->>'id' = race.id::text
      AND claim.claim_json->'targetRace'->>'id' = race.id::text
      AND source.source_payload->'registrationEvidence' = claim.claim_json->'registrationEvidence'
      AND claim.claim_json->'registrationEvidence'->>'name' = source.raw_name
      AND claim.claim_json->'registrationEvidence'->>'status' = 'registered'
      AND claim.claim_json->'registrationEvidence'->'source'->>'url' = source.source_url
      AND claim.claim_json->'registrationEvidence'->'source'->>'sha256' ~ '^[a-f0-9]{64}$'
      AND claim.claim_json->'registrationEvidence'->>'registration_date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      AND pg_input_is_valid(claim.claim_json->'registrationEvidence'->>'registration_date', 'date')
      AND left(claim.claim_json->'registrationEvidence'->>'registration_date', 4) = election.year::text
      -- 這是已保存的逐筆登記事實審核，不接受僅姓名相同或來源建議。
      AND claim.claim_json->'registrationFactAdoption20261008'->>'decision' = 'verified_official_registration_fact'
      AND claim.claim_json->'registrationFactAdoption20261008'->'claimPublic' = 'false'::jsonb
      AND claim.claim_json->'registrationFactAdoption20261008'->'qualificationConfirmed' = 'false'::jsonb
      AND claim.claim_json->'registrationFactAdoption20261008'->>'personId' = person.id::text
      AND claim.claim_json->'registrationFactAdoption20261008'->>'candidateId' = candidate.id::text
      AND claim.claim_json->'registrationFactAdoption20261008'->>'sourceUrl' = source.source_url
      AND claim.claim_json->'registrationFactAdoption20261008'->>'sourceHash' = claim.claim_json->'registrationEvidence'->'source'->>'sha256'
      AND claim.claim_json->'registrationFactAdoption20261008'->>'registrationDate' = claim.claim_json->'registrationEvidence'->>'registration_date'
      AND COALESCE(claim.claim_json->'identityAudit'->>'status', '') NOT IN ('pending', 'quarantined')
      -- 本屆登記事實可成立，跨來源同名歧義仍須保留在來源待核清單。
      -- 缺欄位沿用既有語意；明確 false、null 或異常型別均不得結案。
      AND (NOT (claim.claim_json ? 'privateRegistrationBinding20261008')
           OR jsonb_typeof(claim.claim_json->'privateRegistrationBinding20261008') = 'object')
      AND COALESCE(claim.claim_json->'privateRegistrationBinding20261008'->'crossSourceIdentityResolved', 'true'::jsonb) = 'true'::jsonb
      AND COALESCE(claim.claim_json->'privateRegistrationBinding20261008'->'sameBatchIdentityResolved', 'true'::jsonb) = 'true'::jsonb
      AND NOT EXISTS (
          SELECT 1 FROM public.person_claims sibling
          WHERE sibling.source_person_id = source.id AND sibling.claim_type = 'candidacy'
            AND sibling.id <> claim.id
      )
      AND NOT EXISTS (
          SELECT 1 FROM public.candidates other
          WHERE other.id <> candidate.id AND (
              other.external_id = candidate.external_id OR
              (other.person_id = person.id AND other.race_id = race.id)
          )
      )
      AND NOT EXISTS (
          SELECT 1 FROM public.person_identity_matches conflict
          WHERE conflict.source_person_id = source.id
            AND (conflict.reviewed_at IS NOT NULL OR conflict.match_status IN ('auto_matched', 'rejected_match'))
            AND (conflict.person_id IS DISTINCT FROM person.id OR conflict.match_status <> 'auto_matched')
      )
)
SELECT
    sp.id AS source_person_id, sp.source_person_key, sp.source_type,
    sp.source_name, sp.source_url, sp.raw_name, sp.normalized_name,
    sp.party, sp.position, sp.district, sp.election_year, sp.confidence_suggestion,
    COALESCE(MAX(m.score), 0) AS best_match_score,
    COALESCE(MIN(m.match_status) FILTER (WHERE m.match_status IN ('probable_match', 'possible_match')), 'unmatched') AS review_status,
    sp.updated_at
FROM public.source_people sp
LEFT JOIN public.person_identity_matches m ON m.source_person_id = sp.id
LEFT JOIN reviewed_registration_scope scope ON scope.source_person_id = sp.id
LEFT JOIN resolved_registration_sources resolved ON resolved.id = sp.id
LEFT JOIN confirmed_sources confirmed ON confirmed.source_person_id = sp.id
-- 本屆登記衝突優先；集合各算一次，避免逐來源重掃主張。
WHERE (scope.source_person_id IS NOT NULL AND resolved.id IS NULL)
   OR (scope.source_person_id IS NULL AND confirmed.source_person_id IS NULL)
GROUP BY sp.id;
