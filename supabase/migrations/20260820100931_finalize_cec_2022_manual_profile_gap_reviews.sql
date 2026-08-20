do $migration$
declare
  education_reviewed_at timestamptz := '2026-08-20T10:00:03.087Z';
  empty_fields_reviewed_at timestamptz := '2026-08-20T10:03:06.517846Z';
  finalized_count integer;
  remaining_pending_count integer;
begin
  update public.person_claims as claim
  set
    claim_value = '大專',
    claim_json = jsonb_set(
      jsonb_set(
        coalesce(claim.claim_json, '{}'::jsonb),
        '{value}',
        to_jsonb('大專'::text),
        true
      ),
      '{reviewEdit}',
      jsonb_build_object(
        'version', 'internal-review-ui-profile-edit-v1',
        'reviewedAt', education_reviewed_at,
        'originalValue', '',
        'reviewedValue', '大專'
      ),
      true
    ),
    review_status = 'verified',
    visibility = 'public',
    is_public = true,
    auto_reviewed_at = education_reviewed_at,
    scoring_reasons = coalesce(claim.scoring_reasons, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'version', 'internal-review-ui-profile-edit-v1',
        'reason', 'reviewer corrected profile text before approval',
        'reviewedAt', education_reviewed_at
      ),
      jsonb_build_object(
        'version', 'internal-review-ui-v1',
        'decision', 'approve',
        'reviewedAt', education_reviewed_at
      )
    ),
    updated_at = education_reviewed_at
  where claim.claim_key = 'cec-2022-manual-profile-gap:e8ca7231-0e3b-4873-a094-08aff4842561:education'
    and claim.person_id = '9f292e7e-f6fd-4b76-ac22-e160df4c7f30'
    and claim.candidate_id = 'e8ca7231-0e3b-4873-a094-08aff4842561'
    and claim.claim_type = 'education'
    and claim.claim_value is null
    and claim.review_status = 'pending'
    and claim.source_name = '中央選舉委員會：2022年縣市議員選舉公報';

  update public.people
  set education = '大專'
  where id = '9f292e7e-f6fd-4b76-ac22-e160df4c7f30'
    and nullif(btrim(education), '') is null;

  update public.person_claims as claim
  set
    review_status = 'verified',
    visibility = 'review_only',
    is_public = false,
    auto_reviewed_at = empty_fields_reviewed_at,
    claim_json = jsonb_set(
      coalesce(claim.claim_json, '{}'::jsonb),
      '{reviewDecision}',
      jsonb_build_object(
        'version', 'internal-review-empty-official-field-v1',
        'decision', 'verified_empty',
        'reviewedAt', empty_fields_reviewed_at,
        'note', 'Official bulletin field confirmed blank by reviewer'
      ),
      true
    ),
    scoring_reasons = coalesce(claim.scoring_reasons, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'version', 'internal-review-empty-official-field-v1',
        'reason', 'official bulletin field confirmed blank',
        'reviewedAt', empty_fields_reviewed_at
      )
    ),
    updated_at = empty_fields_reviewed_at
  where claim.claim_key = any (array[
      'cec-2022-manual-profile-gap:354ec65c-1214-40fc-b613-2b5cb4b2590e:experience',
      'cec-2022-manual-profile-gap:3772a8c6-f4d5-469e-8bf2-f3c82e7ea1f5:experience',
      'cec-2022-manual-profile-gap:f4e8259d-1245-4ed4-b670-8301fb10436a:experience'
    ])
    and claim.claim_type = 'experience'
    and claim.claim_value is null
    and claim.review_status = 'pending'
    and claim.source_name = '中央選舉委員會：2022年縣市議員選舉公報';

  select count(*)
  into finalized_count
  from public.person_claims as claim
  where (
      claim.claim_key = 'cec-2022-manual-profile-gap:e8ca7231-0e3b-4873-a094-08aff4842561:education'
      and claim.person_id = '9f292e7e-f6fd-4b76-ac22-e160df4c7f30'
      and claim.candidate_id = 'e8ca7231-0e3b-4873-a094-08aff4842561'
      and claim.claim_type = 'education'
      and claim.claim_value = '大專'
      and claim.review_status = 'verified'
      and claim.visibility = 'public'
      and claim.is_public = true
    )
    or (
      claim.claim_key = any (array[
        'cec-2022-manual-profile-gap:354ec65c-1214-40fc-b613-2b5cb4b2590e:experience',
        'cec-2022-manual-profile-gap:3772a8c6-f4d5-469e-8bf2-f3c82e7ea1f5:experience',
        'cec-2022-manual-profile-gap:f4e8259d-1245-4ed4-b670-8301fb10436a:experience'
      ])
      and claim.claim_type = 'experience'
      and claim.claim_value is null
      and claim.review_status = 'verified'
      and claim.visibility = 'review_only'
      and claim.is_public = false
      and claim.claim_json #>> '{reviewDecision,decision}' = 'verified_empty'
    );

  if finalized_count <> 4 then
    raise exception 'Expected four finalized CEC 2022 profile gap reviews, found %', finalized_count;
  end if;

  select count(*)
  into remaining_pending_count
  from public.person_claims
  where claim_key like 'cec-2022-manual-profile-gap:%'
    and review_status in ('pending', 'needs_more_evidence');

  if remaining_pending_count <> 0 then
    raise exception 'Expected no pending CEC 2022 profile gap reviews, found %', remaining_pending_count;
  end if;

  if not exists (
    select 1
    from public.people
    where id = '9f292e7e-f6fd-4b76-ac22-e160df4c7f30'
      and education = '大專'
  ) then
    raise exception 'Expected 周陳曉玟 education to be 大專';
  end if;
end
$migration$;

select published.promote();
