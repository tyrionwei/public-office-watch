# Taiwan Map Data Plan

## 目標

- 將 Stage Select 從 placeholder 改成真實台灣縣市 / 行政區資料。
- 第一層：縣市。
- 第二層：鄉鎮市區。
- 不做村里。
- 明確標示行政區不一定等於正式選舉選區。

## 建議來源

- 內政部國土測繪中心 / 政府資料開放平台：
  - 直轄市、縣市界線
  - 鄉鎮市區界線
- 可評估使用已轉檔的 TopoJSON / GeoJSON，但必須確認授權、來源、版本、更新日期。

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

## 不應做的事

- 不 commit 大型 raw shapefile
- 不 commit 來源不明的 map data
- 不抓圖片地圖
- 不用 Google Maps screenshot
- 不把行政區誤稱為選舉選區

## 前端資料結構

未來可放：

- `apps/web/src/types/taiwanMap.ts`
- `apps/web/src/data/taiwanMapSources.ts`
- `apps/web/public/maps/taiwan-counties.topojson`
- `apps/web/public/maps/towns/{countyCode}.topojson`
