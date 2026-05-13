# Frontend Public Data Access

## 目前狀態

- 前端目前仍使用 `mockPublicDataProvider`。
- `supabasePublicDataProvider` mapping 已存在，但目前仍未啟用為預設 provider。
- `HomePage`、`RegionPage`、`ElectionPage` 仍透過 `publicDataProvider` 讀資料。

## 允許前端讀取的 public views

- `public_people`
- `public_companies`
- `public_relation_details`
- `public_regions`
- `public_elections`
- `public_races`
- `public_candidates`
- `public_home_election_ticker`
- `public_region_election_summary`
- `public_person_primary_photos`

## 禁止前端讀取

- `relation_candidates`
- `raw_source_records`
- `source_documents`
- `person_media` raw table
- `pending` / `rejected` data source
- service role key
- `DATABASE_CONNECTION_STRING`

## Local smoke test

```bash
cd apps/web
cp .env.example .env.local
# 手動填入 local Supabase URL 與 anon key
npm run smoke:public-views
```

注意事項：

- `.env.local` 不得 commit。
- 只能使用 anon public key。
- 不得使用 service role key。
- smoke script 只測試允許的 public views。
- smoke script 不會印出資料內容。
- 可搭配 `npm run check:data-boundary` 檢查 page 是否繞過 `publicDataProvider`。
- CI 應執行 `npm run check:data-boundary`。
- CI 可執行 `npm run smoke:public-views`，但不得配置 service role key。

## Provider 切換規劃

- Phase 4K 仍不切換 provider。
- 未來要切換到 Supabase 前，必須先完成 RLS、grants、public views 檢查。
- 前端只允許讀取 public views。
- 必須保留 fallback 與 empty state。
- readiness checklist：`docs/supabase-provider-readiness-checklist.md`
