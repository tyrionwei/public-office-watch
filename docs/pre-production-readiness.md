# Pre-Production Readiness

## 目前狀態

- app default provider 仍是 mock。
- local dev 可以用 provider factory 測試 Supabase public provider。
- CI 已執行 frontend checks。
- Supabase public provider mapping 已存在。
- 尚未啟用 production Supabase provider。

## Production 前必跑 checks

```bash
cd apps/web
npm ci
npm run build
npm run lint
npm run check:data-boundary
npm run smoke:public-views
npm run check:public-view-contracts
npm run preflight:production-readiness
```

## Production 前安全檢查

- 執行 gitleaks。
- 確認 repo 內沒有 `.env` / `.env.local`。
- 確認沒有 service role key。
- 確認沒有 `DATABASE_CONNECTION_STRING`。
- 確認 anon key 只能讀取 public views。
- 確認 raw / staging / review tables 不可由 anon key 讀取。
- 確認 public views 欄位契約與 `publicViews.ts` / mapper 對齊。
- 確認 empty state 與 fallback。
- 確認 `publicDataProvider` 切換集中在 provider factory。
- 確認 page 不直接 import Supabase client。

## Allowed public views

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

## Forbidden frontend sources

- `relation_candidates`
- `raw_source_records`
- `source_documents`
- `person_media` raw table
- `pending` / `rejected` data source
- service role key
- `DATABASE_CONNECTION_STRING`

- local validation runbook：`docs/local-supabase-validation.md`
- production enable plan：`docs/production-provider-enable-plan.md`

## Production provider 啟用前最後門檻

- 必須獨立 PR。
- 必須有 local smoke test 結果。
- 必須有 public view contract check 結果。
- 必須確認 hosting env 只有 anon key。
- 必須確認 production build 通過。
- 必須確認 data boundary check 通過。
