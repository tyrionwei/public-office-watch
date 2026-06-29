# Supabase Provider Readiness Checklist

## 目前狀態

- app 仍使用 `mockPublicDataProvider`。
- Supabase provider skeleton 已存在。
- Supabase provider mapping 已建立，但仍未啟用。
- local-only provider factory 已存在。
- local smoke script 已存在。
- data boundary check script 已存在。
- internal review route / API 仍維持 local-only，production 不啟用。

## 啟用 Supabase provider 前必須完成

- Supabase local public views 已存在。
- production public views 已存在。
- public view 欄位契約已與 `apps/web/src/types/publicViews.ts` 對齊。
- 已實測 Supabase provider mapping 與 finalized public view 欄位契約一致。
- anon key 只能讀取 public views。
- local toggle 不代表 production 已啟用。
- service role key 不得進前端。
- `DATABASE_CONNECTION_STRING` 不得進前端。
- raw、staging、review tables 不得被 anon key 讀取。
- production 不得註冊 `/internal/review-queue` 或 dev-only `/internal-api/review-claim`。
- RLS 與 grants 已完成檢查。
- smoke script 對所有 allowed public views 通過。
- public view contract check 通過，或在缺 env 時中性 skip。
- 已確認 anon key 只能讀取 allowed public views。
- page empty state 與 fallback 已確認。
- gitleaks 通過。
- `npm run build`、`npm run lint`、`npm run check:data-boundary` 通過。
- CI 不應注入 service role key。

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
- `public_person_identity_sources`
- `public_person_claims`
- `public_person_party_affiliations`
- `public_parties`
- `public_party_finance_summaries`
- `public_party_company_contribution_summaries`

## 禁止前端讀取

- `relation_candidates`
- `raw_source_records`
- `source_documents`
- `person_media` raw table
- `source_people`
- `person_identity_matches`
- `person_claims`
- `identity_unmatched_source_people`
- `identity_probable_match_queue`
- `person_claim_review_queue`
- `party_finance_reports`
- `party_company_contributions`
- `pending` / `rejected` data source
- service role key
- `DATABASE_CONNECTION_STRING`

## Provider 切換原則

- 不得直接在 page import Supabase client。
- page 只能透過 `publicDataProvider` 讀資料。
- 切換 provider 必須集中在 `publicData.ts` 或明確 provider factory。
- 必須保留 mock fallback 或 safe empty state。
- 切換前須先完成 PR review。
- production provider 啟用應走獨立 PR。
