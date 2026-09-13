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

日曆中的未來日期是正常改選任期規則，不是人物已當選或已就任的證明。正常改選由 `regular_office_term` 取投票日之後第一次固定就任日期，故年底投票可以對應隔年就任，不依預先建好的年份上限。若投票日正好等於固定日期，取下一年；缺投票日保持未知。任期日曆保留明確日期與來源，分類刷新時補記已公告選舉推得的任期。

`public.race_office_term_overrides` 用於補選或整場選舉的任期例外；`public.candidate_office_tenures` 用於個別人物延後就任、提前離職等已查證起訖日，皆須記錄來源與原因。`current_office_exclusions` 既有離職資料仍生效。不以正常月日推算補選或遞補；重行選舉若仍在正常任期開始前，可對應原正常任期。

`public.candidate_holds_office(candidate_id, date)` 要求當選且日期落在任期內，日期採 Asia/Taipei。`candidates.is_incumbent` 保留參選當時是否現任的歷史意義；目前任職使用公開欄位 `office_is_current`。

年度更新採三個 pg_cron 工作，台灣時間皆為當天 00:05：

| 工作 | 台灣日期 | UTC 排程 | 範圍 |
| --- | --- | --- | --- |
| `refresh-office-legislators` | 每年 2/1 | 1/31 16:05 | 立委 |
| `refresh-office-presidency` | 每年 5/20 | 5/19 16:05 | 總統／副總統 |
| `refresh-office-local` | 每年 12/25 | 12/24 16:05 | 地方民選公職 |

舊的每日 `refresh-office-term-status` 已移除。年度工作呼叫 `refresh_office_status_family`，先找該類公職相關的已公開當選人物，再由 `office_status_rows_for` 限制人物與參選紀錄的讀取範圍，僅更新 `person_office_status_cache` 中的任職呈現欄位。不同公職可能涉及同一人，因此會核對該人物其他現職，避免把轉任者整個標成卸任。年度排程不重建全站人物快取、不改參選當時的 `is_incumbent`，不發布待審資料。

`published.people` 合併這份局部快取，NULL 也會覆寫，確保卸任能清掉舊現任標示。一般資料發布或人工完整刷新仍使用 `refresh_public_people_list_cached`，完成後清除局部覆寫，避免舊快取蓋掉新資料。

補選、個別就任或離職紀錄確認後，需依既有資料更新流程刷新相關資料；本次沒有新增未知日期的補選自動排程。pg_cron 依賴資料庫運作，關機錯過時需補做分類刷新，可由 `cron.job_run_details` 查核執行結果。

來源：總統府 https://www.president.gov.tw/Page/87 、立法院歷史長廊 https://aam.ly.gov.tw/P016001_01.do 、內政部 https://www.moi.gov.tw/News_Content.aspx?n=2&s=260703 。

### 本機驗證紀錄

- 通過：99 項投票、首頁職稱、公開讀取、人物資料相關測試；TypeScript；`git diff --check`。
- 通過：任期邊界 SQL 交易回滾測試、完整公開人物快取刷新（60 秒限制內）、匿名政見查詢，蔣萬安 11 項開放日為 2023-12-25。
- 曾失敗、已修正：逐人查詢及重複人物對應造成快取測試逾時；改為整批計算，人物對應只物化一次後通過。
- 未完成：瀏覽器測試兩次停在啟動階段，已停止程序，不能視為畫面驗證通過。
- 已套用完整本機資料庫，設定本機分類年度刷新。尚未 commit、推送或部署正式站；正式站需循既有發布流程套用 migration 後才生效。

- 年度分類更新驗證：固定日期、跨年、同日取下一年、未知日期、三組 UTC／台灣年度排程均通過；立委局部更新 239 位相關人物，全站快取逐列比對未變動，局部與完整任職標示比對一致。匿名使用者無刷新權限。測試入口：`scripts/sql/annual-office-refresh-regression.sql`。
