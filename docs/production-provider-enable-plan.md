# Production Provider Enable Plan

## 這不是目前已啟用

- 目前 production provider 尚未啟用。
- app safe default 仍是 mock / dev-only Supabase toggle。
- 真正 production enable 必須獨立 PR。

## Production enable 前必須完成

- gitleaks 通過。
- Web CI 通過。
- local Supabase smoke 通過。
- local public view contract check 通過。
- anon key 權限確認完成。
- raw / staging / review tables 不可由 anon key 讀。
- public views 欄位契約與 mapper 對齊。
- empty state / fallback 驗證完成。
- hosting env 只放：
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_PUBLIC_DATA_PROVIDER=supabase`
- 不得放：
  - service role key
  - `DATABASE_CONNECTION_STRING`
  - `.env` / `.env.local`

## Production enable PR 預期修改

- `publicDataProviderFactory` 的 production gating
- hosting env 設定文件
- deploy target 文件
- smoke / contract check 結果摘要
- rollback plan

## Rollback plan

- 將 `VITE_PUBLIC_DATA_PROVIDER` 改回 `mock`
- 或移除 Supabase env
- redeploy
- 確認頁面回到 mock / safe fallback

## Release checklist

- build
- lint
- data-boundary
- smoke
- contract check
- manual route check
- no secret in git
- no raw table access
