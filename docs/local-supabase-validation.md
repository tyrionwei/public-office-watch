# Local Supabase Validation

## 目的

- 用 local Supabase anon key 驗證前端 public views 是否可讀。
- 驗證 provider factory 的 local Supabase mode。
- 不碰 service role。
- 不提交 `.env.local`。

## 前置條件

- Supabase local 已啟動。
- public views 已建立。
- anon key 只能讀 public views。
- raw / staging / review tables 不可由 anon key 讀。

## 建立 local env

```bash
cd apps/web
cp .env.example .env.local
```

手動填入：

- `VITE_SUPABASE_URL=local Supabase API URL`
- `VITE_SUPABASE_ANON_KEY=local anon key`
- `VITE_PUBLIC_DATA_PROVIDER=mock` 或 `supabase`

注意事項：

- `.env.local` 不得 commit。
- 不得使用 service role key。
- 不得使用 `DATABASE_CONNECTION_STRING`。
- 不要把 key 貼到 PR、issue 或 commit message。

## Mock mode checks

當 `VITE_PUBLIC_DATA_PROVIDER=mock` 時執行：

```bash
npm run build
npm run lint
npm run check:data-boundary
npm run smoke:public-views
npm run check:public-view-contracts
```

## Local Supabase mode checks

當 `VITE_PUBLIC_DATA_PROVIDER=supabase` 時執行：

```bash
npm run build
npm run lint
npm run check:data-boundary
npm run smoke:public-views
npm run check:public-view-contracts
npm run dev
```

並檢查：

- `/` 不 crash
- `/regions/:regionId` 不 crash
- `/elections/:electionId` 不 crash
- empty state / fallback 正常
- 不顯示未審核資料
- 不讀 raw / staging table

## 安全回報模板

- local Supabase started: yes/no
- smoke public views: pass/fail/skip
- public view contract check: pass/fail/skip
- provider mode mock: pass/fail
- provider mode supabase: pass/fail
- notes: 不含 secrets
