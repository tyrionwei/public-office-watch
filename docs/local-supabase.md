# Local Supabase

本文件說明如何在本機重現 Public Office Watch 的 local Supabase 開發環境，並驗證 importer 只會寫入 staging tables。

## 1. 安裝需求

- Docker
- Node.js 20+
- npm
- .NET 8 SDK

## 2. 安裝 Supabase CLI

本專案已將 Supabase CLI 固定為 `devDependency`，請在 repo 根目錄執行：

```bash
npm install
```

若需要手動加入，使用：

```bash
npm install supabase --save-dev
```

之後請一律使用：

```bash
npx supabase --version
```

## 3. 啟動 local Supabase

如果這個 repo 已經包含 `supabase/config.toml`，通常不需要重新 `init`。

首次建立 Supabase 專案時才需要：

```bash
npx supabase init
```

平常 clone 既有 repo 後，直接啟動即可：

```bash
npx supabase start
```

## 4. 套用 migration

```bash
npx supabase migration up
```

如果 `supabase start` 已自動套用 migration，這一步可能會顯示已經是最新狀態。

## 5. 查詢狀態

```bash
npx supabase status
```

請記下本機 Postgres 連線資訊，實際 port 以狀態輸出為準。

## 6. 設定 `DATABASE_CONNECTION_STRING`

範例：

```bash
export DATABASE_CONNECTION_STRING="Host=127.0.0.1;Port=54322;Database=postgres;Username=postgres;Password=postgres"
```

- 不要把這個值寫進 repo
- 不要使用 production secrets
- 不要連正式 Supabase cloud project

## 7. 執行 Importer dry-run

```bash
dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- --dry-run samples/sample-changes.json
```

`--dry-run` 應只做驗證與摘要輸出，不應寫入正式公開資料。

## 8. 執行 Importer execute

只有在 local Supabase 正在執行且 migration 已套用時才執行：

```bash
dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- --execute samples/sample-changes.json
```

安全限制：

- 只允許寫入 `raw_source_records`
- 只允許寫入 `source_documents`
- 只允許寫入 `relation_candidates`
- 不得寫入 `people`
- 不得寫入 `companies`
- 不得寫入 `person_company_relations`
- 不得公開未審核資料
- 不抓取真實政治人物資料

## 9. 執行 `verify_staging_import.sql`

可用檔案：

- `database/queries/verify_staging_import.sql`

查詢內容包含：

```sql
SELECT COUNT(*) FROM raw_source_records;
SELECT COUNT(*) FROM source_documents;
SELECT COUNT(*) FROM relation_candidates;
SELECT * FROM relation_candidates ORDER BY created_at DESC LIMIT 20;

SELECT COUNT(*)
FROM person_company_relations
WHERE verification_status = 'verified' OR is_public = TRUE;
```

## 10. 驗證 `person_company_relations` 的 verified/public count

最後一個查詢結果必須為：

```text
0
```

如果不是 `0`，代表流程突破了安全邊界，必須先停止並檢查。

## 11. 常見問題

### Docker 未啟動

症狀：`npx supabase start` 失敗，或 `docker info` 無法正常回應。

處理方式：

- 啟動 Docker Desktop
- 確認 WSL integration 已開啟
- 重新執行 `docker info`

### Port 被占用

症狀：`54321`、`54322`、`54323` 等 port 無法綁定。

處理方式：

- 檢查是否已有其他 Supabase / Postgres / API 服務在使用同樣 port
- 依需要調整 `supabase/config.toml`
- 重新執行 `npx supabase start`

### Migration 已套用

症狀：`npx supabase migration up` 顯示沒有待套用 migration。

處理方式：

- 這通常是正常現象
- 用 `npx supabase status` 確認 local stack 正常
- 直接繼續跑 importer 驗證

### Connection refused

症狀：Importer 或 SQL client 連不上 `127.0.0.1:54322`。

處理方式：

- 確認 `npx supabase start` 是否成功
- 確認 `npx supabase status` 顯示 DB 正在執行
- 確認 `DATABASE_CONNECTION_STRING` 的 host / port / user / password 是否與狀態輸出一致
