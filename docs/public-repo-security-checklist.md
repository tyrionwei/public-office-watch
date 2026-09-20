# Public Repository Security Checklist

本文件用於公開 GitHub repo 的日常安全稽核，重點是避免 secrets、個資、local artifacts 與不該公開的暫存資料被提交。

## Git 追蹤與本機保留

本節是後續檔案分類的單一維護來源。新增檔案、調整產物輸出位置或整理提交內容時，先依下表分類，再核對實際內容、程式／測試引用與現有 Git 狀態；不要只憑副檔名、資料夾名稱或「本機開發用」判定。無法確認可公開的研究資料先留本機待審，不自動納入提交；也不要為了排除資料而隱藏必要來源碼。

| 分類 | 追蹤／上傳原則 | 例子 |
| --- | --- | --- |
| 共用來源，需追蹤 | 納入 Git，經 review 後才能提交／推送；本機測試工具也屬來源碼 | `apps/web/src`、`apps/web/build`、`scripts`、測試、公開資產、套件與 lockfile、CI、migration、環境範本、公開 CA 憑證 |
| 共用文件與必要資料，需追蹤 | 保留可重現方法及通過既有公開審核的必要輸入；檔名含 seed 或 local 不代表應忽略 | 開發／發布文件、來源 manifest、必要 seed、已審核發布 migration；`CONTRIBUTING.md` 與 `deployment-environments.md` 亦屬此類 |
| 本機私有資料，不追蹤但須備份 | 使用 `.gitignore` 保護，保留原檔、來源、mtime 與雜湊；不得因停止追蹤就刪除 | 環境值、研究下載、人物比對／待審清單、TNL 研究資料、CEC 逐批審核與執行紀錄、資料庫備份、`local-data/` |
| 可重建產物，不需追蹤 | 使用 `.gitignore`；是否刪除另行判斷，不與本次分類一併清理 | `node_modules/`、`dist/`、測試報告、cache、暫存檔；`tmp/` 中的研究證據仍須保留備份 |
| 個人工作環境，不上傳 | 使用本機 `.git/info/exclude`，不把個人偏好變成團隊忽略規則 | 本機代理設定、代理工作紀錄、IDE 個人設定；此工作區的根 `AGENTS.md`、`.codex/`、`.agents/`、`.codex-tmp/` |

忽略規則限定已確認的產物類型或精確路徑，保留共用 README、範本與未來方法文件。取消追蹤前查明引用依賴；若一般測試依賴私有資料，保留原斷言並分離成明確的本機驗收，不以刪除案例或靜默 skip 代替。分類完成後檢查忽略命中、必要來源未被隱藏、原始資料保全與相關測試。可不追蹤不等於可刪除；需追蹤也不等於已授權 commit、push 或發布。

GitHub 收到的是 commit；未提交的工作目錄不會由一般 push 上傳。ignore 只保護未追蹤檔案，已追蹤的私有產物必須先確認備份，再用 `git rm --cached -- <精確路徑>` 取消追蹤，保留本機檔。不要用 assume-unchanged 或 skip-worktree 隱藏變更，也不要以整目錄清除代替分類。

取消追蹤會形成待提交的刪除差異，不會清除已存在的 Git 歷史或 GitHub 舊版本。歷史清理、正式發布與遠端操作另行授權。個人 exclude 不會隨 clone 移轉；新工作區須自行設定，且 `git add -f` 可繞過忽略規則。

TNL 的完整研究驗收保留在 `scripts/local-data-tests/`，使用 `npm run test:local-research-data`，缺少本機資料會失敗，不能當成通過。一般 `test:script-suite`／`test:data-reports` 保留合成案例；它們通過不代表真實研究資料通過。CEC 身分核對工具同樣需要本機 ledger；取得程式碼不等於取得待審資料或寫入授權。

## 禁止提交的常見檔案

以下內容不應進入公開 repo：

- `.env`
- `.env.*`
- `appsettings.Development.json`
- `secrets.json`
- `*.log`
- `*.tmp`
- `*.bak`
- `*.sqlite`
- `*.db`
- `local-data/`
- `logs/`
- `supabase/.branches/`
- `supabase/.temp/`
- browser profile
- cookie / session 檔案
- 任何 production secrets 或私鑰

## Secrets 檢查指令

在 repo 根目錄執行：

```bash
git grep -n -Ei "service_role|SUPABASE_SERVICE_ROLE_KEY|DATABASE_CONNECTION_STRING|OPENAI_API_KEY|JWT_SECRET|PRIVATE_KEY|BEGIN .*PRIVATE KEY|ghp_|github_pat_|sk-|xoxb-|xoxp-|AKIA|pass(word)?=|api[_-]?key|secret|token" || true
```

補充檢查個資相關關鍵詞：

```bash
git grep -n -Ei "真實人物|身分證|電話|地址|生日|未成年子女" || true
```

如需快速檢查提交歷史：

```bash
git log --all --oneline
```

## gitleaks 使用方式

若本機已安裝 gitleaks：

```bash
gitleaks detect --source . --redact --verbose
```

若尚未安裝，請先依你的系統環境安裝後再執行。

## 若 secret 已經 push 過的處理方式

如果發現 secret 曾被 push 到公開 repo，請照這個順序處理：

1. 立即 rotate secret
2. 停止繼續使用舊 secret
3. 確認外部服務側的權限與存取紀錄
4. 再進行 git history 清理
5. 通知協作者重新 clone 或重新同步乾淨 history

重點是：**先 rotate secret，再清 history**。不要反過來做。

## GitHub 安全功能建議

建議在 GitHub repo 啟用：

- Secret scanning
- Push protection
- Dependabot alerts
- Dependabot security updates

## 補充原則

- 可提交有合法公開來源且通過既有審核的必要結構化資料；不得提交私人待審產物、未整理原始下載或無來源的敏感資訊
- 不要提交 production Supabase credentials
- 不要提交 production API keys
- 不要把 local 測試連線字串當成 production 設定
