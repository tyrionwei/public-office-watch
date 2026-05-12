# Public Office Watch

台灣民代、候選人與其可驗證公司關聯的官方資料整理專案。

## 目標

建立一套可追溯、可人工審核、可安全匯入資料庫的資料更新 MVP，先不做前端公開網站，也不抓取真實政治人物資料作為種子資料。

## MVP 範圍

- 公職人物基本資料
- 公司基本資料
- 人物與公司候選關係
- 原始來源記錄
- 更新候選報告
- machine-readable JSON diff
- 人工審核流程
- 安全匯入 PostgreSQL / Supabase staging tables

## 專案原則

- 不直接公開未審核資料
- 不自動推論家族企業
- 每筆資料都保留來源與證據
- 僅使用官方或可信公開來源
- 不提交任何 secrets
- 第一階段只做 dry-run，不寫正式資料庫

## Git 工作流

- `main` 視為穩定分支
- 日後資料更新請使用 `data-update/YYYY-MM-DD` branch
- 修正與工具強化可使用 `chore/*` branch
- 不直接 push 到 `main`
- 以 Pull Request 方式審核後合併

## 結構

- `docs/`：政策、流程、資料來源說明
- `database/`：schema 與 RLS 草案
- `samples/`：範例報告與 JSON
- `data-updates/`：每次更新產物
- `src/Importer/`：.NET 8 匯入工具
- `local-data/`：本地 raw / cache / logs / snapshots，不進 Git

## 執行 Importer dry-run

```bash
dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- data-updates/YYYY-MM-DD/changes.json
```

若不提供路徑，預設使用：

```text
samples/sample-changes.json
```

## 資料更新 PR 流程範例

```bash
git checkout main
git pull origin main
git checkout -b data-update/2026-05-12
# 更新 data-updates/2026-05-12/*
git add data-updates/2026-05-12
git commit -m "Add data update 2026-05-12"
git push -u origin data-update/2026-05-12
```

PR 設定：
- base: `main`
- compare: `data-update/YYYY-MM-DD`

PR 標題：

```text
Data update YYYY-MM-DD
```

## 目前狀態

- 已完成第一階段文件、schema、samples
- 已完成 Importer 骨架與 dry-run 驗證
- 已建立 PR template 與 GitHub Actions dry-run 草案
