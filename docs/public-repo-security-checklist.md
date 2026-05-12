# Public Repository Security Checklist

本文件用於公開 GitHub repo 的日常安全稽核，重點是避免 secrets、個資、local artifacts 與不該公開的暫存資料被提交。

## Public repo 不可提交的檔案

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

- 不要加入任何真實政治人物資料
- 不要提交 production Supabase credentials
- 不要提交 production API keys
- 不要把 local 測試連線字串當成 production 設定
