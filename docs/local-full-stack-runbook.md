# Local Full-Stack Runbook

## 目的

- 在本機驗證 importer、Supabase local、apps/web 可以一起工作。
- 先以 mock provider 確認 frontend 正常。
- 再以 local Supabase anon key 驗證 public views。
- 不碰 production deployment。

## 前置條件

- .NET 8
- Node.js 20
- npm
- Supabase CLI
- Docker
- gitleaks
- 本機不得提交 `.env` / `.env.local`

## 後端 / Supabase local 檢查

應先確認：

- Supabase local 可啟動
- migrations 已套用
- public views 存在
- anon key 只能讀 public views
- service role key 不得進 frontend

## 前端 mock mode

```bash
cd apps/web
npm ci
npm run build
npm run lint
npm run check:data-boundary
npm run smoke:public-views
npm run check:public-view-contracts
npm run preflight:production-readiness
npm run dev
```

- 無 `.env.local` 時應以 mock provider 正常運作。

## Local Supabase mode

```bash
cd apps/web
cp .env.example .env.local
```

手動填入：

- `VITE_SUPABASE_URL=local Supabase API URL`
- `VITE_SUPABASE_ANON_KEY=local anon key`
- `VITE_PUBLIC_DATA_PROVIDER=supabase`

然後執行：

- `npm run smoke:public-views`
- `npm run check:public-view-contracts`
- `npm run dev`

注意：

- 不得使用 service role key。
- 不得貼出 key。
- 不得提交 `.env.local`。
- 若資料不足，頁面應顯示 empty state / safe fallback。

## Local production-like preview

```bash
cd apps/web
npm run build
npm run preview
```

- 這只是本機 production build 預覽，不是正式部署。
- 目前 provider factory 在 production-like 條件下仍會 fallback mock。
- 若未來要允許本機 production-like Supabase mode，必須獨立設計 allow flag，不要在這一步偷改。
