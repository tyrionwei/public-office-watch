# Project Overview

## 專案定位

Public Office Watch 是一個針對台灣民代、候選人與其可驗證企業關聯的資料更新與審核專案。

第一階段重點不在公開網站，而在建立安全、可追溯的資料流程。

## 第一階段交付

- 文件化資料政策
- 文件化審核流程
- PostgreSQL schema
- RLS policy 草案
- 範例報告與 JSON diff
- Importer 骨架

## 核心流程

資料蒐集 → 候選報告 → JSON diff → 人工審核 → 安全匯入 → 正式發布

## 資料表層次

1. `raw_source_records`：保留原始資料
2. `relation_candidates`：保留待審核候選關係
3. `person_company_relations`：只存人工審核後的正式資料

## 為什麼這樣設計

因為政治人物與企業關聯屬高風險資料，若直接公開未審核資訊，容易造成名譽風險、誤判風險與個資風險。
