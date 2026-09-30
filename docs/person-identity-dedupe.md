# Person Identity Dedupe

Person dedupe is identity-first. Political context can help review, but it must not be the primary merge rule.

## Primary Identity Signals

Use these signals for merge candidates:

- Shared stable person ID with independent attribution review; the current automatic allowlist is reviewed Wikidata QIDs. Election-record keys are excluded.
- Same normalized name, same known gender, and the same full birth date from reviewed official sources (manual comparison only).

A-level automatic merge requires independently reviewed stable external person IDs and no identity conflicts. Same name, gender, and birth date is a strong B-level candidate unless another stable identifier confirms the pair.

## Context-Only Signals

These fields can change over time and are not stable identity fields:

- Party
- District
- Position
- Candidate region

Context-only signals can move a same-name pair into manual review, but they must not create an automatic merge candidate by themselves.

## Conflict Signals

These should block automatic merge and mark the pair as likely different people:

- Different known gender.
- Incompatible reviewed official birth dates; a year or month prefix is not a conflict with a compatible complete date.

## Current Automation Boundary

- `report-duplicate-people.mjs` uses this policy for file-based review reports.
- `person_duplicate_review_queue` should emit A-level pairs only for shared verified external IDs.
- `apply-person-merge-decisions.mjs` defaults to A-level pairs only.
- B/C/D pairs require manual review; the automatic apply command cannot verify them.

Party changes, district changes, and career progression should be represented as history or claims, not as identity proofs.

## 2026 參選人物本機盤點

使用完整本機唯讀快照的原始 people、candidates（含 year/race_title/race_type）、canonical map、merge decisions、duplicate queue、claims、identity matches 與 source people；不得用公開 view 或原報表的 10,000 筆／500 組預設取样代表全範圍。既有 buildDuplicateReport 已可匯入重用，原命令介面不變。

`node scripts/build-person-identity-audit.mjs SNAPSHOT.json OUTPUT_DIR [RESULTS.json] [LINKS.json]` 產生私人 HTML/JSON，保留 raw/canonical ID、年度選區、來源、影響與既有決策。LINKS.json 補獨立司法線索、政黨、公司、媒體、候選歷程等表的 ID／來源／狀態，不匯出回饋正文。RESULTS.json 加回已驗證套用結果。輸出放 local-data，不上 Git。

四類數量分開列新檢查項目與既有決策，並非人數。姓名差異或多個 verified 生日只是異常線索。rejected/archived 配對在 canonical 層排除，保留原決策。本工具穩定人物 ID 白名單暫限共同 verified Wikidata QID；其他官方人物 ID 留待逐類審核。生日讀 claim_value 或 claim_json.value，生日、性別、多 QID 衝突阻擋合併；同名性別生日仍待人工。cec-historical 是依來源檔、號次、姓名、地區產生的選舉紀錄鍵，不單獨支持自動合併。

本輪無新合併，不執行 apply-person-merge-decisions.mjs --write；該既有全域入口不能當成本輪限定決策套用。合併仍須既有審核與逐項關聯影響核對。

`node scripts/apply-person-identity-audit-local.mjs DECISIONS.json` 只支援有來源核對的 candidate_name 修正，預設交易回滾，--apply-local 才提交，--reverse 在全欄基準吻合時還原；不修改 person_id。來源雜湊／原文、完整候選基準與 full-local 容器專案／埠都需符合。重跑相同結果為 no-op。

相關測試：`node --test scripts/person-identity-audit.test.mjs scripts/review-official-candidate-snapshot.test.mjs`。另驗真實本機回滾、重跑冪等、反向回滾與逐列／跨表資料保存；離線測試不代表資料庫驗收。

## 2026-09 官方履歷來源政策

生日、學歷、經歷全站只採用核對身分與原文字段的官方 claim。政府機關的 `.gov.tw` 及中央研究院官方院士站是來源候選範圍，網址本身不構成核准。Wikidata、Wikipedia、VoteTW、媒體、政黨及個人網站的三欄留存原 claim，使用 `officialProfilePolicy.reason=source_policy_disabled`、`notAnErrorFinding=true` 標記來源政策停用並封存；不是判定內容錯誤。其他欄位及獨立參選、當選、任職事件不受此清理影響。

