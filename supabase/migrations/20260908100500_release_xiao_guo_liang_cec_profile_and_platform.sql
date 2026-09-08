BEGIN;

DO $replace$
DECLARE affected_count INTEGER;
BEGIN
  UPDATE public.people
  SET source_url='https://eebulletin.cec.gov.tw/111/14%E5%B1%8F%E6%9D%B1%E7%B8%A3/04%E9%84%89%E9%8E%AE%E5%B8%82%E6%B0%91%E4%BB%A3%E8%A1%A8/%E5%B1%8F%E6%9D%B1%E5%B8%82/%E5%B1%8F%E6%9D%B1%E5%B8%82%E9%95%B7%E5%B8%82%E6%B0%91%E4%BB%A3%E8%A1%A8%E7%AC%AC%E5%9B%9B%E9%81%B8%E8%88%89%E5%8D%80.pdf',
      gender='male',
      education='高中畢業',
      experience=E'屏東市第16屆大鵬里里長\n第16屆市民代表\n第17屆市民代表\n第18屆市民代表\n第19屆市民代表會主席',
      updated_at=pg_catalog.now()
  WHERE id='393996c0-60b0-4889-851f-7d4c68f25af9'::UUID
    AND name='蕭國亮'
    AND external_id='votetw-person-491f9d88d3f8c054'
    AND source_url='https://votetw.com/wiki/%E8%95%AD%E5%9C%8B%E4%BA%AE'
    AND gender='unknown'
    AND COALESCE(education,'')=''
    AND COALESCE(experience,'')='';
  GET DIAGNOSTICS affected_count=ROW_COUNT;
  IF affected_count<>1 THEN RAISE EXCEPTION 'Expected one Xiao Guo-liang 2022 person update, found %',affected_count; END IF;

  UPDATE public.candidates
  SET source_name='中央選舉委員會選舉資料庫',
      source_url='https://web.cec.gov.tw/api/file/54edd7dd-637b-41d4-a695-fc9cff9654e1.pdf',
      updated_at=pg_catalog.now()
  WHERE id='8a08cdd3-d6b7-4968-815a-fd4c429ba75a'::UUID
    AND person_id='393996c0-60b0-4889-851f-7d4c68f25af9'::UUID
    AND external_id='votetw-candidate-22f7827d2aece77b'
    AND candidate_no='5'
    AND party='中國國民黨'
    AND source_name='VoteTW historical election results'
    AND source_url='https://votetw.com/wiki/2022%E5%B9%B4%E5%B1%8F%E6%9D%B1%E7%B8%A3%E5%B1%8F%E6%9D%B1%E5%B8%82%E5%B8%82%E6%B0%91%E4%BB%A3%E8%A1%A8%E9%81%B8%E8%88%89%E6%8A%95%E7%A5%A8%E7%B5%90%E6%9E%9C'
    AND vote_count=2341
    AND is_elected IS TRUE;
  GET DIAGNOSTICS affected_count=ROW_COUNT;
  IF affected_count<>1 THEN RAISE EXCEPTION 'Expected one Xiao Guo-liang 2022 candidate source replacement, found %',affected_count; END IF;

  UPDATE public.person_claims
  SET claim_key='official-platform:cec-2022-bulletin:xiao-guo-liang',
      person_id='393996c0-60b0-4889-851f-7d4c68f25af9'::UUID,
      candidate_id='8a08cdd3-d6b7-4968-815a-fd4c429ba75a'::UUID,
      claim_value=E'每一件市民朋友的請託都全力以赴，無論過去、現在及未來都不曾也不會改變。\n對市政的發展嚴格監督，好的市政全力配合，尤其有關福利政策。\n關心基礎教育，對學校補助不遺餘力。',
      claim_json=pg_catalog.jsonb_build_object(
        'platformText',E'每一件市民朋友的請託都全力以赴，無論過去、現在及未來都不曾也不會改變。\n對市政的發展嚴格監督，好的市政全力配合，尤其有關福利政策。\n關心基礎教育，對學校補助不遺餘力。',
        'items',pg_catalog.jsonb_build_array(
          '每一件市民朋友的請託都全力以赴，無論過去、現在及未來都不曾也不會改變。',
          '對市政的發展嚴格監督，好的市政全力配合，尤其有關福利政策。',
          '關心基礎教育，對學校補助不遺餘力。'
        ),
        'contentSplit',pg_catalog.jsonb_build_object(
          'reviewStatus','reviewed',
          'releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-22-20260908','reasonCodes','[]'::JSONB)
        ),
        'electionContext',pg_catalog.jsonb_build_object(
          'candidateId','8a08cdd3-d6b7-4968-815a-fd4c429ba75a',
          'raceId','e09788a1-6d10-4e52-8e46-2104630d8d12',
          'electionId','1d63585f-87eb-4817-abc9-0d010839bf4d'
        ),
        'platformQualityAudit',pg_catalog.jsonb_build_object(
          'version','platform-quality-audit-20260907-round-2',
          'repairVersion','verified-high-omission-platforms-22-20260908',
          'repair','official_source_replacement',
          'classification','verified_repair'
        ),
        'platformSource',pg_catalog.jsonb_build_object(
          'sourceKind','official_election_bulletin',
          'sourceName','中央選舉委員會：2022年選舉公報'
        ),
        'productionRelease','20260908-cec-2022-xiao-guo-liang-platform-replacement'
      ),
      confidence_level='A',
      review_status='verified',
      visibility='public',
      source_name='中央選舉委員會：2022年選舉公報',
      source_url='https://eebulletin.cec.gov.tw/111/14%E5%B1%8F%E6%9D%B1%E7%B8%A3/04%E9%84%89%E9%8E%AE%E5%B8%82%E6%B0%91%E4%BB%A3%E8%A1%A8/%E5%B1%8F%E6%9D%B1%E5%B8%82/%E5%B1%8F%E6%9D%B1%E5%B8%82%E9%95%B7%E5%B8%82%E6%B0%91%E4%BB%A3%E8%A1%A8%E7%AC%AC%E5%9B%9B%E9%81%B8%E8%88%89%E5%8D%80.pdf',
      observed_at='2022-11-25T16:00:00+00:00'::TIMESTAMPTZ,
      is_public=TRUE,
      review_score=100,
      scoring_version='cec-official-election-bulletin-v1',
      scoring_reasons='["Official CEC election bulletin","User-assisted transcription from supplied bulletin image"]'::JSONB,
      auto_reviewed_at=pg_catalog.now(),
      updated_at=pg_catalog.now()
  WHERE id='aca9b005-8604-4cfc-b903-3f7caba1d9a1'::UUID
    AND claim_key='votetw-person-enrichment:蕭國亮:platform:939a81ca3190debe'
    AND person_id='3702a343-8c9c-410e-865d-63e7ec36b78e'::UUID
    AND candidate_id IS NULL
    AND claim_type='platform'
    AND source_name='VoteTW'
    AND pg_catalog.md5(source_url)='c2115b8f7acb74141fa36cc87ed852a4'
    AND pg_catalog.md5(claim_value)='6071053a4039284516ef8f12b8e63ea6'
    AND pg_catalog.length(claim_value)=100
    AND review_status='archived'
    AND visibility='private'
    AND is_public IS FALSE
    AND claim_json#>>'{contentSplit,reviewStatus}'='needs_review'
    AND claim_json#>>'{platformQualityAudit,classification}'='confirmed_content_or_split_issue';
  GET DIAGNOSTICS affected_count=ROW_COUNT;
  IF affected_count<>1 THEN RAISE EXCEPTION 'Expected one Xiao Guo-liang platform source replacement, found %',affected_count; END IF;

  UPDATE public.person_claims
  SET review_status='archived',
      visibility='private',
      is_public=FALSE,
      claim_json=COALESCE(claim_json,'{}'::JSONB)||pg_catalog.jsonb_build_object(
        'reviewDecision',pg_catalog.jsonb_build_object(
          'version','xiao-guo-liang-cec-source-replacement-20260908',
          'decision','archive_replaced_source',
          'reason','Superseded by the exact 2022 CEC election bulletin and official election result.'
        )
      ),
      updated_at=pg_catalog.now()
  WHERE person_id IN (
      '3702a343-8c9c-410e-865d-63e7ec36b78e'::UUID,
      '393996c0-60b0-4889-851f-7d4c68f25af9'::UUID
    )
    AND source_name IN ('VoteTW','VoteTW historical election results')
    AND is_public IS TRUE;
  GET DIAGNOSTICS affected_count=ROW_COUNT;
  IF affected_count<>16 THEN RAISE EXCEPTION 'Expected to archive 16 superseded VoteTW claims, found %',affected_count; END IF;

  UPDATE public.candidates
  SET is_public=FALSE,updated_at=pg_catalog.now()
  WHERE id='3945f08c-8668-44af-b85b-6be92f1ca691'::UUID
    AND person_id='3702a343-8c9c-410e-865d-63e7ec36b78e'::UUID
    AND external_id='votetw-candidate-976c4304c9dfc4c1'
    AND source_name='VoteTW historical election results'
    AND candidate_no='7'
    AND vote_count=2758
    AND is_elected IS TRUE
    AND is_public IS TRUE;
  GET DIAGNOSTICS affected_count=ROW_COUNT;
  IF affected_count<>1 THEN RAISE EXCEPTION 'Expected to hide one superseded 2018 VoteTW candidacy, found %',affected_count; END IF;

  UPDATE public.people
  SET source_url='https://eebulletin.cec.gov.tw/111/14%E5%B1%8F%E6%9D%B1%E7%B8%A3/04%E9%84%89%E9%8E%AE%E5%B8%82%E6%B0%91%E4%BB%A3%E8%A1%A8/%E5%B1%8F%E6%9D%B1%E5%B8%82/%E5%B1%8F%E6%9D%B1%E5%B8%82%E9%95%B7%E5%B8%82%E6%B0%91%E4%BB%A3%E8%A1%A8%E7%AC%AC%E5%9B%9B%E9%81%B8%E8%88%89%E5%8D%80.pdf',
      gender='male',
      education='高中畢業',
      experience=E'屏東市第16屆大鵬里里長\n第16屆市民代表\n第17屆市民代表\n第18屆市民代表\n第19屆市民代表會主席',
      is_public=TRUE,
      updated_at=pg_catalog.now()
  WHERE id='3702a343-8c9c-410e-865d-63e7ec36b78e'::UUID
    AND external_id='votetw-person-c7b9ef1c2496b3ef'
    AND source_url='https://votetw.com/wiki/%E8%95%AD%E5%9C%8B%E4%BA%AE'
    AND gender='unknown'
    AND COALESCE(education,'')=''
    AND COALESCE(experience,'')=''
    AND is_public IS TRUE;
  GET DIAGNOSTICS affected_count=ROW_COUNT;
  IF affected_count<>1 THEN RAISE EXCEPTION 'Expected to replace one canonical Xiao Guo-liang person source, found %',affected_count; END IF;
