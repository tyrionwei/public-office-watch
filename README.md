# Public Office Watch

台灣民代、候選人與其可驗證公司關聯的官方資料整理專案。

## 目標

建立一套可追溯、可人工審核、可安全匯入資料庫的資料更新 MVP。
目前不做前端公開網站，也不抓取真實政治人物資料作為種子資料。

## Phase 1 已完成

- samples、Importer、GitHub Actions 已進入 `main`
- dry-run 驗證流程已建立
- database schema / RLS 已完成安全硬化
- PR template 與 workflow 驗證流程已建立

## Phase 2 目標：staging import

本階段目標是安全地把候選資料匯入 staging / raw / candidate tables。

限制：
- 不得寫入 `person_company_relations`
- 不得寫入 `verified`
- 不得寫入 `is_public = TRUE`
- 不連 production Supabase secrets 到 GitHub Actions

## 專案原則

- 不直接公開未審核資料
- 不自動推論家族企業
- 每筆資料都保留來源與證據
- 僅使用官方或可信公開來源
- 不提交任何 secrets
- 第一階段 / 第二階段都必須先能 dry-run

## Git 工作流

- `main` 視為穩定分支
- 日後資料更新請使用 `data-update/YYYY-MM-DD` branch
- 功能與工具強化可使用 `feature/*` 或 `chore/*` branch
- 不直接 push 到 `main`
- 以 Pull Request 方式審核後合併

## 結構

- `docs/`：政策、流程、資料來源說明
- `database/schema.sql`：完整 schema 快照
- `database/rls-policies.sql`：完整 RLS 快照
- `database/migrations/*`：實際建置資料庫時使用的版本化 SQL
- `database/queries/`：驗證與檢查查詢
- `samples/`：範例報告與 JSON
- `data-updates/`：每次更新產物
- `src/Importer/`：.NET 8 匯入工具
- `local-data/`：本地 raw / cache / logs / snapshots，不進 Git

## Importer 使用方式

### dry-run（預設）

```bash
dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- --dry-run samples/sample-changes.json
```

```bash
dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- --dry-run data-updates/YYYY-MM-DD/changes.json
```

若未指定模式，預設為 `--dry-run`。

### execute

```bash
dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- --execute samples/sample-changes.json
```

## DATABASE_CONNECTION_STRING

`--execute` 模式必須提供：

```text
DATABASE_CONNECTION_STRING
```

此環境變數不得寫入 repo。

## execute 模式保證

`--execute` 只允許寫入：
- `raw_source_records`
- `source_documents`
- `relation_candidates`

`--execute` 不得寫入：
- `people`
- `companies`
- `person_company_relations`

此外：
- 不得產生 `verified`
- 不得產生 `is_public = TRUE`
- 必須使用 transaction
- 任一筆失敗即 rollback

## logs

執行後可輸出 console summary。
log 檔案若有需要，請放在本地 `logs/` 或 `local-data/logs/`，不要提交到 Git。

## 目前狀態

1. Phase 1 已完成 dry-run 能力。
2. `main` 已包含 samples、Importer、GitHub Actions。
3. database schema / RLS 已完成安全硬化。
4. 尚未連接 Supabase production。
5. 尚未開始真實資料蒐集。
6. 尚未做前端 UI。
7. 尚未發布任何公開資料。
