# Contributing to Public Office Watch

感謝你協助改善 Public Office Watch（公職資料觀測站）。本專案同時處理程式碼與政治、公職、選舉等公開資料；兩者都接受貢獻，但資料變更需要比一般介面修改更嚴格的來源與身分確認。

## 開始之前

- 小型錯字、文件與明確 bug 可直接提交 Pull Request。
- 功能變更、資料模型調整或大量資料匯入，請先開 Issue 說明目標、來源與影響範圍。
- 請勿提交私密資料、API 金鑰、服務角色金鑰、未公開個資或無法合法公開的原始檔。
- 安全問題請依 [SECURITY.md](SECURITY.md) 私下回報，不要建立公開 Issue。

## 本機開發

- 使用 Node.js 22.13 以上的 22.x 與 npm。Vite 鎖檔要求 `^20.19.0 || >=22.12.0`，Wrangler 要求 `>=22.0.0`，而巢狀 `eslint-visitor-keys` 5.0.1 要求 `^20.19.0 || ^22.13.0 || >=24`，因此整套工具的 Node 22 基線為 22.13，Node 20 不涵蓋整套工具。2026-09-08 本機驗證基線為 Node 22.22.1；GitHub workflows 選擇 major 22，不是固定 patch。
- 一般網站開發需要 Docker 與根目錄鎖定的 Supabase CLI。根目錄、`apps/web` 各有一份 lockfile，分別使用 `npm ci`，不要混用 Windows 與 WSL 的 node_modules。
- 根目錄 `test:script-suite` 的四套影像幾何／裁切測試需要 Python 3、Pillow、NumPy。已驗證組合為 Python 3.10.12、Pillow 9.0.1、NumPy 1.21.5；這是實測組合，不是完整最低相容版本宣告，也不代表通過外部 OCR 引擎整合。

```bash
npm ci
npm --prefix apps/web ci
```

若 Python 環境尚未具備影像相依，可使用專案虛擬環境：

```bash
python3 -m venv tmp/python-dev
. tmp/python-dev/bin/activate
python -m pip install Pillow==9.0.1 numpy==1.21.5
```

上述固定組合適用已驗證的 Python 3.10；其他 Python 版本須選擇相容依賴並重跑測試，不要在系統 Python 強制安裝。虛擬環境及建置產物不提交。

完整本機設定依 [Local Supabase Validation](docs/local-supabase-validation.md)，環境配對依 [deployment-environments.md](docs/deployment-environments.md)。必須填本機 public key、Turnstile site key，以及 Vite 參與代理所需的 server-only `.dev.vars`；只複製範本仍會被 guard 或代理啟動檢查擋下。一般開發使用本機 Vite 與完整本機 Supabase，正式值不可複製進來。

### Windows／WSL 執行方式

先用實際執行工作的命令工具確認作業系統、使用者、工作目錄及 runtime；Windows 視窗不代表命令在 Windows 執行，Linux 專案路徑也不代表 Agent 已在 Linux。已在 WSL 執行時，直接使用 Linux 路徑與工具，不再經過 PowerShell 或 `wsl.exe`。

2026-09-08 的實測顯示，Windows sandbox 在處理專案 UNC 權限時可能於命令啟動前失敗；改 command cwd 或增加 shell wrapper 不能解決該故障。使用者切換後的 Linux Agent 已完成 cwd、參數、退出碼及本機服務操作驗證。這是當次環境的結果，不保證其他任務或重啟後仍相同；切換後需重新核對。

必須從 Windows PowerShell 執行時，先確認發行版、Linux 使用者及專案絕對路徑，再使用單層入口。以下變數必須由目前環境填入，不可照抄其他人的設定：

```powershell
wsl.exe -d $PowDistro -u $PowLinuxUser --cd $PowProjectPath --exec node apps/web/scripts/check-environment.mjs local
exit $LASTEXITCODE
```

此形狀在 PowerShell 7.6.5 實測，未驗證 Windows PowerShell 5.1。複雜操作先寫成可審閱的 Linux 腳本，再傳入腳本路徑，避免多層 shell 展開。退出碼測試應刻意讓子程序回傳非零碼（例如 37），確認外層原樣回傳；這個預期失敗不能記作工具故障或成功 exit 0。

工具找不到時，在 Linux 用 `command -v`，在 PowerShell 用 `Get-Command`，核對已知安裝位置及非互動 PATH；不要立刻安裝第二份。PowerShell 找到的 Windows 工具不代表 WSL 也有同一入口。單純解析 JSON 可使用既有 Node／Python，不一定需要 jq。工具版本符合鎖檔後，還要完成相關最小操作：瀏覽器開本機頁、DB client 對已確認的本機目標安全查詢。詳見[測試選擇與環境證據](docs/local-supabase-validation.md#依修改範圍選擇驗證)。

## 程式碼與介面變更

- 只修改與 Issue 或 PR 目標直接相關的內容，避免夾帶無關重構。
- 維持既有 TypeScript、React、Tailwind 與 i18n 寫法；公開介面新增文案時同步繁體中文與英文。
- 任何新公開資料查詢都必須經過 `published` schema 或既有受限 RPC，不得讓前端直接讀取內部審核表。
- 新增或修改互動功能時，應涵蓋鍵盤操作、可辨識標籤、窄版寬度與錯誤狀態。

## 公開資料變更

- 優先使用政府機關、選舉公報、官方公告或可交叉驗證的公開來源。
- 在 PR 說明中列出來源名稱、URL、資料日期，以及如何確認人物、選舉或政黨身分。
- 同名不代表同一人；合併人物資料時需提供官方識別碼、選舉年份、選區、號次或其他足以交叉確認的證據。
- 不得因 AI、自動抓取或單一搜尋結果就把待查線索標成已驗證資料。
- 學經歷與政見可做空白、編號、換行及條目切分，但不得改寫原意；不確定的切分應保留原文並標記待審。
- 政治獻金只接受符合本站公開邊界的摘要與彙總，不提交個人捐贈明細。

## 驗證

程式變更的綜合檢查入口：

```bash
npm run check
```

文件變更先核對連結、命令、workflow 與實作；程式變更再執行相關測試。`check` 會重建 dist，且含可跳過的 live DB 檢查，不能把 exit 0 當成所有環境通過。依 [驗證矩陣](docs/local-supabase-validation.md#驗證矩陣) 分別記錄通過、失敗、skip 及未執行原因。

migration、RLS 與寫入拒絕探針要使用事先確認的隔離資料庫；不要 reset 既有研究資料。正式形狀 rehearsal 由本機 schema snapshot 建立，不能替代空庫 migration 全史回放。

[Web CI](.github/workflows/web-ci.yml) 執行 polling-place 工具、選定 monitor/review 回歸、web 單元／來源碼檢查及 mock browser/PWA/state-safety；不是整套 root/Python 測試或真 DB 寫入 E2E。legacy retirement 步驟缺 DB 設定會明示 skip。遠端某次 run 是否執行或通過須看該 run 紀錄。

## Pull Request checklist

- 變更範圍與 Issue／目的清楚。
- 沒有提交密鑰、私密資料或本機產物。
- 公開資料附可查核來源，敏感內容保留人工審核邊界。
- 繁中與英文介面文案已同步。
- 相關 lint、build、測試與 migration 檢查已通過。
- 文件、資料說明或更新紀錄已在需要時同步。

提交貢獻即表示你同意程式碼依本專案的 [ISC License](LICENSE) 發布；第三方資料仍受原始來源的授權、使用條款與適用法規約束。
