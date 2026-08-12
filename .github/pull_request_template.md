# Pull Request

## 變更範圍

- [ ] Web／公開讀取層
- [ ] 資料蒐集／審核流程
- [ ] Supabase schema／RLS／公開 view
- [ ] CI／排程／部署邊界
- [ ] 文件／資料來源
- [ ] 其他

## 資料與發布邊界

- [ ] 沒有提交 secrets、真實 `.env`、logs、`tmp`、原始下載或私人待審資料
- [ ] 新增的公開資料有來源，且已明確通過發布審核
- [ ] 同名人物沒有在證據不足時自動合併
- [ ] 家族、黨籍異動、候選狀態與司法資料沒有繞過人工／既有安全閘門
- [ ] 本次變更不會由 CI 或排程自動寫正式 Supabase
- [ ] 不適用（請在下方說明）

## Supabase／安全檢查

- [ ] 新增或修改的表、view、RPC、function、Realtime 或 Storage 已檢查 grants、RLS 與匿名存取
- [ ] 前端只使用 publishable／anon key，沒有 service role key
- [ ] `SECURITY DEFINER`、公開寫入或管理端點已完成額外授權與防濫用檢查
- [ ] 修改 `.github/`、`supabase/`、`scripts/` 或相依套件時已安排責任人審核
- [ ] 不適用

## 驗證結果

- `npm run check`：
- 其他針對性測試：
- Local Supabase／migration 驗證（如適用）：

## 人工審核注意事項

-

## 尚未完成事項

-
