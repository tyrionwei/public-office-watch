# Public Office Watch

台灣民代、候選人與其可驗證公司關聯的官方公開資料整理專案。

## 目標

建立一套可追溯、可人工審核、可安全匯入資料庫的資料更新 MVP。

目前階段：
- 不做前端公開網站
- 不抓取真實政治人物資料作為種子資料
- 不連 production Supabase
- 不公開未審核資料

## 專案原則

- 不直接公開未審核資料
- 不自動推論家族企業
- 每筆資料都保留來源與證據
- 僅使用官方或可信公開來源
- 不提交任何 secrets
- 所有資料更新先 dry-run，再人工審核

## 目前完成

- Importer dry-run
- Importer execute staging import
- Local Supabase migrations
- GitHub Actions dry-run
- Public repo security checklist
- Gitleaks 掃描流程

## 資料流程

```text
changes.json
→ Importer validation
→ raw_source_records / source_documents / relation_candidates
→ 人工審核
→ promote candidate
→ public views
→ 前端顯示 verified + public 資料
```

## 目錄結構

- `docs/`：政策、流程、資料來源說明
- `database/`：schema snapshot、RLS snapshot、驗證 SQL
- `supabase/migrations/`：Supabase local / future deploy migration
- `samples/`：範例資料
- `data-updates/`：每次資料更新候選報告與 JSON diff
- `src/Importer/`：.NET 8 匯入工具
- `local-data/`：本機資料，不進 Git
- `logs/`：本機 log，不進 Git

## Importer 使用方式

dry-run：

```bash
dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- --dry-run samples/sample-changes.json
```

execute staging import：

```bash
dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- --execute samples/sample-changes.json
```

execute 模式只允許寫入：

- `raw_source_records`
- `source_documents`
- `relation_candidates`

不得寫入：

- `people`
- `companies`
- `person_company_relations`

不得產生：

- `verified`
- `is_public = true`

## Local Supabase

clone 既有 repo 後通常不需要重新 init，直接：

```bash
npx supabase start
npx supabase migration up
npx supabase status
```

local Supabase only example，不可用於 production：

```bash
export DATABASE_CONNECTION_STRING="Host=127.0.0.1;Port=54322;Database=postgres;Username=postgres;Password=postgres"
```

實際連線資訊以 `npx supabase status` 顯示為準。

## 安全提醒

- 不提交 `.env`
- 不提交 service role key
- 不提交 production connection string
- 不提交真實政治人物測試資料
- 不提交 `logs/` / `local-data/`
- 若 secret 曾被 push，必須 rotate secret，再清 history

## 尚未完成

- promote candidate CLI
- public views
- 前端網站
- 真實資料小範圍測試
- production Supabase 部署
