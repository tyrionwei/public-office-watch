# Pull Request

## 本次變更類型
- [ ] schema hardening
- [ ] RLS hardening
- [ ] Importer validation
- [ ] CI / workflow
- [ ] samples / docs
- [ ] other

## 是否抓取真實資料
- [x] 否
- [ ] 是（若勾選，請說明原因）

## 是否包含敏感資料
- [ ] 無
- [ ] 有，已說明並處理

## 是否包含 verified / is_public=true
- [x] 否
- [ ] 是（需說明原因，正常情況不應出現）

## 公開倉庫安全檢查
- [ ] 沒有提交密鑰、權杖、真實 `.env`、私有資料或含敏感資訊的紀錄檔
- [ ] 沒有依賴隱藏網址、前端判斷或原始碼保密來保護管理功能
- [ ] 新增或修改的 Supabase 表、view、RPC 已檢查 grants、RLS 與匿名存取
- [ ] 新增的寫入端點已有伺服器端授權、輸入限制與防濫用措施
- [ ] 修改 `.github/`、`supabase/`、同步腳本或相依套件時，已由責任人審核
- [ ] CI 與錯誤輸出不會印出 secrets、token、完整連線字串或不必要的個資
- [ ] 不適用（請在人工審核注意事項說明）

## dry-run 結果
- `dotnet restore`：
- `dotnet build`：
- `Importer dry-run samples/sample-changes.json`：
- `Importer dry-run data-updates latest changes.json`：

## 人工審核注意事項
- 

## 尚未完成事項
- 
