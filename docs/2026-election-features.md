# 2026 參選時間線與投開票所驗收

最新進度：新增913筆純文字姓名登記，本機可顯示18,413筆（17,500筆已連人物＋913筆純姓名）；暫未公開4筆，身分待核仍917筆。詳見[純姓名登記呈現](cec-registration-name-roster-2026-09-05.md)。下文保留前一階段紀錄。

2026-09-05 更新：十輪身分核對後，本批公開登記事件已增至 17,269 筆、待核剩 1,148 筆。詳見[第一批身分核對](cec-registration-identity-review-2026-09-05.md)、[第二批身分核對](cec-registration-identity-review-2026-09-05-round-2.md)、[第三批外部生日補證](cec-registration-identity-review-2026-09-05-round-3.md)、[第四批同名排除](cec-registration-identity-review-2026-09-05-round-4.md)、[第五批性別正規化與轉戰證據核對](cec-registration-identity-review-2026-09-05-round-5.md)、[第六批縣市長身分鏈](cec-registration-identity-review-2026-09-05-round-6.md)、[第七批現職轉戰核對](cec-registration-identity-review-2026-09-05-round-7.md)、[第八批現職轉戰核對](cec-registration-identity-review-2026-09-05-round-8.md)及[前一批本機公開紀錄](cec-registration-publication-2026-09-05.md)。最新逐筆核對見[第九批審核](cec-registration-identity-review-2026-09-05-round-9.md)。下文保留前一階段驗收紀錄。 最新完整比對見[第十輪審核](cec-registration-identity-review-2026-09-05-round-10.md)。

驗收日期：2026-09-04。分支：codex/2026-registration-polling-analytics。

## 本次完成

1. 登記狀態改為「已申請登記」。2026 起的人物參選卡片新增公開時間線，登記者顯示「尚待選舉委員會資格審定」。
2. 新增投票事件、官方來源、投開票所與整數鄰號對應；首頁手機及桌面可依戶籍村里、選填鄰別查詢，提供地址、原始適用條件與 Google Maps 連結。

本次只修改本機程式及完整本機 Supabase。正式網站、Cloudflare 設定與正式 Supabase 均未寫入或部署。

## 登記生命週期

沿用既有 candidacy_status 與內部 candidate_status_history，另建 candidate_lifecycle_events，不把資料修改歷程當成公開事件。

- 由上一批已核對的登記匯入結果建立 16,822 筆登記事件。
- 其中 320 筆屬於已公開參選資料，可由本機 published 查詢讀取；其餘事件保持不公開。
- 598 筆沒有明確登記日期，occurred_on 保持 NULL。
- source_published_on 取自官方來源頁日期；fetched_at 保存抓取時間；source_hash 保存原檔 SHA-256。三者不互相代填。
- 原先 1,595 筆待核對登記紀錄未提升審核或公開狀態。
- 名單缺席不會觸發退選或資格不符；抽籤號次只由相應官方事件提供。
- 重複執行匯入不會重複建立事件。

本機 published 層已更新，人物頁可看到本批既有公開參選者的新狀態。新建人物、候選資料的公開資格仍依原審核流程處理。

公開 RPC candidate_lifecycle_for 僅接受一個參選 ID，最多回傳 50 筆。它同時檢查事件、候選資料、選區、選舉的公開狀態與 published 收錄情形，只回傳固定欄位，沒有開放原始證據 JSON 或內部審核資料。

## 投開票所來源與已匯入範圍

