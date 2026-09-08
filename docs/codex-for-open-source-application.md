# Codex for Open Source 申請準備

最後核對：2026-09-08。申請表與福利以 [OpenAI Codex for Open Source](https://openai.com/form/codex-for-oss/) 及[計畫條款](https://developers.openai.com/codex/codex-for-oss-terms)當下內容為準。

本專案已具備公開 repository、ISC License、活躍維護與 Codex 維護用途的證據，可以準備申請。是否獲選及取得哪些福利仍由 OpenAI 審核；本文件不代表已申請、獲選、受贊助或獲背書。

## 申請定位與官方條件

Public Office Watch 是直接供公眾瀏覽的開源 civic-tech 產品，整理台灣選舉、公職、候選人、政見與政治獻金資料，保留來源及人工審核。申請以公共用途、維護責任與可查核的使用證據說明價值。

官方接受活躍開源專案的主要／核心維護者申請，考量實際使用、生態系重要性、維護活動與權限。公開頁面沒有固定最低 stars、forks 或下載量，也鼓勵能說明重要性的專案申請。完整材料不等於保證獲選。

福利包括六個月 ChatGPT Pro（含 Codex），以及可能另行審核的 API credits、Codex Security；API credits 不是現金補助。參考[官方說明](https://developers.openai.com/community/codex-for-oss)。

## 已核對證據

核對基準：公開主分支 `b232c38dde6e2d33cd7eb7b6521de41ddf602f15`，2026-09-08。

| 項目 | 證據與界線 |
|---|---|
| 公開原始碼 | [Repository](https://github.com/tyrionwei/public-office-watch) 為 public；不是 fork |
| 授權 | [ISC License](../LICENSE)；第三方資料權利仍依原來源規定 |
| 主要維護者 | `tyrionwei` 擁有 repository 並持續提交、合併；申請仍以本人身分與帳號為準 |
| 維護流程 | [CONTRIBUTING](../CONTRIBUTING.md)、[SECURITY](../SECURITY.md)、[README](../README.md) 已公開 |
| 近期維護 | [PR #48](https://github.com/tyrionwei/public-office-watch/pull/48) 於 2026-09-08 合併，記錄正式基準修正與 migration 演練 |
| 自動驗證 | 該主分支的 [Web CI](https://github.com/tyrionwei/public-office-watch/actions/runs/34202981201) 與 [Production Release](https://github.com/tyrionwei/public-office-watch/actions/runs/34203153993) 結果為 success；本輪只讀既有紀錄，未重新跑測試 |
| 公開入口 | [pow4vote.org](https://pow4vote.org)；本輪有此 hostname 的 Web Analytics 回傳，未進行整站健康檢查 |
| GitHub 採用訊號 | 查詢時 0 stars、0 forks；照實保留，不據此推估網站使用量 |
| 使用證據 | [2026-09-08 分析快照](oss-application-evidence-2026-09-08.md)：Cloudflare 已取得；Search Console 已由維護者截圖補入，完整窗口待確認 |

## 送出前檢查

- [x] 核對 GitHub 公開 repository、授權、近期維護及 CI。
- [x] 取得 Cloudflare Web Analytics 的固定區間數據、篩選與抽樣資訊。
- [x] 將三段英文草稿限制在各 500 字元內，排除未驗證的 Google 收錄／使用者數聲稱。
- [ ] 將下方 About 草案套用至 GitHub。2026-09-08 查得 description、homepage、topics 仍空白；這是展示改善建議，不是官方硬性門檻。分支文件修改不會自動更新 GitHub 設定。
- [x] 依維護者提供的 Search Console 截圖，補入 635 次點擊、9,181 次曝光、6.9% CTR、平均排名 9.3，並保留截圖來源與雜湊。
- [ ] 確認 Search Console 完整查詢起訖日與資料完成狀態；畫面選擇「28 天」，但圖表只顯示 2026-08-25 至 2026-09-06，不直接視為完整查詢窗口。Search Console 並非官方必填條件。
- [ ] 本人確認有效 ChatGPT 帳號 email、OpenAI Organization ID 與 Primary maintainer 角色；不要把 email、ID、API key 或帳務資料放進 repository。
- [ ] 本人決定是否申請 API credits／Codex Security，並檢查當下條款。
- [ ] 若有可公開的外部採用、引用或更正回報，補上來源；未取得時不虛構。
- [ ] 送出前重新核對日期、草稿字數與數據；由本人確認後送件。

## GitHub About 草案

以下內容已整理供確認；本分支尚未套用遠端設定。

Description:

> Open-source civic data explorer for Taiwan elections, public officials, candidates, platforms, and political finance.

Website:

> https://pow4vote.org

Topics:

> taiwan, elections, open-data, civic-tech, government, react, supabase, cloudflare-workers

## 表單草稿

### Why does this repository qualify?

> Public Office Watch is an ISC-licensed civic-tech platform at pow4vote.org that makes Taiwan election and public-office records searchable and source-traceable. I am its primary maintainer, responsible for data-import code, PR review, tests, security boundaries, and releases. The repository is actively maintained, with merged fixes and passing CI on September 8, 2026. Its public value is making fragmented official records easier to explore and verify.

### How will you use API credits for your project?

> Use Codex and API credits for PR review, regression-test generation, data-import validation code, migration review, security-boundary checks, documentation, and release automation. AI-assisted identity matching only proposes review candidates; it never merges people by name alone. Sensitive public-data changes require source verification, automated checks, and human approval.

### Anything else we should know?

> A Search Console screenshot supplied Sep 8, 2026 shows 635 clicks, 9,181 impressions, 6.9% CTR and position 9.3 with the 28-day preset; visible dates are Aug 25-Sep 6, exact bounds unverified. Separately, Cloudflare estimates 4,430 views and 1,070 visits for Aug 11-Sep 7 UTC, excluding flagged bots, with daily rows only Aug 25-Sep 7. These sampled counts may include maintainer/test traffic and are not unique users. Metrics are not combined.

這三段是可編修草稿。第一段的維護者角色須由申請人確認；第三段引用維護者提供的 Search Console 截圖與 Cloudflare API 估計，分別標示期間和限制，不宣稱完整收錄量、獨立使用人數或廣泛採用。

## 數據更新方式

1. Cloudflare 選擇 Web Analytics 的 `pow4vote.org`，記錄完整日期、時區、hostname、bot 篩選、page views、visits 與抽樣資訊。具體查詢及本次快照見[證據文件](oss-application-evidence-2026-09-08.md)。
2. Search Console 本次已依截圖取得 domain property 的 Web 搜尋彙總；送件前再核對完整起訖日、資料完成狀態與匯出時間。維持截圖讀值與 API 驗證的區別，不從「28 天」按鈕或圖表日期反推未顯示的窗口。
3. Google 日期採 PT，Cloudflare 本次採 UTC。即使日期標籤相同也不代表相同時間窗口；兩來源分開呈現，不能相加或互算轉換率。
4. 若列有曝光頁面／查詢數，須說明匯出上限與隱藏資料，不把回傳列數當成完整收錄量；不提交逐筆搜尋字詞或訪客資料。
5. 維護者／測試流量未排除、抽樣、缺少觀測日期與任何來源限制一併保留。

不必為等待漂亮數字而延後；官方採 rolling review。使用目前已核實證據即可準備送件，送件前再刷新快照。
