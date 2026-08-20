# Review Workflow

## 審核流程

1. 蒐集公開資料
2. 寫入 `raw_source_records`
3. 產生 `relation_candidates`
4. 產出 `report.md`、`changes.json`、`sources.json`、`rejected.json`
5. 建立 `data-update/YYYY-MM-DD` branch
6. 提交 Pull Request
7. 人工審核
8. 審核通過後匯入 staging / 正式表

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

## OpenClaw 限制

OpenClaw 不得 ad hoc 直接把資料寫成：

- `verified`
- `is_public = true`

唯一例外是可重跑、可檢查的自動審核腳本；目前 Wikidata 只允許已驗證 external ID 解鎖同 QID 的低敏感人物補充 claim。

`review:person-claims:write` 會修改 Supabase 資料，預設只應用在 local Supabase 或明確核准的寫入環境。
