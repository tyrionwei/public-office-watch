import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const publicationReportPath = 'tmp/cec-registration-publication/2026-09-04T16-22-27-187Z-apply.json';
const publicationReport = JSON.parse(fs.readFileSync(publicationReportPath, 'utf8'));
const previouslyPrivateExistingPersonIds = (publicationReport.before?.people ?? [])
  .filter((person) => !String(person.external_id ?? '').startsWith('pow-cec-registration-person-2026-'))
  .map((person) => person.id);

assert.deepEqual(previouslyPrivateExistingPersonIds.sort(), [
  '567af1d0-5f8f-4e48-b6b1-cbf3a9d30110',
  'b05ef122-1db5-442a-a3f5-0636f334c7f8',
  'f4fc600d-a6c8-4788-b919-e9b3a8f252d6',
].sort());

const sqlQuote = (value) => "'" + value.replaceAll("'", "''") + "'";
const priorPrivateIdsSql = previouslyPrivateExistingPersonIds.map(sqlQuote).join(',');

const sql = `
BEGIN;
SET LOCAL application_name = 'cec-registration-current-office-audit-20260905';
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '180s';
SELECT pg_advisory_xact_lock(hashtextextended('public-office-watch:cec-registration-current-office-audit', 0));

CREATE FUNCTION pg_temp.office_category(role_name text, office_label text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS \$category\$
  SELECT CASE
    WHEN role_name = 'president' THEN 'president'
    WHEN role_name = 'vice_president' THEN 'vice_president'
    WHEN role_name = 'legislator' THEN 'legislator'
    WHEN role_name = 'local_deputy' THEN 'local_deputy'
    WHEN role_name = 'agency_head' THEN 'agency_head'
    WHEN role_name = 'councilor' OR office_label ~ '(縣議員|市議員)$' THEN 'councilor'
    WHEN office_label IN (
      '臺北市市長','新北市市長','桃園市市長','臺中市市長','臺南市市長','高雄市市長',
      '基隆市市長','新竹市市長','嘉義市市長'
    ) OR office_label ~ '縣縣長$' THEN 'county_city_chief'
    WHEN office_label ~ '(鄉民代表|鎮民代表|市民代表|區民代表)$' THEN 'township_representative'
    WHEN office_label ~ '(村長|里長)$' THEN 'village_chief'
    WHEN office_label ~ '區區長$' THEN 'district_chief'
    WHEN office_label ~ '(鄉鄉長|鎮鎮長|市市長)$' THEN 'township_mayor'
    ELSE 'other_current'
  END
\$category\$;

CREATE TEMP TABLE audit_current_after AS
SELECT
  person_id,
  list_role,
  current_office_label,
  pg_temp.office_category(list_role, current_office_label) AS office_category
FROM published.people
WHERE list_status = 'current';


CREATE TEMP TABLE audit_registration_invariants_after AS
SELECT
  (
    SELECT count(*)
    FROM public.people base
    JOIN public.public_people person ON person.person_id = base.id
    WHERE base.external_id LIKE 'pow-cec-registration-person-2026-%'
      AND person.current_office_label IS NOT NULL
  ) AS new_registration_people_with_current_office,
  (
    SELECT count(*)
    FROM public.candidates candidate
    JOIN public.races race ON race.id = candidate.race_id
    JOIN public.elections election ON election.id = race.election_id
    WHERE election.year = 2026
      AND candidate.election_result = 'elected'
  ) AS elected_2026_candidate_rows,
  (
    SELECT count(*)
    FROM public.current_office_assignments
    WHERE source_url LIKE '%vote2026%'
       OR source_url LIKE '%cec-registration%'
  ) AS registration_sourced_current_assignments;

DO \$check\$
BEGIN
  IF (SELECT count(*) FROM audit_current_after) <> 11380 THEN
    RAISE EXCEPTION 'Unexpected current roster baseline';
  END IF;
  IF (
    SELECT count(*)
    FROM public.candidates candidate
    JOIN public.races race ON race.id = candidate.race_id
    JOIN public.elections election ON election.id = race.election_id
    WHERE election.year = 2026
      AND candidate.candidacy_status = 'registered'
      AND candidate.registration_status = 'registered'
  ) <> 17500 THEN
    RAISE EXCEPTION 'Unexpected registered candidate count';
  END IF;
  IF (SELECT count(*) FROM public.registration_name_roster WHERE is_public) <> 916 THEN
    RAISE EXCEPTION 'Unexpected public name-roster count';
  END IF;
  IF (
    SELECT count(*)
    FROM public.person_merge_decisions decision
    JOIN public.people duplicate_person ON duplicate_person.id = decision.duplicate_person_id
    WHERE duplicate_person.external_id LIKE 'pow-cec-registration-person-2026-%'
      AND decision.status IN ('suggested', 'verified')
  ) <> 4 THEN
    RAISE EXCEPTION 'Unexpected registration merge-decision count';
  END IF;
END
\$check\$;

-- Remove every public surface introduced by the 2026 registration batch inside this transaction.
UPDATE public.candidates candidate
SET is_public = false
FROM public.races race
JOIN public.elections election ON election.id = race.election_id
WHERE candidate.race_id = race.id
  AND election.year = 2026
  AND candidate.candidacy_status = 'registered'
  AND candidate.registration_status = 'registered';

UPDATE public.registration_name_roster SET is_public = false WHERE is_public;

DELETE FROM public.person_merge_decisions decision
USING public.people duplicate_person
WHERE duplicate_person.id = decision.duplicate_person_id
  AND duplicate_person.external_id LIKE 'pow-cec-registration-person-2026-%';

UPDATE public.people
SET is_public = false
WHERE external_id LIKE 'pow-cec-registration-person-2026-%'
   OR id IN (${priorPrivateIdsSql});

DO \$refresh\$
BEGIN
  PERFORM public.refresh_public_people_list_cached();
  PERFORM published.promote(NULL);
END
\$refresh\$;

CREATE TEMP TABLE audit_current_before_registration AS
SELECT
  person_id,
  list_role,
  current_office_label,
  pg_temp.office_category(list_role, current_office_label) AS office_category
FROM published.people
WHERE list_status = 'current';

WITH exact_changes AS (
  SELECT
    COALESCE(after.person_id, before.person_id) AS person_id
  FROM audit_current_after after
  FULL JOIN audit_current_before_registration before USING (person_id)
  WHERE after.person_id IS NULL
     OR before.person_id IS NULL
     OR after.list_role IS DISTINCT FROM before.list_role
     OR after.current_office_label IS DISTINCT FROM before.current_office_label
     OR after.office_category IS DISTINCT FROM before.office_category
),
after_categories AS (
  SELECT office_category, count(*) AS people
  FROM audit_current_after
  GROUP BY office_category
),
before_categories AS (
  SELECT office_category, count(*) AS people
  FROM audit_current_before_registration
  GROUP BY office_category
),
after_roles AS (
  SELECT list_role, count(*) AS people
  FROM audit_current_after
  GROUP BY list_role
),
before_roles AS (
  SELECT list_role, count(*) AS people
  FROM audit_current_before_registration
  GROUP BY list_role
),
assignment_counts AS (
  SELECT role_key, count(*) AS people
  FROM public.current_office_assignments
  WHERE is_current
  GROUP BY role_key
)
SELECT json_build_object(
  'audited_at', now(),
  'scope', 'full-local-supabase',
  'simulation', 'rollback transaction with all public 2026 registration surfaces suppressed',
  'current_total_after', (SELECT count(*) FROM audit_current_after),
  'current_total_before_registration', (SELECT count(*) FROM audit_current_before_registration),
  'exact_roster_changes', (SELECT count(*) FROM exact_changes),
  'after_roster_hash', (
    SELECT md5(string_agg(person_id::text || '|' || list_role || '|' || COALESCE(current_office_label, ''), E'\\n' ORDER BY person_id))
    FROM audit_current_after
  ),
  'before_roster_hash', (
    SELECT md5(string_agg(person_id::text || '|' || list_role || '|' || COALESCE(current_office_label, ''), E'\\n' ORDER BY person_id))
    FROM audit_current_before_registration
  ),
  'counts_by_office', (
    SELECT json_object_agg(office_category, people ORDER BY office_category)
    FROM after_categories
  ),
  'counts_by_office_before_registration', (
    SELECT json_object_agg(office_category, people ORDER BY office_category)
    FROM before_categories
  ),
  'counts_by_site_role', (
    SELECT json_object_agg(list_role, people ORDER BY list_role)
    FROM after_roles
  ),
  'counts_by_site_role_before_registration', (
    SELECT json_object_agg(list_role, people ORDER BY list_role)
    FROM before_roles
  ),
  'current_assignment_counts', (
    SELECT json_object_agg(role_key, people ORDER BY role_key)
    FROM assignment_counts
  ),
  'registration_invariants', (
    SELECT json_build_object(
      'new_registration_people_with_current_office', new_registration_people_with_current_office,
      'elected_2026_candidate_rows', elected_2026_candidate_rows,
      'registration_sourced_current_assignments', registration_sourced_current_assignments
    )
    FROM audit_registration_invariants_after
  )
);
ROLLBACK;
`;

