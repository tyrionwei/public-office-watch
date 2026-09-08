# Codex 申請使用證據：2026-09-08

本文件是申請準備快照，尚未送件。僅保存網站彙總統計與公開維護證據，不包含帳號、site token、金鑰、訪客紀錄、搜尋字詞或私人待審資料。

## 來源與查詢窗口

- 查詢日期：2026-09-08（UTC）。
- 服務：Cloudflare Web Analytics，正式 hostname `pow4vote.org`。
- 透過已授權 Cloudflare connector 唯讀查詢；站點列表核對只有目標站點，`auto_install = true`、`ruleset.enabled = true`。
- API：`POST https://api.cloudflare.com/client/v4/graphql`；使用 GraphQL query，不含 mutation。
- Dataset：`rumPageloadEventsAdaptiveGroups`；不是 Workers requests 或邊緣 HTTP 流量。
- 篩選：目標 account／site、`requestHost = pow4vote.org`。
- 窗口：`datetime_geq = 2026-08-11T00:00:00Z`，`datetime_lt = 2026-09-08T00:00:00Z`。
- 對外日期標示：2026-08-11 至 2026-09-07（UTC），28 個完整日；不是台北午夜窗口。

## 彙總回傳

| 查詢範圍 | Page views：count | Visits：sum.visits | avg.sampleInterval |
|---|---:|---:|---:|
| 不加 bot 篩選 | 5,040 | 1,210 | 14.19718309859155 |
| `bot = 0`，排除被標記為 bot 的流量 | 4,430 | 1,070 | 13.63076923076923 |

兩次查詢皆為 HTTP 200，`success = true`、`errors = []`。API schema 將 `count` 定義為 page views，`sum.visits` 為從外部網站／直接連結進入的造訪指標，`avg.sampleInterval` 為平均抽樣間隔。

這些是 API 回傳的聚合估計，原值照錄，不再自行乘上 sampleInterval。申請草稿採用 `bot = 0` 那一列，並明確標為估計；不把排除已識別 bot 等同所有流量都是真人。

## 日別完整性核對

以下為「不加 bot 篩選」的日別回傳，`limit = 31`、依 `date_ASC` 排序，共 14 列，未碰到列數上限。加總為 5,040 page views／1,210 visits，與相同範圍的總計一致。

| 日期（UTC） | Page views | Visits |
|---|---:|---:|
| 2026-08-25 | 20 | 20 |
| 2026-08-26 | 90 | 60 |
| 2026-08-27 | 250 | 70 |
| 2026-08-28 | 90 | 0 |
| 2026-08-29 | 20 | 0 |
| 2026-08-30 | 140 | 0 |
| 2026-08-31 | 890 | 10 |
| 2026-09-01 | 670 | 70 |
| 2026-09-02 | 320 | 10 |
| 2026-09-03 | 90 | 10 |
| 2026-09-04 | 180 | 30 |
| 2026-09-05 | 610 | 230 |
| 2026-09-06 | 970 | 390 |
| 2026-09-07 | 700 | 310 |
| 合計 | 5,040 | 1,210 |

窗口前半段 2026-08-11 至 2026-08-24 沒有回傳列，不能據此斷言沒有流量，也不將 2026-08-25 當成已確認的上線／安裝日期。對外引用需同時標註查詢窗口與實際回傳日期覆蓋。日別表沒有額外套用 `bot = 0`，不能拿來分解 4,430／1,070 的數字。

## 重查方法

由授權帳號的站點列表解析 account 與 site ID，再以以下 query 及變數執行；ID 和任何認證資料只留在受控執行環境。

```graphql
query OssUsage(
  $accountTag: string!,
  $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!,
  $nonBotFilter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!
) {
  viewer {
    accounts(filter: {accountTag: $accountTag}) {
      total: rumPageloadEventsAdaptiveGroups(limit: 1, filter: $filter) {
        count
        sum { visits }
        avg { sampleInterval }
      }
      nonBot: rumPageloadEventsAdaptiveGroups(limit: 1, filter: $nonBotFilter) {
        count
        sum { visits }
        avg { sampleInterval }
      }
      daily: rumPageloadEventsAdaptiveGroups(
        limit: 31, orderBy: [date_ASC], filter: $filter
      ) {
        count
        sum { visits }
        dimensions { date }
      }
    }
  }
}
```

