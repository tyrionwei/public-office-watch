# Contributing to Public Office Watch

感謝你協助改善 Public Office Watch（公職資料觀測站）。本專案同時處理程式碼與政治、公職、選舉等公開資料；兩者都接受貢獻，但資料變更需要比一般介面修改更嚴格的來源與身分確認。

## 開始之前

- 小型錯字、文件與明確 bug 可直接提交 Pull Request。
- 功能變更、資料模型調整或大量資料匯入，請先開 Issue 說明目標、來源與影響範圍。
- 請勿提交私密資料、API 金鑰、服務角色金鑰、未公開個資或無法合法公開的原始檔。
- 安全問題請依 [SECURITY.md](SECURITY.md) 私下回報，不要建立公開 Issue。

## 本機開發

- 使用 Node.js 22.13 以上的 22.x 與 npm。Vite 鎖檔要求 `^20.19.0 || >=22.12.0`，Wrangler 要求 `>=22.0.0`，而巢狀 `eslint-visitor-keys` 5.0.1 要求 `^20.19.0 || ^22.13.0 || >=24`，因此整套工具的 Node 22 基線為 22.13，Node 20 不涵蓋整套工具。2026-09-08 本機驗證基線為 Node 22.22.1；GitHub workflows 選擇 major 22，不是固定 patch。
- 使用完整本機資料庫時才需要 Docker 與根目錄鎖定的 Supabase CLI；文件、純函式與 mock 測試不以 Docker 可用為前提。根目錄、`apps/web` 各有一份 lockfile，分別使用 `npm ci`，不要混用 Windows 與 WSL 的 node_modules。
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

完整本機設定依 [Local Supabase Validation](docs/local-supabase-validation.md)，環境配對依 [deployment-environments.md](docs/deployment-environments.md)。必須填本機 public key、Turnstile site key，以及 Vite 參與代理所需的 server-only `.dev.vars`；只複製範本仍會被 guard 或代理啟動檢查擋下。需要網站真資料驗收時使用本機 Vite 與完整本機 Supabase，正式值不可複製進來。

### 日常工作與環境檢查

一般開發確認 repo、分支及未提交變更後直接工作；不要求每次盤點 Docker、掛載、群組、全部代理模型或還原備份。資料庫／匯入／外部寫入測試才額外核對程式實際使用的 endpoint、覆寫來源及目標身分，沿用[測試選擇與環境證據](docs/local-supabase-validation.md#依修改範圍選擇驗證)。正式資料與部署才走對應發布及回復流程。

已在 WSL 執行就直接使用 Linux 工具。同一環境與設定未變時沿用已驗證結果；工具找不到、環境切換或權限異常時才查實際 runtime、PATH、cwd 及受影響設定。Windows 專用腳本才確認 Windows 入口，不把換終端 shell、cd 或 wrapper 當成修復任務綁定。

已授權的工作區修改直接執行。互動代理保留 App「代我核准」，必要越界操作交系統正式核准；遭拒就停止相依部分並回報，不反覆要求人工確認或繞過限制。排程權限獨立，須事先具備完成工作所需的搜尋／下載與本機存取能力。

## 程式碼與介面變更

- 分支與發布採用[功能分支 → 暫時 release 整合 → PR 到 main → 自動部署](docs/deployment-environments.md#開發分支與批次發布流程)。一般功能不逐一合進 main 觸發發布；完整流程、hotfix 與清理規則以該文件為準。

- 只修改與 Issue 或 PR 目標直接相關的內容，避免夾帶無關重構。
- 維持既有 TypeScript、React、Tailwind 與 i18n 寫法；公開介面新增文案時同步繁體中文與英文。
- 任何新公開資料查詢都必須經過 `published` schema 或既有受限 RPC，不得讓前端直接讀取內部審核表。
- 新增或修改互動功能時，應涵蓋鍵盤操作、可辨識標籤、窄版寬度與錯誤狀態。

## 公開資料變更

- 優先使用政府機關、選舉公報、官方公告或可交叉驗證的公開來源。
- 在 PR 說明中列出來源名稱、URL、資料日期，以及如何確認人物、選舉或政黨身分。
- 同名不代表同一人；合併人物資料時需提供官方識別碼、選舉年份、選區、號次或其他足以交叉確認的證據。
- 不得因 AI、自動抓取或單一搜尋結果就把待查線索標成已驗證資料。
- 判決結果、罪名與刑度只取本次法院已核對的逐人主文；事實與理由不參與判決判定。主文、人物或附表對應不明就保留原文待審，詳見[司法主文摘要契約](docs/judgment-disposition-presentation.md)。
- 學經歷與政見可做空白、編號、換行及條目切分，但不得改寫原意；不確定的切分應保留原文並標記待審。
- 政治獻金只接受符合本站公開邊界的摘要與彙總，不提交個人捐贈明細。

## 驗證

迭代時執行相關測試，整合後由主代理核對同一版本一次；同版本已通過的相同檢查，除非新修改或未解失敗，無需重跑。既有 CI／發布必要檢查保留。需要綜合驗證時使用：

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
