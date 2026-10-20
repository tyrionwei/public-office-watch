# Person Identity Dedupe

Person dedupe is identity-first. Political context can help review, but it must not be the primary merge rule.

## 精簡批次流程（2026-10-17）

後續同名核對與合併沿用本節。使用者當次授權、環境規則及既有公開審核邊界優先；精簡不代表減少身分證據或資料保護。

1. **接續而非重做**：先讀最新批次摘要、來源獨審及必要的 `task-failures.md` 交接段落，確認 repo、分支與未提交變更。沿用同環境有效證據；DB 寫入前確認執行器解析的實際目標。不得重跑已完成合併或全庫盤點。
2. **限定一批**：按精確 UUID 的身分連通群組處理，不能只按姓名；來源支持不等於完成合併審核。缺證先查 22 縣市首長、立委等中央層級；僅村里長／代表級暫緩，有其他高階參選／當選史者才依高階範圍核對。鄉鎮市長不得算成 22 縣市首長。下一批預設最多 8 個姓名；擴大時須有具體理由，不默默延伸。
3. **少讀、短引、留原件**：先用已保存官方文件；只新增必要來源。短引足以辨認本人的出生資訊與具體跨屆經歷，不抄無助身分核對的細節。OCR、小字、失利事件與相似姓名須核本人原頁；無把握就省略疑字或保留缺證，不能猜。保留 URL、原件 hash、頁碼／號次、完整端點成員與參選事件、既有計畫 UUID 映射、未核限制。 判定整份文件內容不符前，先確認總頁數並查閱相關後續頁；合併多種選舉的 PDF 不得只憑首頁排除。 要排除整份多頁來源時，逐頁記錄選舉標題及目標候選號次的有無，交獨審確認後才定稿；只寫「已目視全部頁」不足以作排除依據。無新依據不重查舊缺證；已停止入口遵守原重開條件。
4. **集中分工與交付**：主代理負責目標、DB、計畫與報告；需要來源研究時一位 worker 寫該批目錄，獨立 reviewer 唯讀核對。沿已核證據，不重複開多名代理做同一檢查；不因省用量擅換模型或減少獨審。代理在選題、可審草稿、定稿／阻擋集中回報，修正集中一次提出；主代理等通知，不以 10 秒短輪詢追進度。必要等待採有上限的較長等待，並遵守互動回報時限。
5. **先快照再產計畫**：新批目錄保存 fresh before-image，先核根端點、原始成員與來源，不複用舊批固定 UUID／筆數假設。既有腳本只改本批必要參數與路徑；輸出簡短計數及差異，不把大段原始資料反覆送進對話。全局 refactor 另案處理，不能為省事降低斷言。
6. **合併驗證不可省**：計畫／回復靜態獨審 → 交易演練及逐欄公開輸出獨審 → 已授權本機套用 → 匿名公開 RPC 讀回、依賴包與親屬引用、實際隊列歸戶 → 精確 after-image 回復演練 → 最後讀回。相依步驟集中順序執行，任一步失敗即停；同一版本通過的檢查不重跑，後續修改／回復演練後的必要讀回另計。原始人物／參選／主張、舊決策、票數／政黨／結果／現任標籤及私人邊界須保留；任何預期顯示差異逐欄審核。非敏感基本資料的新公開差異也須明列原件依據，不能冒稱原已公開；敏感資料仍需既定公開授權。
7. **一次收尾**：只新增本批報告、摘要、驗證與 hash；連向前輪報告即可，不逐批改寫所有舊頁、產生器或備份。主代理驗同一最終版本一次，新增或改動才重驗受影響部分。私人產物留 `local-data/`，共用方法留本文件；必要阻擋／交接只記 `task-failures.md`，不另立第二份失敗帳。
8. **明確報告範圍**：分開列本輪已合併、新來源支持但尚未合併、不同人及缺證；來源待核數不是待合併數。標示本機／正式、通過／失敗／跳過／未執行。未取得使用量明細不能宣稱節省百分比；合併授權不代表推送、正式寫入或部署授權。保留既有主／子代理合計 2+1 重試上限，不因換批名／代理／對話重設。

環境與原始資料保存依 [本機驗證](local-supabase-validation.md)、[環境與發布](deployment-environments.md) 及 [Git 追蹤與本機保留](public-repo-security-checklist.md#git-追蹤與本機保留)。

### 早期缺證紀錄的公開取捨（2026-10-20）

使用者指定目標是減少無法辨識的同名人物頁，不是清理早期選舉紀錄：只針對同名頁中「僅有早期參選紀錄、只能核到出生年／年齡且身分仍缺證」的舊頁，在精確範圍審核後暫停公開，保留原始資料、來源及回復基準。同時有近年與早期紀錄的人物頁完全不處理，早期事件也保留，不做事件層拆除。這不是按年份全面撤下，也不撤下已有證據確認是不同人的歷史人物。符合條件的單純舊頁須先檢查任職及其他依賴，再將該頁及其對應公開投影退回私人待審。

公報狀態須區分「尚未核到本人公報」「已核公報僅年齡／出生年」「兩端完整生日已相符」；官方參選名錄不等於完整公報。完整生日與姓名等相符者進人工綜合判斷，禁止自動合併不等於禁止人工確認。研究暫緩標記本身不會撤下公開資料；實際撤下須驗公開投影、匿名入口、防重匯及精確回復，不能只改標籤。

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
