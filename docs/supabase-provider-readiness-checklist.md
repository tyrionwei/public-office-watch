# Supabase Provider Readiness Checklist

## 目前狀態

- app 仍使用 `mockPublicDataProvider`。
- Supabase provider skeleton 已存在。
- local smoke script 已存在。
- data boundary check script 已存在。

## 啟用 Supabase provider 前必須完成

- Supabase local public views 已存在。
- production public views 已存在。
- public view 欄位契約已與 `apps/web/src/types/publicViews.ts` 對齊。
- anon key 只能讀取 public views。
- service role key 不得進前端。
- `DATABASE_CONNECTION_STRING` 不得進前端。
- raw、staging、review tables 不得被 anon key 讀取。
- RLS 與 grants 已完成檢查。
- smoke script 對所有 allowed public views 通過。
- page empty state 與 fallback 已確認。
- gitleaks 通過。
- `npm run build`、`npm run lint`、`npm run check:data-boundary` 通過。

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

## Provider 切換原則

- 不得直接在 page import Supabase client。
- page 只能透過 `publicDataProvider` 讀資料。
- 切換 provider 必須集中在 `publicData.ts` 或明確 provider factory。
- 必須保留 mock fallback 或 safe empty state。
- 切換前須先完成 PR review。
