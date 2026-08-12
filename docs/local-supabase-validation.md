# Local Supabase Validation

## 目的

以 local Supabase 驗證網站、migration 與公開資料邊界。所有測試只連
`127.0.0.1`，不得使用正式 Supabase URL、資料庫密碼或 service role key。

## 前置條件

- Node.js 22，或 Node.js 20.19 以上
- npm
- Docker Desktop／可用的 Docker daemon
- 根目錄與 `apps/web` 相依套件已安裝

```bash
npm ci
npm --prefix apps/web ci
npx supabase start
npx supabase status
```

`supabase/migrations` 是唯一 migration 來源；不要另建第二套 schema 或
migration 目錄。

## 建立前端本機設定

```bash
cp apps/web/.env.example apps/web/.env.local
```

只填入 `npx supabase status` 顯示的本機 URL 與 anon／publishable key：

```text
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local anon or publishable key>
VITE_PUBLIC_DATA_PROVIDER=published
VITE_ENABLE_PUBLISHED_PROVIDER=true
```

不得把 service role key 放進任何 `VITE_*` 變數，也不得提交
`.env.local`。

## 驗證

```bash
npm run check
npm --prefix apps/web run check:local-test-env
npm --prefix apps/web run smoke:public-views
npm --prefix apps/web run dev
```

必要時另執行：

```bash
npm --prefix apps/web run test:browser
```

瀏覽器與 anon key 應只能讀取經審核的 `published` 公開介面；raw、
staging、review、私人待審及管理資料都必須拒絕存取。

## Migration 與本機寫入規則

- schema 變更只放在 `supabase/migrations`。
- 蒐集及審核預設只寫 `tmp`、本機待審資料或 local Supabase。
- 正式 Supabase 寫入、migration 套用、部署、推送與 commit 必須是另外明確核准的操作。
- 測試後用 `npx supabase migration list --local` 核對本機 migration 狀態。
- 涉及 RLS、view、function 或 grants 時，另執行適用的公開 contract 與安全檢查。

## 安全回報

只回報是否通過、錯誤摘要及 migration 版本；不得貼出 keys、token、
完整連線字串、私人待審內容或不必要的個資。
