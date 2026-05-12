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
- Election / Region / Race / Candidate schema
- Person media schema

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

## Promote candidate

promote 是人工審核通過後，將單筆 `relation_candidates` 正式轉成公開資料的受控動作。

- 只支援人工指定單筆 `candidateId`
- 不支援 promote all
- `confidence_suggestion = D` 不可 promote
- promote 成功後才會進入 `public_*` views
- 前端未來只讀 `public_*` views，不讀 `relation_candidates`
- promote execute 必須帶 `--confirm`
- promote 需要 `DATABASE_CONNECTION_STRING`
- promote 目前只建議在 local Supabase 測試，不連 production

promote dry-run：

```bash
dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- --promote-candidate <candidateId> --dry-run
```

promote execute：

```bash
dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- --promote-candidate <candidateId> --confirm
```

## Local Supabase

clone 既有 repo 後通常不需要重新 init，直接：

```bash
npx supabase start
npx supabase migration up
npx supabase status
```

local Supabase only example，不可用於 production：

```bash
export DATABASE_CONNECTION_STRING="Host=127.0.0.1;Port=54322;Database=postgres;Username=postgres;Password=<local-password>"
```

實際連線資訊以 `npx supabase status` 顯示為準。

## 安全提醒

- 不提交 `.env`
- 不提交 service role key
- 不提交 production connection string
- 不提交真實政治人物測試資料
- 不提交 `logs/` / `local-data/`
- 若 secret 曾被 push，必須 rotate secret，再清 history

## Phase 3B：Election / Region schema

本階段新增 Election / Region / Race / Candidate schema，供未來以下功能使用：

- 台灣地圖
- 縣市頁
- 選舉項目頁
- 候選人列表

目前仍然：
- 不做前端 UI
- 不匯入真實候選人資料

## Phase 3C：Person media

本階段新增 `person_media`，供未來人物頁、候選人列表、搜尋結果顯示照片或 avatar。

- 照片必須有來源、授權、審核狀態
- 未通過審核或授權不明的照片不得公開
- 目前不抓真實人物照片
- 前端若沒有照片，應顯示預設 avatar

## Frontend design direction

前端視覺與資訊架構方向文件：
- `docs/frontend-design-direction.md`

目前尚未實作前端 UI。
下一步將建立 React / Vite 前端骨架。

## 尚未完成

- promote candidate CLI 的進一步 admin tooling
- public views 後續前端串接
- 前端網站
- 真實資料小範圍測試
- production Supabase 部署
