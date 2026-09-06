# Cloudflare Web Analytics

2026-09-04 以 Cloudflare API、Wrangler 部署紀錄及正式網站瀏覽器驗證。

- 網站：https://pow4vote.org
- Worker：public-office-watch
- 目前查得 auto_install = true、ruleset.enabled = true。
- 最新查得版本 b63a821f-9439-48e1-9821-beacf2f6f916，部署訊息 Release 8da4c6636d245781b50d56e8f2ae773099ab98fb。
- 正式首頁只有一份 Cloudflare beacon。從首頁切換人物列表，觀察到本站 /cdn-cgi/rum 多次 HTTP 204 回應。
- 離開頁面時有一筆 ERR_ABORTED；已成功回應的統計請求不受影響，未將離頁中斷解讀為全部傳送失敗。

這次沿用既有自動載入，沒有新增手動 script、route tracking、token、追蹤事件或 Cloudflare 設定寫入。既有 CSP 允許 static.cloudflareinsights.com，統計送回本站，所以 connect-src 的 self 足夠。

## 資料界線

統計用來觀察頁面瀏覽、流量來源、裝置及網站效能。應用程式不送出戶籍偏好、鄰號、GPS、比較清單、聊天室身分或政治行為事件，也不據此建立個人政治偏好檔案。鄰別查詢結果在裝置上比對。

僅使用頁面統計，不能據此推算精確的「我的選舉」介面點擊次數或個人瀏覽漏斗。同一網址中的版面切換沒有額外埋事件。

資料說明頁已補中英文說明；此文案仍在本機分支，待網站發布後才會出現在正式站。

官方文件：

- [自動啟用方式](https://developers.cloudflare.com/web-analytics/get-started/)
- [SPA 自動偵測](https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/)
- [收集方式與 RUM 傳送端點](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/)
- [隱私與產品說明](https://developers.cloudflare.com/web-analytics/about/)

現行官方文件說明 SPA 自動偵測已內建；不必自行追蹤 React 路由。日後僅在確認自動載入失效時才評估手動載入，以免重複計數。