const output = execFileSync(
  'docker',
  ['exec', '-i', 'supabase_db_public-office-watch', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
  { input: sql, encoding: 'utf8', maxBuffer: 30e6 },
);
const report = JSON.parse(output.trim().split('\n').findLast((line) => line.startsWith('{')));

assert.equal(report.current_total_after, report.current_total_before_registration);
assert.equal(report.exact_roster_changes, 0);
assert.equal(report.after_roster_hash, report.before_roster_hash);
assert.deepEqual(report.counts_by_office, report.counts_by_office_before_registration);
assert.deepEqual(report.counts_by_site_role, report.counts_by_site_role_before_registration);
assert.deepEqual(report.registration_invariants, {
  new_registration_people_with_current_office: 0,
  elected_2026_candidate_rows: 0,
  registration_sourced_current_assignments: 0,
});

const categoryLabels = {
  president: '總統',
  vice_president: '副總統',
  legislator: '立法委員',
  county_city_chief: '直轄市長／縣市長',
  councilor: '直轄市／縣市議員',
  township_mayor: '鄉鎮市長',
  district_chief: '區長',
  township_representative: '鄉鎮市區民代表',
  village_chief: '村里長',
  local_deputy: '地方副首長',
  agency_head: '地方局處首長',
  other_current: '其他現任職位',
};

const orderedCategories = [
  'president',
  'vice_president',
  'legislator',
  'county_city_chief',
  'councilor',
  'township_mayor',
  'district_chief',
  'township_representative',
  'village_chief',
  'local_deputy',
  'agency_head',
  'other_current',
];

const jsonPath = 'docs/cec-registration-current-office-count-audit-2026-09-05.json';
const markdownPath = 'docs/cec-registration-current-office-count-audit-2026-09-05.md';
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');

const tableRows = orderedCategories
  .filter((category) => Object.hasOwn(report.counts_by_office, category))
  .map((category) => `| ${categoryLabels[category]} | ${report.counts_by_office_before_registration[category].toLocaleString('en-US')} | ${report.counts_by_office[category].toLocaleString('en-US')} | 0 |`)
  .join('\n');

const markdown = `# 2026 候選人登記匯入：現任職位數量稽核

稽核日期：2026-09-05
環境：完整本機 Supabase（正式環境未異動）

## 結論

本次候選人登記資料沒有異動現任名冊。暫時排除全部 2026 登記公開資料並重建公開快照後，現任總數仍為 **${report.current_total_after.toLocaleString('en-US')}**；逐人比對的人物 ID、網站職位分類與現任職稱差異均為 **0**。

| 職位 | 匯入前模擬 | 目前 | 差異 |
|---|---:|---:|---:|
${tableRows}
| **合計** | **${report.current_total_before_registration.toLocaleString('en-US')}** | **${report.current_total_after.toLocaleString('en-US')}** | **0** |

## 交叉檢查

- 現任名冊逐人雜湊一致：\`${report.after_roster_hash}\`
- 逐人名冊差異：${report.exact_roster_changes}
- 2026 登記來源新建人物被判為現任：${report.registration_invariants.new_registration_people_with_current_office}
- 2026 候選資料被標為已當選：${report.registration_invariants.elected_2026_candidate_rows}
- 以候選人登記來源建立的現任職位指派：${report.registration_invariants.registration_sourced_current_assignments}
- 立法委員現任數：${report.counts_by_office.legislator}（網站既有固定檢查值為 113）

稽核在單一資料庫交易內進行：先保存目前公開現任名冊，再暫時關閉本批 2026 已登記候選人、姓名名冊、新建人物與相關人物合併，重建公開快照後逐人比較，最後回滾交易，因此沒有留下測試資料或更改目前狀態。

> 「網站職位分類」原本會把部分含有「縣長」或「市長」字串的村里長誤歸到粗分類的地方首長。本報告依完整職稱尾碼重新分類，所以表格能正確拆出村里長、代表、鄉鎮市長及區長；這個既有分類顯示問題不影響本次前後一致性的結論。
`;
fs.writeFileSync(markdownPath, markdown);

console.log(JSON.stringify({
  result: 'pass',
  currentTotal: report.current_total_after,
  exactRosterChanges: report.exact_roster_changes,
  countsByOffice: report.counts_by_office,
  currentAssignmentCounts: report.current_assignment_counts,
  report: markdownPath,
  raw: jsonPath,
}, null, 2));
