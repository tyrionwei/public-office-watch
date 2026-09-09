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
