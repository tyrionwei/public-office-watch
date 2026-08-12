# Frontend Public Data Access

## 目前狀態

- 前端目前仍使用 `mockPublicDataProvider` 作為安全預設。
- `supabasePublicDataProvider` mapping 已存在，但目前仍未啟用為預設 provider。
- local provider factory 已存在，可用於本機 smoke / readiness validation。
- internal review route / API 仍維持 local-only，production 不啟用。
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
- CI 應執行 `npm run check:data-boundary`、`npm run check:published-exposure` 與 `npm run check:public-view-contracts`。
- `check:public-view-contracts` 驗證舊 `public_*` 介面無法由匿名角色讀取。

## Local provider toggle

- 真實資料模式只允許 `VITE_PUBLIC_DATA_PROVIDER=published`。
- 必須同時設定 `VITE_ENABLE_PUBLISHED_PROVIDER=true`。
- page 仍只能透過 `publicDataProvider`。
- 不得在 page 直接 import Supabase client。
- `.env.local` 不得 commit。

## Production boundary

- 前端資料讀取與公開互動 RPC 必須走審核過的 `published` schema。
- 舊 `public_*` views 與 public RPC 不得作為 rollback 路徑。
- production 不得註冊 `/internal/review-queue` 或 dev-only `/internal-api/review-claim`。
- `/internal/chat-admin` 與 `/internal/update-admin` 上線時應再由 Cloudflare Access 保護。
- 必須保留 fallback 與 empty state。
- readiness checklist：`docs/cloudflare-production-security.md`