`filter` 含上方 siteTag、requestHost、datetime_geq、datetime_lt；`nonBotFilter` 複製同一組篩選後加入 `bot: 0`。這是供重查的參數化版本；本次實際以相同條件分兩個查詢取得總計、bot 篩選與日別資料。未使用此參數化版本重跑。

## 解讀限制

- Visits 不是獨立訪客或月活躍使用者。一次造訪可產生多次瀏覽；不能用此資料推估投票意向、政治偏好或選民人數。
- Cloudflare 說明 Web Analytics 會抽樣；本次 sampleInterval 大於 1。標示為約數／估計，不以精確人數呈現。
- 維護者操作與 production smoke／瀏覽器測試可能被計入；本次沒有獨立排除證據，不能宣稱數字全部來自外部使用者。
- Beacon 被阻擋、未送達或沒有回傳的日期均限制覆蓋；不能補成 0。
- 沒有查詢逐筆訪客、來源路徑、政治行為事件或私人資料，沒有修改追蹤設定。
- 本輪不連接任何 Supabase，不做資料庫驗證、網站部署或產品變更。

## Google Search Console

狀態：**已取得維護者提供的截圖彙總；完整查詢起訖日與資料完成狀態待確認**。2026-09-08 收到截圖，人工讀取卡片數值，未透過瀏覽器／API 直接擷取。

### 來源與篩選

- 資源：`sc-domain:pow4vote.org`，依維護者同時提供的 Search Console 分頁網址確認；截圖本身沒有顯示 property 選擇器。
- 截圖檔名：`image.png`，保留於本次對話附件，未複製至 repository。
- 原始附件 SHA-256：`0733c0662f2d15af3ec8585fa01da4ebde51b45e01df73fa57f30207bf490cac`。
- 畫面勾選「28 天」，搜尋類型為「網路」（Web），粒度為每天；未顯示額外篩選條件。
- 圖表可見日期標籤：2026-08-25 至 2026-09-06。這是可見圖表範圍，不是已確認的完整 28 天查詢窗口；不反推缺失日期或補 0。
- 畫面顯示「上次更新時間：5.5 小時前」。實際截圖時間與資料是否全部完成處理未確認，不將此相對時間換算為絕對匯出時間，也不視為 `dataState = final` 的證明。

### 截圖卡片

| 指標 | 畫面數值 |
|---|---:|
| 總點擊次數 | 635 |
| 曝光總數 | 9,181 |
| 平均點閱率（CTR） | 6.9% |
| 平均排名 | 9.3 |

一致性檢查：`635 / 9181 * 100 ≈ 6.916%`，四捨五入到小數一位為 6.9%，與卡片一致。未從圖表線條估算日別數值，也未取得查詢字詞、頁面數或完整收錄量。

### 引用界線與待補項目

- 目前可引用為「2026-09-08 收到的 Search Console 截圖，28 天預設篩選下顯示 635 次點擊、9,181 次曝光」；同時註明可見日期與完整窗口尚未確認。
- 與 Cloudflare 採不同來源、指標及日期窗口；Google 日期採 PT，Cloudflare 本次採 UTC。不可相加，亦不能由兩者推算轉換率、獨立使用人數或市場採用規模。
- 待補確切起訖日、實際匯出／截圖時間及資料完成狀態。若改由 API 匯出，採 `dataState = final`，總計不要由可能截斷的 query／page 列自行相加。
- 不宣稱這是 API 驗證結果。截圖已提供實際搜尋曝光證據；沒有因此確認全部網站頁面已被收錄。
- 申請草稿已納入 Google 與 Cloudflare 彙總及限制；送出前可用明確日期的匯出報表替換截圖證據。

## 官方定義

- [Cloudflare Web Analytics metrics](https://developers.cloudflare.com/web-analytics/data-metrics/high-level-metrics/)
- [Cloudflare Web Analytics sampling and collection](https://developers.cloudflare.com/web-analytics/faq/)
- [Cloudflare GraphQL sampling](https://developers.cloudflare.com/analytics/graphql-api/sampling/)
- [Google Search Analytics query：日期、總計與回傳限制](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