`official-profile-v1` 採用標記綁定原始 person ID、欄位、值及來源 URL。只有既有受信任資料庫審核／migration 可新增核對標記；匯入僅能保留完全相同的既有核對，不接受來件自我宣告。改值、改人或改來源都重新待審。官方生日保留 year/month/day 精度；前綴相容的部分日期不構成衝突，互斥官方日期不採用，年齡僅由完整、無衝突生日計算。真正的 1 月 1 日保留。

`review-existing-official-profile.mjs SNAPSHOT CLAIMS SEED_DIR OUTPUT [MANUAL_REVIEW]` 只讀既有封存與核對紀錄，產生私人決策清單；不蒐集新來源、不寫資料庫。手動原件核對需提供固定 claim/person/value/source 綁定、原件雜湊及頁碼。產物留在 `local-data/person-identity-audit-20260928/official-policy/`，不得追蹤上 Git。

資料變更檔 `20260928130407_enforce_official_person_profile_sources.sql` 先比對官方 claim 的ID／人物／值／來源基準；其他環境出現未核對或改值的已採用官方資料時直接中止，不能用套用政策當作清空官方值的捷徑。檔案保留原始 claim 與審核痕跡，重建人物欄位、公開投影、生日衍生表與快取。後續欄位變更逐人物更新主檔／生日、每個資料修改語句刷新一次人物快取。重新匯入、發布、合併不能繞過官方 claim gate。SQL 新標記的特權邊界是 postgres／supabase_admin；未來不得新增讓一般呼叫者任意寫 claim JSON 的特權函式。

`20260928133331_correct_reviewed_identity_links.sql` 撤下江聰明無效合併依據並隔離精確錯掛來源，保留正確 2018 臺東對照。2026 宜蘭候選人維持原 person_id，退出公開採用並等待獨立身分證據，不直接改成 name_only 或強掛宜蘭 2022 人物。保存官方公告姓名及李明哲不同人決策。重匯不得清除這些待審證據或自動改掛。

A 級自動線索目前只接受兩側獨立審核的 `wikidata:Q…`：`stablePersonIdReview.status=verified`、`independentEvidence=true` 與非空 evidenceUrl，並無身分衝突。`cec-historical` 是選舉紀錄鍵，不是人物 ID。其他官方 ID 尚未逐類核准前維持人工審核。相同姓名、生日、性別、政黨、選區均不單獨自動合併。

本輪發布檔尚未寫正式資料或部署。針對發布環境仍需核對資料 ID／基準與既有發布備份流程；本機結果不代表正式環境已更新。回復需使用本輪私人欄位前快照、定點 identity-before 與舊 view/function 定義，不能以重新匯入停用來源作為回復。

### 由既有登記原件採用生日與學歷

`registration-profile-evidence.mjs` 解析 `candidacy.claim_json.registrationEvidence.raw`，共用匯入只建立固定 claim_key 的非公開待審提案；登記 verified 不等於欄位核准。原文、日期精度、parent/person/candidate 與官方文件來源都保留。ROC 日期轉西元，遮蔽只保留確定的年／月，完整且無衝突才進年齡統計；學歷保留原述及肄業／在學等狀態，經歷不由參選事件代填。

本機逐欄審核後，使用 `prepare-registration-profile-backfill.mjs <私人審核資料夾> <官方原件資料夾>` 驗原件雜湊並產生決策，接著用 `build-registration-profile-release.mjs <decisions.json> <output.sql>` 產出可重跑變更檔；兩者都不直接連資料庫。採用需要獨立內容／身分 review；較新人工決策不能被舊 round2 pending 蓋掉，但只有停用第三方生日的配對仍需獨立身分橋接。既有官方值保留，實質生日衝突不覆蓋。

套用需要 `20260928154046_guard_registration_profile_adoption.sql`：精確凍結人物、候選、選區、來源與候選名稱／external ID，保留重匯前的欄位審核 metadata。parent或候選關聯／來源變更時，已採用履歷退回非公開待核；恢復登記 verified 不自動重新採用。更新沿用原本官方 claim、主檔、published、快取與年齡同步路徑，匯入帳號不取得 published 年齡表的直接寫入權限。

資料變更SQL會驗證原parent、candidate、canonical與既有官方值基準；不同環境的ID或證據不一致時必須先對齊，不繞過guard。完整研究決策及含待審資料的SQL保留 `local-data/`，不得直接追蹤或發布。本機回歸入口為 `tests/sql/registration-profile-backfill.sql`，需在本輪審核SQL之後、同一回滾transaction內執行；不以全站測試代替本機人物頁抽查。