END
$replace$;

WITH official_profile(person_id,candidate_id,source_url,birth_date,gender,party_affiliation,education_items,experience_items) AS (
  VALUES(
    '393996c0-60b0-4889-851f-7d4c68f25af9'::UUID,
    '8a08cdd3-d6b7-4968-815a-fd4c429ba75a'::UUID,
    'https://eebulletin.cec.gov.tw/111/14%E5%B1%8F%E6%9D%B1%E7%B8%A3/04%E9%84%89%E9%8E%AE%E5%B8%82%E6%B0%91%E4%BB%A3%E8%A1%A8/%E5%B1%8F%E6%9D%B1%E5%B8%82/%E5%B1%8F%E6%9D%B1%E5%B8%82%E9%95%B7%E5%B8%82%E6%B0%91%E4%BB%A3%E8%A1%A8%E7%AC%AC%E5%9B%9B%E9%81%B8%E8%88%89%E5%8D%80.pdf',
    '1958-10-09','male','中國國民黨',
    '["高中畢業"]'::JSONB,
    '["屏東市第16屆大鵬里里長","第16屆市民代表","第17屆市民代表","第18屆市民代表","第19屆市民代表會主席"]'::JSONB
  )
), expanded_claims AS (
  SELECT profile.person_id,profile.candidate_id,profile.source_url,claim.claim_type,claim.claim_value,claim.items,claim.field
  FROM official_profile profile
  CROSS JOIN LATERAL (VALUES
    ('birth_date',profile.birth_date,NULL::JSONB,'birth_date'),
    ('gender',profile.gender,NULL::JSONB,'gender'),
    ('party_affiliation',profile.party_affiliation,NULL::JSONB,'recommended_party'),
    ('education',(SELECT pg_catalog.string_agg(value,E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.education_items) WITH ORDINALITY item(value,ordinal)),profile.education_items,'education'),
    ('experience',(SELECT pg_catalog.string_agg(value,E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.experience_items) WITH ORDINALITY item(value,ordinal)),profile.experience_items,'experience')
  ) claim(claim_type,claim_value,items,field)
)
INSERT INTO public.person_claims(
  claim_key,person_id,candidate_id,claim_type,claim_value,claim_json,confidence_level,
  review_status,visibility,source_name,source_url,observed_at,is_public,review_score,
  scoring_version,scoring_reasons,auto_reviewed_at
)
SELECT
  'official-profile:cec-2022-bulletin:xiao-guo-liang:'||claim_type,
  person_id,candidate_id,claim_type,claim_value,
  pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'field',field,'items',items,
    'productionRelease','20260908-cec-2022-xiao-guo-liang-source-replacement'
  )),
  'A','verified','public','中央選舉委員會：2022年選舉公報',source_url,
  '2022-11-25T16:00:00+00:00'::TIMESTAMPTZ,TRUE,100,
  'cec-official-election-bulletin-v1',
  '["Official CEC election bulletin","User-assisted transcription from supplied bulletin image"]'::JSONB,
  pg_catalog.now()
