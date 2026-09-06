import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

assert(fs.readFileSync('supabase/config.toml', 'utf8').includes('project_id = "public-office-watch"'));

const runSql = (sql) => execFileSync(
  'docker',
  ['exec', '-i', 'supabase_db_public-office-watch', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
  { input: sql, encoding: 'utf8', maxBuffer: 30e6 },
).trim();

const report = JSON.parse(runSql(`
WITH cohort AS (
  SELECT
    claim.*,
    (claim.claim_json->'targetRace'->>'id')::uuid AS target_race_id,
    claim.claim_json->'registrationEvidence'->>'office' AS office
  FROM public.person_claims claim
  WHERE claim.claim_key LIKE 'official-candidacy:pow-cec-registration-2026-%'
),
verified AS (
  SELECT * FROM cohort WHERE review_status = 'verified'
),
registered_public AS (
  SELECT *
  FROM published.candidates
  WHERE election_year = 2026
    AND candidacy_status = 'registered'
    AND registration_status = 'registered'
),
claim_matches AS (
  SELECT
    claim.id AS claim_id,
    count(candidate.candidate_id) AS matches,
    min(candidate.candidate_id::text)::uuid AS candidate_id
  FROM verified claim
  LEFT JOIN public.person_canonical_map person_map ON person_map.person_id = claim.person_id
  LEFT JOIN registered_public candidate
    ON candidate.person_id = person_map.canonical_person_id
   AND candidate.race_id = claim.target_race_id
  GROUP BY claim.id
),
resolved AS (
  SELECT claim.*, match.candidate_id AS resolved_candidate_id
  FROM verified claim
  JOIN claim_matches match ON match.claim_id = claim.id AND match.matches = 1
),
office_breakdown AS (
  SELECT review_status, office, count(*) AS records
  FROM cohort
  GROUP BY review_status, office
  ORDER BY review_status, office
)
SELECT json_build_object(
  'environment', 'full-local',
  'auditedAt', now(),
  'sourceRecords', (SELECT count(*) FROM cohort),
  'distinctClaimKeys', (SELECT count(DISTINCT claim_key) FROM cohort),
  'distinctSourcePeople', (SELECT count(DISTINCT source_person_id) FROM cohort),
  'reviewStatuses', (
    SELECT json_object_agg(review_status, records)
    FROM (
      SELECT review_status, count(*) AS records
      FROM cohort GROUP BY review_status ORDER BY review_status
    ) status_counts
  ),
  'officeBreakdown', (
    SELECT json_agg(json_build_object('reviewStatus', review_status, 'office', office, 'records', records))
    FROM office_breakdown
  ),
  'linkedRegistrations', (SELECT count(*) FROM registered_public),
  'linkedPeople', (SELECT count(DISTINCT person_id) FROM registered_public),
  'linkedRaces', (SELECT count(DISTINCT race_id) FROM registered_public),
  'nameOnlyRegistrations', (SELECT count(*) FROM public.registration_name_roster WHERE is_public),
  'visibleRegistrations', (SELECT count(*) FROM registered_public) + (SELECT count(*) FROM public.registration_name_roster WHERE is_public),
  'qualificationEvents', (
    SELECT count(*) FROM public.candidate_lifecycle_events event
    JOIN registered_public candidate ON candidate.candidate_id = event.candidate_id
    WHERE event.event_type IN ('qualification_confirmed', 'qualification_rejected')
  ),
  'checks', json_build_object(
    'verifiedWithoutPerson', (SELECT count(*) FROM verified WHERE person_id IS NULL),
    'pendingWithPerson', (SELECT count(*) FROM cohort WHERE review_status = 'pending' AND person_id IS NOT NULL),
    'publicEvidenceLeaks', (SELECT count(*) FROM cohort WHERE is_public OR visibility = 'public'),
    'sourcePersonMissing', (SELECT count(*) FROM cohort claim LEFT JOIN public.source_people source ON source.id = claim.source_person_id WHERE source.id IS NULL),
    'nonRejectedRaceMissingOrPrivate', (
      SELECT count(*) FROM cohort claim
      LEFT JOIN public.races race ON race.id = claim.target_race_id
      WHERE claim.review_status <> 'rejected' AND (race.id IS NULL OR NOT race.is_public)
    ),
    'verifiedClaimMatchFailures', (SELECT count(*) FROM claim_matches WHERE matches <> 1),
    'registeredLifecycleFailures', (
      SELECT count(*) FROM registered_public candidate
      WHERE (
        SELECT count(*) FROM public.candidate_lifecycle_events event
        WHERE event.candidate_id = candidate.candidate_id
          AND event.event_type = 'registration_filed'
          AND event.is_public
      ) <> 1
    ),
    'registeredSourceFailures', (
      SELECT count(*) FROM registered_public
      WHERE source_url IS NULL OR source_url NOT LIKE 'https://%' OR source_name IS NULL
    ),
    'eventHashMismatches', (
      SELECT count(*) FROM resolved claim
      JOIN public.candidate_lifecycle_events event
        ON event.candidate_id = claim.resolved_candidate_id AND event.event_type = 'registration_filed'
      WHERE event.source_hash IS DISTINCT FROM claim.claim_json->'registrationEvidence'->'source'->>'sha256'
    ),
    'eventUrlMismatches', (
      SELECT count(*) FROM resolved claim
      JOIN public.candidate_lifecycle_events event
        ON event.candidate_id = claim.resolved_candidate_id AND event.event_type = 'registration_filed'
      WHERE event.source_url IS DISTINCT FROM claim.claim_json->'registrationEvidence'->'source'->>'url'
    ),
    'eventDateMismatches', (
      SELECT count(*) FROM resolved claim
      JOIN public.candidate_lifecycle_events event
        ON event.candidate_id = claim.resolved_candidate_id AND event.event_type = 'registration_filed'
      WHERE event.occurred_on::text IS DISTINCT FROM nullif(claim.claim_json->'registrationEvidence'->>'registration_date', '')
    ),
    'registeredNameMarkup', (
      SELECT count(*) FROM registered_public
      WHERE person_name LIKE '%</%' OR person_name LIKE '%style=%' OR length(person_name) > 80
    ),
    'registeredNamePrivateUseChars', (
      SELECT count(*) FROM registered_public
      WHERE person_name ~ ('[' || chr(57344) || '-' || chr(63743) || ']')
    ),
    'duplicatePublicPersonRace', (
      SELECT count(*) FROM (
        SELECT person_id, race_id
        FROM registered_public
        GROUP BY person_id, race_id
        HAVING count(*) > 1
      ) duplicates
    ),
    'samePersonMultipleRaces', (
      SELECT count(*) FROM (
        SELECT person_id
        FROM registered_public
        GROUP BY person_id
        HAVING count(DISTINCT race_id) > 1
      ) duplicates
    ),
    'candidateNumbersPrematurelyPublished', (
      SELECT count(*) FROM registered_public WHERE candidate_no IS NOT NULL
    ),
    'nameRosterClaimFailures', (
      SELECT count(*)
      FROM public.registration_name_roster name
      LEFT JOIN cohort claim ON claim.id = name.source_claim_id
      WHERE name.is_public
        AND (
          claim.id IS NULL
          OR claim.review_status <> 'pending'
          OR claim.person_id IS NOT NULL
          OR claim.candidate_id IS NOT NULL
        )
    ),
    'pendingWithoutNameRoster', (
      SELECT count(*)
      FROM cohort claim
      LEFT JOIN public.registration_name_roster name
        ON name.source_claim_id = claim.id AND name.is_public
      WHERE claim.review_status = 'pending' AND name.id IS NULL
    ),
    'remainingPartyNominees2026', (
      SELECT count(*)
      FROM public.candidates candidate
      JOIN public.races race ON race.id = candidate.race_id
      JOIN public.elections election ON election.id = race.election_id
      WHERE election.year = 2026 AND candidate.candidacy_status = 'party_nominee'
    ),
    'confirmedDidNotRegister', (
      SELECT count(*)
      FROM public.candidates candidate
      JOIN public.races race ON race.id = candidate.race_id
      JOIN public.elections election ON election.id = race.election_id
      WHERE election.year = 2026
        AND candidate.candidacy_status = 'did_not_register'
        AND candidate.registration_status = 'not_registered'
        AND NOT candidate.is_public
    ),
    'verifiedNomineePersonMerges', (
      SELECT count(*)
      FROM public.person_merge_decisions
      WHERE status = 'verified'
        AND evidence_json->>'reviewType' = '2026_registration_nominee_reconciliation'
    ),
    'withheldTainanNominees', (
      SELECT count(*)
      FROM public.candidates candidate
      JOIN public.races race ON race.id = candidate.race_id
      JOIN public.elections election ON election.id = race.election_id
      WHERE election.year = 2026
        AND race.title LIKE '臺南市%'
        AND race.race_type IN ('city_councilor', 'village_chief')
        AND candidate.candidacy_status = 'unknown'
        AND candidate.registration_status = 'unknown'
        AND NOT candidate.is_public
    ),
    'malformedHsiehNamePublic', (
      SELECT count(*) FROM published.candidates
      WHERE election_year = 2026 AND person_name LIKE '%</span>%'
    )
  )
);
`));

assert.equal(report.sourceRecords, 18417);
assert.equal(report.distinctClaimKeys, 18417);
assert.equal(report.distinctSourcePeople, 18417);
assert.deepEqual(report.reviewStatuses, { pending: 916, rejected: 1, verified: 17500 });
assert.equal(report.linkedRegistrations, 17500);
assert.equal(report.linkedPeople, 17500);
assert.equal(report.nameOnlyRegistrations, 916);
assert.equal(report.visibleRegistrations, 18416);
assert.equal(report.qualificationEvents, 0);

const expectedChecks = {
  verifiedWithoutPerson: 0,
  pendingWithPerson: 0,
  publicEvidenceLeaks: 0,
  sourcePersonMissing: 0,
  nonRejectedRaceMissingOrPrivate: 0,
  verifiedClaimMatchFailures: 0,
  registeredLifecycleFailures: 0,
  registeredSourceFailures: 0,
  eventHashMismatches: 0,
  eventUrlMismatches: 0,
  eventDateMismatches: 0,
  registeredNameMarkup: 0,
  registeredNamePrivateUseChars: 0,
  duplicatePublicPersonRace: 0,
  samePersonMultipleRaces: 0,
  candidateNumbersPrematurelyPublished: 0,
  nameRosterClaimFailures: 0,
  pendingWithoutNameRoster: 0,
  remainingPartyNominees2026: 0,
  confirmedDidNotRegister: 2,
  verifiedNomineePersonMerges: 4,
  withheldTainanNominees: 38,
  malformedHsiehNamePublic: 0,
};
assert.deepEqual(report.checks, expectedChecks);

const officialTotal = 19695;
const namedSourceGap = officialTotal - report.sourceRecords;
assert.equal(namedSourceGap, 1278);

const result = {
  ...report,
  officialCentralTotal: officialTotal,
  namedSourceGap,
  rejectedRecord: {
    name: '倪進文',
    reason: '屏東官方試算表重複錯列於鄉鎮市長區段；市民代表列保留並顯示。',
  },
  nomineeReconciliation: {
    linkedToOfficialRegistration: ['謝龍介', '徐尚裕（徐尙裕）', '布落‧馬信', '蘇錦雄Paylang ‧Caya'],
    confirmedDidNotRegister: ['翁壽良', '陳政慈'],
    withheldPendingNamedTainanRoster: 38,
  },
  sourceCoverageLimit: {
    total: 1278,
    detail: {
      tainanCouncilor: 88,
      tainanVillageChief: 1187,
      otherImageOnlyNames: 3,
    },
  },
};

fs.writeFileSync('docs/cec-registration-full-audit-2026-09-05.json', JSON.stringify(result, null, 2) + '\n');

const officeZh = {
  councilor: '議員',
  indigenous_district_chief: '直轄市山地原住民區長',
  indigenous_district_representative: '直轄市山地原住民區民代表',
  mayor: '縣市長',
  township_mayor: '鄉鎮市長',
  township_representative: '鄉鎮市民代表',
  village_chief: '村里長',
};
const verifiedByOffice = Object.fromEntries(result.officeBreakdown.filter((row) => row.reviewStatus === 'verified').map((row) => [row.office, row.records]));
const pendingByOffice = Object.fromEntries(result.officeBreakdown.filter((row) => row.reviewStatus === 'pending').map((row) => [row.office, row.records]));
const offices = Object.keys(officeZh);
const officeRows = offices.map((office) => `| ${officeZh[office]} | ${verifiedByOffice[office] ?? 0} | ${pendingByOffice[office] ?? 0} |`).join('\n');

const markdown = `# 2026 登記參選資料完整檢查

檢查日期：2026-09-05。環境：完整本機 Supabase（非正式站）。

## 結果

| 項目 | 筆數 |
|---|---:|
| 中選會中央統計 | ${officialTotal.toLocaleString('en-US')} |
| 已取得具名來源 | ${result.sourceRecords.toLocaleString('en-US')} |
| 已連結人物並公開 | ${result.linkedRegistrations.toLocaleString('en-US')} |
| 僅顯示姓名、不建人物頁 | ${result.nameOnlyRegistrations.toLocaleString('en-US')} |
| 本機可見登記姓名合計 | ${result.visibleRegistrations.toLocaleString('en-US')} |
| 官方重複錯列並排除 | 1 |
| 尚缺具名來源 | ${namedSourceGap.toLocaleString('en-US')} |

18,417 筆已取得來源都有唯一聲明與來源人物；17,500 筆已連結資料都有唯一公開人物、公開選區及一筆「申請登記」事件。事件的官方網址、檔案 SHA-256 與登記日期逐筆和私有來源證據相符。916 筆待核資料都只透過無連結姓名列公開，沒有建立人物頁，也沒有暴露私有聲明。

## 職位分布

| 職位 | 已連人物 | 僅顯示姓名 |
|---|---:|---:|
${officeRows}

## 這次發現並修正

- 謝龍介：臺南新聞稿的 HTML 被誤併入姓名；已接回既有謝龍介人物，頁面只顯示正常姓名。
- 徐尚裕（政黨來源作徐尙裕）、布落‧馬信、蘇錦雄Paylang ‧Caya：異體字、標點或空格造成重複；已合併為同一人物及同一選區的官方登記。
- 翁壽良、陳政慈：政黨提名後未出現在截止後的完整具名登記資料，記為「未完成登記」並退出候選名單。
- 38 筆臺南議員／里長政黨提名：臺南 9/4 公告只有總數，沒有完整具名名冊；先標成「登記待確認」並暫不公開，不誤判成未登記。
- 倪進文：屏東官方試算表把同一筆資料錯列在鄉鎮市長與代表兩處；錯列已排除，屏東市第 1 選舉區市民代表姓名保留一次。

## 完整性檢查

- 公開登記人物沒有 HTML 片段、私用區缺字或異常長姓名。
- 同一人物沒有同時落入兩個 2026 選區；同一人物與選區沒有重複公開候選紀錄。
- 登記序號未誤作抽籤候選號次；資格審定事件仍為 0，狀態維持「已申請登記」。
- 18,417 筆私有來源聲明均未直接公開；匿名讀取只取得整理後人物、候選事件或純姓名列。
- 2026 舊「政黨提名」有效狀態已清為 0。

## 仍待官方具名資料

中央統計與已取得來源相差 1,278 人：臺南議員 88 人、臺南里長 1,187 人，另有 3 筆只存在於姓名圖片、目前無法完整辨字。這 1,278 人尚未列入網站；10 月 16 日資格審定名單公布後，再把已登記狀態更新為資格通過或不通過。
`;
fs.writeFileSync('docs/cec-registration-full-audit-2026-09-05.md', markdown);
console.log(JSON.stringify(result, null, 2));
