do $migration$
declare
  reviewed_at timestamptz := now();
  corrected_platform text := $platform$
加快都市更新
改善居住品質
• 提升行政效率與執行力，包括簡化及整併審議程序、加速審議效能，並積極由公家單位輔導執行相關案件成案。
• 落實公正的協商機制，政府從被動轉為主動，擔任住戶與建商的橋樑，建立市民對都更程序的信任與信心。
• 全盤檢討都市計畫書及容積制度，將重點發展區域、公共交通走廊、區域性公共設施、公益回饋及房屋市場共同整併研議。

落實道路安全
減少事故傷亡
• 推動「Vision Zero」（零傷亡願景），建構對行人更友善的用路環境，並以標線改造降低交通事故風險與傷亡。
• 透過大數據分析及更多智慧號誌系統的設置，紓解台北市塞車路段，還給台北市民更安全與便利的交通環境。

提升英語教育
強化國際競爭力
• 提升各校的英語教學能量與應用英語環境，培養更多國際人才，建立一座更有國際競爭力的台北市。
• 聯合地方與中央，共同解決英語教學在軟硬體設施及師資上所遇到的問題，確保每個學校皆享有優質教學環境。

推動國際合作
與民主世界同行
• 強化各項城市交流並積極締結姊妹市關係，與民主夥伴國建立更多在經貿、教育、文化及學術等方面的交流。
• 號召更多國際企業、NGO 及其他組織來台北市設立辦公室並舉辦活動，創造商機並提升台北國際形象。
$platform$;
  updated_count integer;
begin
  update public.person_claims as claim
  set
    claim_value = btrim(corrected_platform, chr(10) || chr(13) || ' '),
    claim_json = jsonb_set(
      jsonb_set(
        coalesce(claim.claim_json, '{}'::jsonb),
        '{platformText}',
        to_jsonb(btrim(corrected_platform, chr(10) || chr(13) || ' ')),
        true
      ),
      '{reviewDecision}',
      jsonb_build_object(
        'version', 'manual-platform-correction-v1',
        'decision', 'approve',
        'reason', 'Reviewer replaced an incomplete approved transcription',
        'reviewedAt', reviewed_at
      ),
      true
    ),
    scoring_reasons = coalesce(claim.scoring_reasons, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'version', 'manual-platform-correction-v1',
        'reason', 'reviewer replaced incomplete platform text',
        'reviewedAt', reviewed_at
      )
    ),
    review_status = 'verified',
    visibility = 'public',
    is_public = true,
    auto_reviewed_at = reviewed_at,
    updated_at = reviewed_at
  where claim.id = 'c06ae890-97d0-40cd-a46f-e456c16bb85f'
    and claim.person_id = 'dce793d6-78e5-4cee-8ace-1801074f9e16'
    and claim.candidate_id = 'df18ecfa-cce3-4f77-8475-5adca4cf2610'
    and claim.claim_type = 'platform'
    and claim.source_name = '中央選舉委員會：2022年選舉公報'
    and exists (
      select 1
      from public.candidates as candidate
      join public.people as person on person.id = candidate.person_id
      join public.races as race on race.id = candidate.race_id
      join public.elections as election on election.id = race.election_id
      where candidate.id = claim.candidate_id
        and candidate.person_id = claim.person_id
        and person.name = '趙怡翔'
        and candidate.party = '民主進步黨'
        and candidate.candidate_no = '13'
        and candidate.is_elected = true
        and election.year = 2022
        and race.title = '第6選舉區'
    );

  get diagnostics updated_count = row_count;
  if updated_count <> 1 then
    raise exception 'Expected exactly one verified 趙怡翔 2022 platform claim, updated %', updated_count;
  end if;
end
$migration$;

select published.promote();