FROM expanded_claims
ON CONFLICT(claim_key) DO UPDATE SET
  person_id=EXCLUDED.person_id,candidate_id=EXCLUDED.candidate_id,
  claim_value=EXCLUDED.claim_value,claim_json=EXCLUDED.claim_json,
  confidence_level=EXCLUDED.confidence_level,review_status=EXCLUDED.review_status,
  visibility=EXCLUDED.visibility,source_name=EXCLUDED.source_name,
  source_url=EXCLUDED.source_url,observed_at=EXCLUDED.observed_at,
  is_public=EXCLUDED.is_public,review_score=EXCLUDED.review_score,
  scoring_version=EXCLUDED.scoring_version,scoring_reasons=EXCLUDED.scoring_reasons,
  auto_reviewed_at=EXCLUDED.auto_reviewed_at,updated_at=pg_catalog.now();

DO $validate$
DECLARE profile_count INTEGER;
BEGIN
  SELECT pg_catalog.count(*) INTO profile_count
  FROM public.person_claims
  WHERE claim_key LIKE 'official-profile:cec-2022-bulletin:xiao-guo-liang:%'
    AND person_id='393996c0-60b0-4889-851f-7d4c68f25af9'::UUID
    AND candidate_id='8a08cdd3-d6b7-4968-815a-fd4c429ba75a'::UUID
    AND review_status='verified' AND visibility='public' AND is_public IS TRUE
    AND source_name='中央選舉委員會：2022年選舉公報';
  IF profile_count<>5 THEN RAISE EXCEPTION 'Expected five verified Xiao Guo-liang profile claims, found %',profile_count; END IF;

  IF NOT EXISTS(
    SELECT 1 FROM public.person_claims
    WHERE id='aca9b005-8604-4cfc-b903-3f7caba1d9a1'::UUID
      AND person_id='393996c0-60b0-4889-851f-7d4c68f25af9'::UUID
      AND candidate_id='8a08cdd3-d6b7-4968-815a-fd4c429ba75a'::UUID
      AND claim_key='official-platform:cec-2022-bulletin:xiao-guo-liang'
      AND source_name='中央選舉委員會：2022年選舉公報'
      AND review_status='verified' AND visibility='public' AND is_public IS TRUE
      AND pg_catalog.jsonb_array_length(claim_json->'items')=3
      AND claim_json#>>'{contentSplit,reviewStatus}'='reviewed'
      AND claim_json#>>'{electionContext,candidateId}'='8a08cdd3-d6b7-4968-815a-fd4c429ba75a'
      AND claim_json#>>'{electionContext,raceId}'='e09788a1-6d10-4e52-8e46-2104630d8d12'
      AND claim_json#>>'{electionContext,electionId}'='1d63585f-87eb-4817-abc9-0d010839bf4d'
      AND claim_json#>>'{platformQualityAudit,classification}'='verified_repair'
  ) THEN RAISE EXCEPTION 'Xiao Guo-liang official platform validation failed'; END IF;

  IF EXISTS(
    SELECT 1 FROM public.person_claims
    WHERE person_id IN (
      '3702a343-8c9c-410e-865d-63e7ec36b78e'::UUID,
      '393996c0-60b0-4889-851f-7d4c68f25af9'::UUID
    )
      AND source_name IN ('VoteTW','VoteTW historical election results')
      AND is_public IS TRUE
  ) THEN RAISE EXCEPTION 'A superseded Xiao Guo-liang VoteTW claim remains public'; END IF;

  IF NOT EXISTS(
    SELECT 1 FROM public.candidates
    WHERE id='8a08cdd3-d6b7-4968-815a-fd4c429ba75a'::UUID
      AND source_name='中央選舉委員會選舉資料庫'
      AND source_url='https://web.cec.gov.tw/api/file/54edd7dd-637b-41d4-a695-fc9cff9654e1.pdf'
      AND is_public IS TRUE
  ) THEN RAISE EXCEPTION 'Xiao Guo-liang candidate source validation failed'; END IF;
END
$validate$;

COMMIT;
