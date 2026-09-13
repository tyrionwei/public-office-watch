# Candidate status model

Candidate records separate candidacy progress from election results.

## Public fields

- `candidacy_status`: the latest verified stage of the candidacy.
- `election_result`: the outcome of voting, independent from candidacy progress.
- `status_updated_at`: when either status last changed.
- `source_name` and `source_url`: the source supporting the candidate record.

`registration_status` and `is_elected` remain temporarily available as legacy
fields while import scripts and deployed databases migrate. New UI code must not
use them to decide the displayed status.

## Candidacy stages

| Value | Meaning |
| --- | --- |
| `potential` | Publicly discussed or otherwise identified as a possible candidate, but not yet nominated or registered. |
| `party_nominee` | Nominated by a political party. |
| `officially_announced` | The person has publicly announced a candidacy. |
| `registered` | Registration was submitted to the election authority. |
| `qualified` | Candidate qualification was confirmed by the election authority. |
| `withdrawn_or_disqualified` | The candidacy ended through withdrawal or disqualification. |
| `did_not_register` | A nominated or announced person did not file before registration closed, confirmed against a complete official named roster. |
| `unknown` | Available sources do not establish a stage. |

These values describe evidence, not a guaranteed linear workflow. For example,
an independent candidate may move from `officially_announced` directly to
`registered` without a `party_nominee` stage.

## Election results

| Value | Meaning |
| --- | --- |
| `pending` | Voting or result publication has not completed. |
| `elected` | The official result records the candidate as elected. |
| `not_elected` | The official result records the candidate as not elected. |
| `unknown` | No reliable result is available. |

Completed elections display `election_result`. Upcoming elections display
`candidacy_status`. Candidate profile records may show both fields so the
registration evidence and final result remain independently traceable.

## Legacy migration

- `pending` becomes `potential`.
- `registered` and `qualified` retain their meaning.
- `withdrawn` and `disqualified` become `withdrawn_or_disqualified`.
- `not_registered` becomes `did_not_register`.
- Historical `elected` and `not_elected` candidates become `qualified`, with
  their outcome written to `election_result`.
- Active races without an official outcome use `election_result = pending`.

Every migrated candidate receives a private baseline entry in
`candidate_status_history`. Later status changes create additional internal
history rows. They are not public until a separate review and publication flow
is implemented.

## 就任日期與現任切換（2026-09-12）

`election_result = elected` 只表示該次當選，不代表已就任。
共用日曆 `public.office_term_calendar` 記錄明確的任期起日與迄日（迄日不含當天），以及來源網址：

- 總統、副總統：正常任期 5/20，已建 1996–2028 年各屆日曆。
- 立委：2/1，已建 1993–2028 年各屆日曆；2008 年前按三年任期，之後四年。
- 地方民選公職：2014 年起 12/25，已建至 2030 年；更早資料不推算。

日曆中的未來日期是正常改選任期規則，不是人物已當選或已就任的證明。正常改選由 `regular_office_term` 取投票日之後第一次固定就任日期，故年底投票可以對應隔年就任，不依預先建好的年份上限。若投票日正好等於固定日期，取下一年；缺投票日保持未知。任期日曆保留明確日期與來源，本機發布工具依已公告選舉推得任期，再經人工核准。

`public.race_office_term_overrides` 用於補選或整場選舉的任期例外；`public.candidate_office_tenures` 用於個別人物延後就任、提前離職等已查證起訖日，皆須記錄來源與原因。`current_office_exclusions` 既有離職資料仍生效。不以正常月日推算補選或遞補；重行選舉若仍在正常任期開始前，可對應原正常任期。

`public.candidate_holds_office(candidate_id, date)` 要求當選且日期落在任期內，日期採 Asia/Taipei。`candidates.is_incumbent` 保留參選當時是否現任的歷史意義；目前任職使用公開欄位 `office_is_current`。

## 本機審核、公職專用發布（2026-09-13）

取消正式端的三組年度整批重算。`office-release.mjs` 在本機分批讀取指定公職相關人物，整理同一人的各次已公開當選任期，輸出指定日期的前後差異。來源或日期不足、未知提前離任、其他任命職務不能安全涵蓋時，整個人物留在 blocked 清單；不因為需要清空待辦而猜測。

核准綁定精確草稿雜湊與人物 ID 清單；公職專用發布包只允許任期、來源、版本與八個任職呈現欄位。正式端要求人物、當選紀錄已公開，且公開版本、公職版本與人物指紋都仍符合基準。它不新增人物、不發布 Claims，也不修改回饋或投票。

`reviewed_office_terms` 保存核准任期，`reviewed_office_profiles` 保存沒有已生效／已結束任期時的空白狀態，`office_release_history` 保存套用及回復歷程。一般人物快取刷新不刪除這些資料。

人物頁、名單與首頁席次透過 `reviewed_office_snapshot` 共用台灣日期判斷；`people_directory` 是日期覆層，底層 `people_directory_snapshot` 仍供一般發布刷新。已知任期到期，不需本機啟動或排程重算。新任者尚未核准時，不把舊任者繼續當成現任。`candidate_office_term`、`candidate_holds_office` 也優先使用核准任期；提前離任不會改寫原就職日或政見投票的一年起算日。

正常任期的固定月日規則不變；补選、遞補及提前離任仍需來源確認後另行發布。未納入核准任期的人物暫沿用舊讀取邏輯，不能宣稱已完成全站日期切換。首批正式公職包的覆蓋審核是發布門檻，不能只部署結構、移除排程就算完成遷移。

操作、版本衝突與回復步驟見 [部署環境文件](deployment-environments.md#reviewed-office-release-workflow)。日期與套用回歸分別位於 `scripts/sql/annual-office-refresh-regression.sql`、`tests/sql/reviewed-office-release.sql`。


### 再次參選與候選視圖修正（2026-09-13）

`20260913104427` 將分類組合統一為有效現任、當前有效參選、曾任。
參選資格取目前 `published.candidate_facts` 及公開選舉日期／狀態；潛在、提名、已宣布、登記、資格確認的已公開且未結束參選，以及已核准任期但尚未就職的當選者，可以顯示候選。
退選、取消、落選或投票日期已過而仍未確認當選者，不沿用舊候選快照；日期未知時也不跨年度永久保留。舊發布包的候選 fallback 不再決定目前分類。

本機 baseline 和 draft 新增 `candidacyContextVersion`，草稿以同一份公开參選脈絡預覽；舊草稿需重新產生、核准，不能直接套用。
Migration 另盤點並重綁所有仍引用 `_source` 函式物件的視圖（本機確認為 `public.public_candidates` 與 `published.candidates`），不恢復瀏覽器對來源副本的權限。
回歸入口為 `tests/sql/reviewed-office-candidacy.sql`，在原發布回歸之後、同一回滾交易內執行。
