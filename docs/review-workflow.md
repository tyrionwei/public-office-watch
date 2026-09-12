# Review Workflow

## 審核流程

以下是資料貢獻的審核原則；各 importer 的 staging 表及發布入口不同，不能把所有人物 claim 都視為 `relation_candidates`。

1. 蒐集來源，保留來源 URL、資料日期、取得結果與可追溯紀錄。
2. 在已確認的本機環境保存 raw／staging，產生候選關聯或 claim。
3. 產出私人審核報告及決策紀錄。舊關聯流程使用 `report.md`、`changes.json`、`sources.json`、`rejected.json`；其他流程依其既有格式。
4. 人工核對來源、人物身分、精確選舉／候選紀錄與公開範圍。
5. **只有已確認可公開的貢獻**才整理到 `data-update/YYYY-MM-DD` branch 與 Pull Request。原始待審內容、被拒絕的敏感線索、安全報告及私人稽核產物不得自動隨 PR 公開；提交規則見 [CONTRIBUTING.md](../CONTRIBUTING.md#公開資料變更)。
6. 依相應 importer／release migration 的預覽及驗收結果發布；本機標記通過不代表正式資料已更新。正式寫入與部署遵守[環境及發布流程](deployment-environments.md)，另依明確授權執行。

### 更新、重試與證據要求

審核結論只適用於當時審過的來源內容、身分及選舉上下文。重新抓取內容改變、部分抓取失敗或人工決策在執行期間變動時，必須先重新比對，不得把舊結論直接套給新內容。以下是驗收要求，**不是宣告所有既有腳本已具備這些保護**：

- 保存本輪輸入版本／hash、前後狀態與部分失敗；失敗來源不應被當作成功的空資料覆寫已知內容。
- 審核更新前再次確認待審狀態與所審內容仍相同；已拒絕／封存決策不得被過期自動結果蓋掉。
- 重試需能分辨已完成與失敗步驟，保留修正及恢復線索；單一步驟成功不足以回報整批公開成功。
- 靜態規則檢查證明程式具有指定模式；合成 fixture 證明特定條件的行為；真實受影響筆數與來源正確性需另做有界查核，不從 fixture 推算。

司法／敏感資料仍依[刑事紀錄匯入與審核流程](legal-record-ingestion.md)，來源 eligibility 或自動比對分數不能替代官方證據、身分與公開決策。

### 自動審核的資料庫前置與恢復

`scripts/auto-review-person-claims.mjs` 的寫入使用 `public.auto_approve_person_claim`。這是本機研究工具的前置函式，來源在 [supabase/local-migrations/20260909072944_atomic_auto_review_person_claim.sql](../supabase/local-migrations/20260909072944_atomic_auto_review_person_claim.sql)，不在正式 migration 歷史內；公開前端、Worker及生日管理 Edge 不需要它。缺少函式會停止，不會退回逐表 PATCH。程式檔更新或安裝計畫不代表任何環境已套用 SQL。

先核對 [full-local 環境](local-supabase-validation.md)，再使用本機安裝入口：

```bash
# 預設僅列出 SQL、雜湊與固定目標；不連 Docker 或資料庫。
npm run review:person-claims:install-local
# 唯讀核對執行中的本機容器、資料庫前置與函式是否存在。
npm run review:person-claims:install-local -- --check
# 僅在已授權本機 schema 寫入時執行。
npm run review:person-claims:install-local -- --apply-local
```

安裝工具固定使用本機 Docker socket，核對 `public-office-watch` 的專案標籤、目前工作目錄與實際 DB port 54322，再以該容器不可變 ID 和容器內 Unix socket 執行 SQL。它不接受 linked project、DB URL、容器或 rehearsal 目標覆寫，也不讀取正式連線憑證。`--check` 只回報函式存在性與應用角色權限，不保證已存在函式的內容等同目前來源；`--apply-local` 執行這份固定 SQL 的交易，接著驗證 SECURITY INVOKER 及角色權限。失敗不得宣稱安裝成功；SQL 已提交而後續驗證失敗時，保留現狀查核，不重設資料庫或修改 ledger。

這份 SQL 可重複安裝以更新同一函式及 grants，不審核任何 claim、不填寫 `supabase_migrations.schema_migrations`，也沒有第二套 migration ledger。不要手動複製它回正式 migration 目錄、當成 seed 自動套用，或為消除 drift 在正式庫安裝。本機重建後如需自動審核，須另依授權安裝；隔離演練的目標與 SQL 執行另依其明確範圍處理。

自動審核 CLI 的 dry-run 與 write 都只接受 `http(s)` 的 `127.0.0.1`、`localhost` 或 `[::1]` origin；`localhost` 轉成 loopback IP，禁止含登入資訊、路徑、query、fragment 的網址及 HTTP 重新導向。每次 REST 請求仍核對相同 origin，遠端 `SUPABASE_URL` 會在送出 service key 前拒絕。不同本機埠仍可能指向不同服務，因此必須核對實際專案與測試授權；loopback 限制本身不能證明資料來源或憑證一致。

每筆呼叫核對 claim 的內容及審核前態；政黨歸屬還核對完整關聯集合，並在同一交易內更新 claim 與待審歸屬。回報使用資料庫實際更新筆數，衝突保留較新的決定；只有 service role 可從應用角色呼叫。這是單筆自動核准的交易保護，不表示所有審核入口或整批操作都是同一交易。

連線失敗而無法確定提交結果時，停止並重新讀取狀態、產生 dry-run，再決定續跑；不得依原提案筆數宣稱成功，也不要手動拆成多次寫入繞過保護。政黨候選人的不可變來源版本、人工決定與多步恢復另見[政黨候選人匯入規則](party-candidate-ingestion-2026.md#來源版本與重跑規則)。

## 狀態定義

- `pending`
- `verified`
- `rejected`
- `needs_more_evidence`
- `archived`

## 審核重點

- 是否有清楚來源
- 是否有足夠證據文字
- 是否存在同名同姓風險
- 是否涉及敏感個資
- 是否把推論誤寫為事實

## Local Review UI

- 目前決策：review 先保持 local-only。
- `/internal/review-queue` 只在 Vite local development 顯示。
- Production 不註冊此路由，也不得註冊 dev-only `/internal-api/review-claim`。
- 正式上線若需要審核頁，必須先獨立 PR 加帳號權限、操作紀錄、RLS / grant 驗證與 rollback plan。
- 此頁的待審 claim、人物背景與身分比對都由 Vite dev-only API 讀取，並透過 `/internal-api/review-claim` 更新本機 Supabase；瀏覽器不直接取得 internal views 或 service key。
- `通過` 會把 claim 標記為 `verified` / `public` / `is_public = true`。
- 政見只有在人物與確切 `candidate_id`／選舉同時確認後才能公開；未綁定參選紀錄時審核按鈕會停用。
- 現任議員的官方議會政見可在唯一對應該縣市 2022 年議員當選紀錄後公開。中選會公報政見可使用既有 OCR 文字公開，小錯字不阻擋；只有標題、空白或明顯無內容的辨識結果仍留待重抓或人工處理。候選 OCR 不會隨公開 claim 釋出。
- 政見待審區只保留中選會來源，以及政黨官方公布且明確對應 2026 候選人的政見；其他來源的未審政見保留來源與決策紀錄後封存，不直接刪除。這項規則不追溯撤下已完成審核並公開的資料。
- `標記錯誤` 會把 claim 標記為 `rejected` / `private` / `is_public = false`。
- 若錯誤 claim 來自 Wikidata，dev API 會把同一人物、同一 QID 的待審 claim 一起標記為 rejected，並把該人物寫入 `data-sources/person-enrichment-skipped.json`，記錄 rejected QID；之後 `fetch:wikidata-person-enrichment:retry` 會避開同一個 QID 再找。
- 若通過的是 Wikidata `external_id`，local review API 會立即通過同一人物、同一 QID 的低敏感欄位；`review:person-claims:write` 也會補跑同一條規則。敏感欄位仍留在 review queue。
- 資料 sync 重新 upsert `person_claims` 時，會保留既有 `verified`、`rejected`、`archived` 狀態，不得把已審核 claim 洗回 `pending`。

## 全站生日顯示設定

`/internal/update-admin` 沿用既有管理員登入及伺服器的 `app_metadata.chat_admin` 權限。生日設定區塊可以在完整生日（預設）與僅年份之間切換，立即儲存全站偏好；一般訪客不能修改。設定與變更紀錄在同一交易保存，版本衝突會要求重新整理，連線失敗時不假裝儲存成功。

此功能需先套用 `20260909083507_public_birth_date_display_setting.sql`，再更新 `update-admin` Edge Function與前端。`site_display_settings` 只有非敏感顯示偏好可供公開讀取；`site_display_setting_actions` 留在管理端。Edge Function以 `getUser()` 驗證非匿名管理員，再以service role呼叫限定RPC及寫入操作者ID；瀏覽器無RPC執行或資料表寫入權限。顯示開關不控制收集、claim審核狀態或公開API，完整日期繼續供內部比對，規則見[資料政策](data-policy.md#出生日期)。

## OpenClaw 限制

OpenClaw 不得 ad hoc 直接把資料寫成：

- `verified`
- `is_public = true`

唯一例外是可重跑、可檢查的自動審核腳本；目前 Wikidata 只允許已驗證 external ID 解鎖同 QID 的低敏感人物補充 claim。

`review:person-claims:write` 會修改 Supabase 資料，預設只應用在 local Supabase 或明確核准的寫入環境。

### 本機資料與研究進度中心

此頁第一版僅供 local 使用。是否提供正式版，以及正式版採取何種呈現方式，留待另外規劃；本次不新增公開入口或部署。

`/internal/data-progress` 的四區總覽由受保護、僅 GET 的 `/internal-api/data-progress` 提供；沿用本機連線、同源、工作階段與完整本機 Supabase URL 限制。只讀本機 `published.people`、`published.candidates`、內部審核佇列和固定路徑的 `tmp` 產物，不透過公開瀏覽器金鑰讀取待審資料，也不改排程、核准或發布。

統計契約實作在 `apps/web/build/internalDataProgress.ts` 的 `buildDataProgress`，版本為 `necessary-items-v1`：

- 已收錄人物：姓名為必要項目；有已收錄參選紀錄的人物另檢查學歷與經歷是否有內容。生日、外部 ID 不列入。這是欄位涵蓋檢查，不能取代來源內容與身分的人工品質查核。
- 參選紀錄：每筆檢查人物對應和來源名稱／HTTP(S) URL；往年另檢查當選／未當選结果。本年與未來結果等待適用日期契約，不以缺漏或完成計算。
- 上述分子／分母按「對象 × 必要項目」彙總，只代表可統計範圍。官方預期名冊未接入，因此尚未收錄的分母未知；任期、政見公報、政治獻金、投票所等尚無完整必要項目契約，明列未納入。司法與家族關係不以有無紀錄衡量人物完整度。
- 人物按 person ID 去重；參選紀錄按 candidate ID 計算。現任以公開名冊分類判定；本屆以本年參選紀錄篩選。過去參選／當選不直接推定曾任；歷史任期證據未接入時，曾任篩選顯示未知。地區、年份、結果必須匹配同一筆參選紀錄，未對應人物的身分待辦不強套人物篩選。
- 參選地區僅列縣市，選項取自所選年份的參選紀錄；所有年份可同時列出新舊縣市。優先使用當屆選區名稱保留歷史縣市，再沿行政區父層歸屬縣市，不把鄉鎮市區列入選單；臺北縣／新北市與桃園縣／桃園市依參選年份辨別。切換年份或快速視角會清除原縣市篩選，避免殘留不適用名稱。
- 搜尋分母是篩選人物與已保存候選池的交集，並揭露候選池／狀態時間；不將未在池內者自動判為依規則排除。首次完成要求三類各一筆成功結果與有效完成時間；到期採用原選取器的最近嘗試時間及 30 天冷卻規則。首次完成與近期失敗／到期可能重疊，不得相加。
- 待辦主張以 claim ID 去重，線索以既有 key 去重；已關聯現有 claim 的線索不重複加總。跨來源事件識別、核准至公開層對帳尚未接入，顯示未知。「建議可發布」仍不是已核准。主張時間是最近更新、線索時間是首次發現，不能混稱首次排隊時間。
- 每日／每週／審核顯示保存摘要與文件規則，實際排程啟用、即時執行及歷次最後完整成功尚未接入。摘要內任何失敗／降級／備援證據均阻止完整成功判斷；有摘要不代表已逐项核對產物雜湊或全部審完。

所有來源分開記錄錯誤；分頁讀取失敗會捨棄該來源的部分結果，受影響比例不計算。伺服器最多重用五分鐘快照，明列時間，可按「重新讀取」更新；快照來自多次唯讀查詢，不宣稱單一資料庫交易一致性。明細每頁 25 筆，篩選／分頁保存於 URL，審核入口帶受限本機返回路徑。這些狀態不代表正式站的資料或部署進度。

驗證涵蓋 `apps/web/tests/internalDataProgress.test.ts`（分母、去重、讀取失敗、搜尋完成、舊摘要降級、任職分類、分頁）與 `apps/web/tests/internal-review-security.test.mjs`（本機權限及禁止遠端資料庫）。