2026-09-06 依[中選會全國公告索引](https://web.cec.gov.tw/central/article/64374)核對 22 縣市來源頁、附件網址、公告日期與 SHA-256。共用匯入器目前可嚴格驗證並同步 15 縣市；來源含 9 份 ODS 及 6 份文字型 PDF。PDF 以固定欄位座標及投票所標籤上下緣擷取，並要求投票所編號自 0001 完整連號，再通過行政區、村里、地址、鄰號、已人工確認的回歸列和重複分派檢查。

已可匯入：臺北市、新北市、桃園市、臺中市、高雄市、宜蘭縣、苗栗縣、彰化縣、南投縣、嘉義縣、屏東縣、臺東縣、新竹市、嘉義市、金門縣。

新北市官方 ODS 的 SHA-256；其餘來源雜湊見 data-sources/2026-polling-places.json：

23858ceebfb00ffa4130761d0cb1864a9849377edadaa9cb6773c7f9011e0df1

| 項目 | 15 縣市合計 |
|---|---:|
| 一般選舉人投開票所／村里分派列 | 14,790 |
| 涵蓋村里 | 6,093 |
| 明確鄰號對應 | 95,670 |
| 無法只靠鄰號唯一判定 | 62 |

新竹市官方 PDF 的 359 個連續投票所編號及嘉義縣的 540 個連續投票所編號，現在均完整保留一般選舉人村里分派。原先每頁第一列位於投票所編號上方的續行已改由表頭與標籤邊界正確納入。

合計 62 筆標示 ambiguous；相關村里不會僅憑鄰號宣稱唯一對應。其中新北 23 筆路段、門牌或戶籍條件保留官方原文，苗栗與南投各 2 筆是官方同鄰分流；文字型 PDF 尚有臺北 2 筆、臺中 30 筆及新竹市 3 筆無法可靠還原，均只列可能場所。其餘重複鄰號、全里與其他場所衝突、重複場所列、超過查詢上限等情形會使匯入失敗。

行政區代碼沿用現有國土測繪中心村里目錄。來源中的瓦磘里、灰磘里、獇寮里，對應目錄的括號造字表示；坪林石𥕢里對應石[曹]里，瑞芳濓洞／濓新對應濂洞／濂新。這些對應限定同一行政區，沒有姓名或村里模糊比對。

data-sources/2026-polling-places.json 已列出並核對 22 縣市，未完成的 7 縣市保留具體原因：

| 狀態 | 縣市 | 原因 |
|---|---|---|
| 單列補充來源待支援 | 臺南市 | 選舉 PDF 第 0366 所缺地址；市府活動中心頁有官方地址，但目前資料模型不能保存該列的第二來源 |
| 官方缺必要欄位 | 澎湖縣、基隆市 | 澎湖附件整體缺地址；基隆 ODS 缺村里與鄰別 |
| OCR 與人工覆核 | 新竹縣、雲林縣、花蓮縣、連江縣 | 官方附件是掃描圖，沒有可直接擷取的文字 |

來源缺必要欄位或解析未通過時保持未匯入，不以地址猜村里，也不把不完整資料標成 ready。

## 鄰別與顯示

- 保留 public-office-watch.voting-region-preference.v1 儲存鍵；neighborhood 是選填整數。
- 舊設定仍可讀取；變更村里不會沿用舊村里的鄰號。
- 查詢只送 event_key 與 village_code，鄰別在瀏覽器比對。
- 無資料時顯示本站尚未收錄；無法唯一判定時列可能場所及官方條件。
- 同一事件／縣市只使用一份 current 官方來源，舊版不混入結果。
- 投票類別仍以中選會查詢及投票通知單為準；本批為官方村里公告的地點對應。

## 重現匯入與驗證

登記事件工具需要上一輪保存的 tmp/cec-registration-final 來源、審核結果及 ID manifest。預設執行交易後 ROLLBACK，--apply-local 才 COMMIT；寫入目標固定完整本機資料庫。

~~~sh
node scripts/import-cec-registration-lifecycle.mjs
node scripts/import-cec-registration-lifecycle.mjs --apply-local
~~~

投開票所工具需要 Node 22、Python 3 與 Poppler pdftotext。預設處理 manifest 中全部 ready 縣市；原檔不存在時由官方連結下載，每次校驗 SHA-256 並重新擷取，來源內容更動時停止等待覆核。預設交易後 ROLLBACK，只有 --apply-local 才寫入完整本機 Supabase。同一來源重匯會在單一交易中完整替換投票所與鄰別集合，避免舊解析殘留。

~~~sh
node --experimental-strip-types scripts/import-2026-polling-places.mjs
node --experimental-strip-types scripts/import-2026-polling-places.mjs --apply-local
node --experimental-strip-types scripts/import-2026-polling-places.mjs --county-code 65000
npm run test:polling-places
node scripts/verify-election-features-local.mjs
~~~

import-new-taipei-polling-places.mjs 保留為只處理新北市的相容入口。

新增 schema 已在完整本機建立；這些 migration 留供後續正式發布審核，這次未變更正式 migration history。

驗證結果：

- 建置、變更檔案 ESLint、公開存取範圍檢查通過。
- 前端讀取契約測試 301 通過、7 個既有整合測試跳過、0 失敗。
- 投開票所解析、鄰號正規化與快照替換測試 11 通過，PDF 列界線測試 7 通過；CI 已新增根目錄資料工具工作。
- 15 縣市 dry run 與本機套用皆通過；實際寫入 14,790 筆分派與 95,670 筆鄰別。另以暫時第 999 鄰驗證同來源重匯後殘留為 0。
- 完整本機的匿名實際查詢逐縣市抽樣 15/15 通過；私有表、私有事件、私有候選資料與舊來源均被阻擋。發布演練的既有驗證亦通過。
- 手機／桌面瀏覽器驗證通過：老梅里第 15 鄰對應第 0004 所，改成第 2 鄰對應第 0003 所，重新整理保留設定，請求未包含鄰號。
- 沈伯洋的 2026 登記事件顯示實際 09/02、來源公告 09/04，兩個日期分開。
- Supabase security advisors 未回報 error 等級項目。
- 發布演練的一般公開資料 smoke 通過；演練容器與拋棄式資料卷已停止並移除，完整本機資料庫保留。

## 發布前待處理

演練資料庫約 364 MiB，超過專案 350 MiB 容量目標。本次沒有為通過容量目標刪除研究資料或修改容量標準。正式發布前應另行處理容量，並審核本批登記資料哪些可公開；投開票所其餘 7 縣市已在來源 manifest 記錄阻礙；掃描 PDF、缺地址或缺村里欄位的來源先保留，等待地方選委會釋出較完整且可可靠核對的資料後再匯入。

原有 SelectedRegionHud 直接引入 mock 的檢查警告、Vite 設定的未來相容性及既有大區塊建置警告仍在，本次沒有調整其範圍。
