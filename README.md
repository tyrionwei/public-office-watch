# Public Office Watch

台灣民代、候選人與其可驗證公司關聯的官方資料整理專案。

## 目標

建立一套可追溯、可人工審核、可安全匯入資料庫的資料更新 MVP，先不做前端公開網站。

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

## Git 工作流

- `main` 視為穩定分支
- 日後資料更新請使用 `data-update/YYYY-MM-DD` branch
- 不直接 push 到 `main`
- 以 Pull Request 方式審核後合併

## 結構

- `docs/`：政策、流程、資料來源說明
- `database/`：schema 與 RLS 草案
- `samples/`：範例報告與 JSON
- `data-updates/`：每次更新產物
- `src/Importer/`：.NET 8 匯入工具

## 下一步

1. 完成第一階段文件與資料庫草案
2. 建立 Importer 骨架
3. 建立模擬更新資料
4. 初始化 Git 並建立第一個 commit
