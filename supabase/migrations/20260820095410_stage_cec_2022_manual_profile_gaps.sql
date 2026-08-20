begin;

with gap_inputs (
  claim_key,
  person_id,
  person_name,
  candidate_id,
  candidate_no,
  race_title,
  claim_type,
  source_url,
  page_number,
  extraction_reason
) as (
  values
    (
      'cec-2022-manual-profile-gap:e8ca7231-0e3b-4873-a094-08aff4842561:education',
      '9f292e7e-f6fd-4b76-ac22-e160df4c7f30'::uuid,
      '周陳曉玟',
      'e8ca7231-0e3b-4873-a094-08aff4842561'::uuid,
      '2',
      '第13選舉區（山地原住民）',
      'education',
      'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/06%E7%B8%A3%E5%B8%82%E8%AD%B0%E5%93%A1/111%E5%B9%B4/13%E5%B1%8F%E6%9D%B1%E7%B8%A3/%E5%B1%8F%E6%9D%B1%E7%B8%A3%E7%AC%AC8%E3%80%8113-16%E9%81%B8%E8%88%89%E5%8D%80.pdf',
      null::integer,
      'candidate name and profile headers were not safely localized in the combined bulletin'
    ),
    (
      'cec-2022-manual-profile-gap:354ec65c-1214-40fc-b613-2b5cb4b2590e:experience',
      '777eef35-274f-4841-8e42-b6a80de16d4d'::uuid,
      '張仁和',
      '354ec65c-1214-40fc-b613-2b5cb4b2590e'::uuid,
      '2',
      '第6選舉區',
      'experience',
      'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/06%E7%B8%A3%E5%B8%82%E8%AD%B0%E5%93%A1/111%E5%B9%B4/17%E6%BE%8E%E6%B9%96%E7%B8%A3/%E6%BE%8E%E6%B9%96%E7%B8%A3%E7%AC%AC2%E3%80%813%E3%80%814%E3%80%815%E3%80%816%E9%81%B8%E8%88%89%E5%8D%80.pdf',
      null::integer,
      'candidate name and profile headers were not safely localized in the combined bulletin'
    ),
    (
      'cec-2022-manual-profile-gap:3772a8c6-f4d5-469e-8bf2-f3c82e7ea1f5:experience',
      'd5f00ab0-84be-46e1-8350-a6978fc2f045'::uuid,
      '蔡政宜',
      '3772a8c6-f4d5-469e-8bf2-f3c82e7ea1f5'::uuid,
      '1',
      '第4選舉區',
      'experience',
      'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/06%E7%B8%A3%E5%B8%82%E8%AD%B0%E5%93%A1/111%E5%B9%B4/12%E5%98%89%E7%BE%A9%E7%B8%A3/%E5%98%89%E7%BE%A9%E7%B8%A3%E7%AC%AC04%E9%81%B8%E8%88%89%E5%8D%80.pdf',
      1,
      'the official bulletin field remained empty after automatic extraction'
    ),
    (
      'cec-2022-manual-profile-gap:f4e8259d-1245-4ed4-b670-8301fb10436a:experience',
      'ceeabad5-0930-4db5-ac06-0e49a51a5d1e'::uuid,
      '蕭詠萱',
      'f4e8259d-1245-4ed4-b670-8301fb10436a'::uuid,
      '13',
      '第5選舉區',
      'experience',
      'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/06%E7%B8%A3%E5%B8%82%E8%AD%B0%E5%93%A1/111%E5%B9%B4/08%E8%8B%97%E6%A0%97%E7%B8%A3/%E7%AC%AC5%E9%81%B8%E8%88%89%E5%8D%80/%E7%AC%AC5%E9%81%B8%E8%88%89%E5%8D%80%E8%AD%B0%E5%93%A1%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1.pdf',
      2,
      'the official bulletin field remained empty after automatic extraction'
    )
),
eligible_gaps as (
  select gap_inputs.*
  from gap_inputs
  join public.people as person
    on person.id = gap_inputs.person_id
    and person.name = gap_inputs.person_name
  join public.candidates as candidate
    on candidate.id = gap_inputs.candidate_id
    and candidate.candidate_no = gap_inputs.candidate_no
  join public.person_canonical_map as person_map
    on person_map.person_id = candidate.person_id
    and person_map.canonical_person_id = gap_inputs.person_id
  join public.races as race
    on race.id = candidate.race_id
    and race.title = gap_inputs.race_title
  join public.elections as election
    on election.id = race.election_id
    and election.year = 2022
)
insert into public.person_claims (
  claim_key,
  person_id,
  candidate_id,
  claim_type,
  claim_value,
  claim_json,
  confidence_level,
  review_status,
  visibility,
  source_name,
  source_url,
  is_public,
  review_score,
  scoring_version,
  scoring_reasons
)
select
  eligible_gaps.claim_key,
  eligible_gaps.person_id,
  eligible_gaps.candidate_id,
  eligible_gaps.claim_type,
  null,
  jsonb_build_object(
    'personName', eligible_gaps.person_name,
    'candidateId', eligible_gaps.candidate_id,
    'candidateNo', eligible_gaps.candidate_no,
    'raceTitle', eligible_gaps.race_title,
    'electionYear', 2022,
    'profileSource', 'cec_election_bulletin',
    'sourceDocument', jsonb_strip_nulls(jsonb_build_object('page', eligible_gaps.page_number)),
    'sourceExtraction', jsonb_build_object(
      'status', 'manual_field_entry_required',
      'reason', eligible_gaps.extraction_reason
    ),
    'reviewAudit', jsonb_build_object('reasonCodes', jsonb_build_array('manual_text_review'))
  ),
  'A',
  'pending',
  'review_only',
  '中央選舉委員會：2022年縣市議員選舉公報',
  eligible_gaps.source_url,
  false,
  90,
  'cec-2022-manual-profile-gap-v1',
  jsonb_build_array(
    'A-level source',
    'linked to canonical person',
    'manual transcription required'
  )
from eligible_gaps
on conflict (claim_key) do nothing;

do $validation$
declare
  staged_count integer;
begin
  select count(*)
  into staged_count
  from public.person_claims
  where claim_key = any (array[
    'cec-2022-manual-profile-gap:e8ca7231-0e3b-4873-a094-08aff4842561:education',
    'cec-2022-manual-profile-gap:354ec65c-1214-40fc-b613-2b5cb4b2590e:experience',
    'cec-2022-manual-profile-gap:3772a8c6-f4d5-469e-8bf2-f3c82e7ea1f5:experience',
    'cec-2022-manual-profile-gap:f4e8259d-1245-4ed4-b670-8301fb10436a:experience'
  ]);

  if staged_count <> 4 then
    raise exception 'Expected four CEC 2022 manual profile review claims, found %', staged_count;
  end if;
end
$validation$;

commit;
