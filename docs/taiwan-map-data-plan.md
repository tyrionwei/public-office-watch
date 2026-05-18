# Taiwan Map Data Plan

## 目標

- 將 Stage Select 從 placeholder 改成真實台灣縣市 / 行政區資料。
- 第一層：縣市。
- 第二層：鄉鎮市區。
- 不做村里。
- 明確標示行政區不一定等於正式選舉選區。

## 本階段進度

- 已加入縣市層級真實 metadata 基礎：`apps/web/src/data/taiwanRegions.ts`
- 已加入 generated asset 入口：`apps/web/src/data/generated/taiwanCountyMap.ts`
- 已加入 prepare script：`apps/web/scripts/prepare-taiwan-county-map.mjs`
- raw source 不 commit，應放在 `local-data/maps/work/`
- 本階段先完成官方來源追溯、縣市 metadata 與轉換流程，鄉鎮市區第二層保留資料結構與後續計畫

## 官方來源

- 內政部國土測繪中心 / 政府資料開放平台：
  - 直轄市、縣市界線(TWD97經緯度)
    - <https://data.gov.tw/dataset/7442>
  - 鄉鎮市區界線(TWD97經緯度)
    - <https://data.gov.tw/dataset/7441>
- 可評估使用已轉檔的 TopoJSON / GeoJSON，但必須確認原始來源、授權、轉換者、版本、更新日期。

## 授權與來源紀錄

每個 map data asset 都要記錄：

- source URL
- license
- downloaded at
- transformed by
- transform command
- simplification tolerance
- original file 不一定 commit
- repo 只 commit 簡化後、合理大小的前端 map asset

## 轉換流程

1. 自官方來源下載縣市界線原始檔，放到 `local-data/maps/work/`
2. 先在本機轉成 GeoJSON
3. 執行：

```bash
cd apps/web
npm run prepare:tw-map:counties
```

4. 由 script 產生 `apps/web/src/data/generated/taiwanCountyMap.ts`
5. 確認 generated asset 不超過合理大小，單檔超過 500KB 時先停下來簡化

## 不應做的事

- 不 commit 大型 raw shapefile / zip / gml
- 不 commit 來源不明的 map data
- 不抓圖片地圖
- 不用 Google Maps screenshot
- 不把行政區誤稱為選舉選區

## 前端資料結構

目前 / 後續位置：

- `apps/web/src/types/taiwanMap.ts`
- `apps/web/src/data/taiwanMapSources.ts`
- `apps/web/src/data/taiwanRegions.ts`
- `apps/web/src/data/generated/taiwanCountyMap.ts`
- 後續鄉鎮市區可延伸到 `apps/web/public/maps/towns/{countyCode}.topojson` 或等價 generated asset
