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

- `/internal/review-queue` 只在 Vite local development 顯示。
- Production 不註冊此路由；正式上線若需要審核頁，必須先加帳號權限與操作紀錄。
- 此頁讀 `person_claim_review_queue` 並透過 Vite dev-only `/internal-api/review-claim` 更新本機 Supabase。
- `通過` 會把 claim 標記為 `verified` / `public` / `is_public = true`。
- `標記錯誤` 會把 claim 標記為 `rejected` / `private` / `is_public = false`。
- 若錯誤 claim 來自 Wikidata，dev API 會把同一人物、同一 QID 的待審 claim 一起標記為 rejected，並把該人物寫入 `data-sources/person-enrichment-skipped.json`，記錄 rejected QID；之後 `fetch:wikidata-person-enrichment:retry` 會避開同一個 QID 再找。
- 若通過的是 Wikidata `external_id`，local review API 會立即通過同一人物、同一 QID 的低敏感欄位；`review:person-claims:write` 也會補跑同一條規則。敏感欄位仍留在 review queue。
- 資料 sync 重新 upsert `person_claims` 時，會保留既有 `verified`、`rejected`、`archived` 狀態，不得把已審核 claim 洗回 `pending`。

## OpenClaw 限制

OpenClaw 不得 ad hoc 直接把資料寫成：

- `verified`
- `is_public = true`

唯一例外是可重跑、可檢查的自動審核腳本；目前 Wikidata 只允許已驗證 external ID 解鎖同 QID 的低敏感人物補充 claim。
