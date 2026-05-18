# Real Public Data Ingestion Plan

## 目標

- 導入第一批低風險真實公開資料。
- 第一批先限 public_regions / map metadata。
- 選舉 metadata 下一階段。
- 不先導入人物關係、公司關係、民調。

## 第一批資料範圍

建議順序：

1. `public_regions`：縣市 / 鄉鎮市區
2. map source metadata：來源、授權、轉換紀錄
3. `public_elections`：選舉名稱、日期、類型、狀態
4. `public_races`：選舉項目 / 區域
5. `public_candidates`：只限官方候選人公開資料，且需來源與審核
6. person / company / relation / polling 資料延後

## 來源

- 內政部 / 國土測繪中心行政區圖資
- 中央選舉委員會選舉資料庫
- 政府資料開放平台中選會資料集
- 中選會選舉公報網站

## 審核流程

- 真實資料不得直接寫死在 frontend mock data。
- 應走 Importer / staging / promote。
- `raw_source_records` 只供後端 / 審核流程使用。
- 前端只能讀 public views。
- `pending` / `rejected` 不公開。
- 每筆資料要有 source / reviewed status / updatedAt。

## Public repo 原則

- 不 commit raw dump。
- 不 commit 未審核資料。
- 不 commit service key。
- 不 commit DB connection string。
- 若需要 sample，只能放極小、明確標示 fixture 的資料，不包含敏感關係推論。
