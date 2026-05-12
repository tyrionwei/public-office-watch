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
- `database/schema.sql`：可讀 schema snapshot
- `database/rls-policies.sql`：可讀 RLS snapshot
- `database/migrations/*`：專案內保留的版本化 SQL snapshot
- `database/queries/`：驗證與檢查查詢
- `supabase/migrations/*`：Supabase local / future deploy 使用的 migration
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

本地 Supabase 範例：

```bash
export DATABASE_CONNECTION_STRING="Host=127.0.0.1;Port=54322;Database=postgres;Username=postgres;Password=postgres"
```

實際連線資訊仍以 `npx supabase status` 顯示為準。

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

## Local Supabase Setup

### 需求

- Docker
- Supabase CLI（本專案可用 `npx supabase ...`）

### 初始化

```bash
npx supabase init
```

### 啟動 local Supabase

```bash
npx supabase start
```

### 套用 migration

```bash
npx supabase migration up
```

如果 CLI 版本不支援上述命令，請使用等效的 local migration 指令，並以成功建立 schema 為準。

### 檢查狀態

```bash
npx supabase status
```

### 設定 Importer 測試連線

```bash
export DATABASE_CONNECTION_STRING="Host=127.0.0.1;Port=54322;Database=postgres;Username=postgres;Password=postgres"
```

實際連線資訊以 `npx supabase status` 顯示為準，不要把 secrets 寫進 repo。

### Importer 測試

dry-run：

```bash
dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- --dry-run samples/sample-changes.json
```

execute：

```bash
dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- --execute samples/sample-changes.json
```

### 驗證 SQL

```sql
SELECT COUNT(*) FROM raw_source_records;
SELECT COUNT(*) FROM source_documents;
SELECT COUNT(*) FROM relation_candidates;
SELECT * FROM relation_candidates ORDER BY created_at DESC LIMIT 20;

SELECT COUNT(*)
FROM person_company_relations
WHERE verification_status = 'verified' OR is_public = TRUE;
```

Phase 2 測試後，最後一個查詢應為 `0`。

### 注意事項

- 不連正式 Supabase cloud project
- 不使用 production secrets
- 不抓取真實政治人物資料
- 不公開任何未審核資料
- 不做前端 UI

## 目前狀態

1. Phase 1 已完成 dry-run 能力。
2. `main` 已包含 samples、Importer、GitHub Actions。
3. database schema / RLS 已完成安全硬化。
4. 尚未連接 Supabase production。
5. 尚未開始真實資料蒐集。
6. 尚未做前端 UI。
7. 尚未發布任何公開資料。
