# 2026 參選時間線與投開票所驗收

最新進度：新增913筆純文字姓名登記，本機可顯示18,413筆（17,500筆已連人物＋913筆純姓名）；暫未公開4筆，身分待核仍917筆。詳見[純姓名登記呈現](cec-registration-name-roster-2026-09-05.md)。下文保留前一階段紀錄。

2026-09-05 更新：十輪身分核對後，本批公開登記事件已增至 17,269 筆、待核剩 1,148 筆。詳見[第一批身分核對](cec-registration-identity-review-2026-09-05.md)、[第二批身分核對](cec-registration-identity-review-2026-09-05-round-2.md)、[第三批外部生日補證](cec-registration-identity-review-2026-09-05-round-3.md)、[第四批同名排除](cec-registration-identity-review-2026-09-05-round-4.md)、[第五批性別正規化與轉戰證據核對](cec-registration-identity-review-2026-09-05-round-5.md)、[第六批縣市長身分鏈](cec-registration-identity-review-2026-09-05-round-6.md)、[第七批現職轉戰核對](cec-registration-identity-review-2026-09-05-round-7.md)、[第八批現職轉戰核對](cec-registration-identity-review-2026-09-05-round-8.md)及[前一批本機公開紀錄](cec-registration-publication-2026-09-05.md)。最新逐筆核對見[第九批審核](cec-registration-identity-review-2026-09-05-round-9.md)。下文保留前一階段驗收紀錄。 最新完整比對見[第十輪審核](cec-registration-identity-review-2026-09-05-round-10.md)。

驗收日期：2026-09-04。分支：codex/2026-registration-polling-analytics。

## 本次完成

1. 登記狀態改為「已申請登記」。2026 起的人物參選卡片新增公開時間線，登記者顯示「尚待選舉委員會資格審定」。
2. 新增投票事件、官方來源、投開票所與整數鄰號對應；首頁手機及桌面可依戶籍村里、選填鄰別查詢，提供地址、原始適用條件與 Google Maps 連結。
3. 確認正式站既有 Cloudflare Web Analytics 自動載入正常；資料說明頁新增統計與本機地區設定的隱私說明。

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

## 投開票所第一批

來源：[新北市選舉委員會 2026 投開票所設置地點公告](https://web.cec.gov.tw/tpcec/article/63508)，來源頁公告日期 2026-08-18。

官方 ODS 的 SHA-256：

23858ceebfb00ffa4130761d0cb1864a9849377edadaa9cb6773c7f9011e0df1

| 項目 | 筆數 |
|---|---:|
| 官方投開票所列 | 2,728 |
| 涵蓋村里 | 1,039 |
| 明確鄰號對應 | 19,276 |
| 全里適用 | 234 |
| 含路段、門牌或戶籍條件 | 23 |

23 筆條件式資料保留完整原文，標示 ambiguous；相關村里不會僅憑鄰號宣稱唯一對應。其餘重複鄰號、全里與其他場所衝突、重複場所列、超過查詢上限等情形會使匯入失敗。

行政區代碼沿用現有國土測繪中心村里目錄。來源中的瓦磘里、灰磘里、獇寮里，對應目錄的括號造字表示；坪林石𥕢里對應石[曹]里，瑞芳濓洞／濓新對應濂洞／濂新。這些對應限定同一行政區，沒有姓名或村里模糊比對。

data-sources/2026-polling-places.json 已列出 22 縣市。第一批只有新北市 ready，其餘 21 縣市標記 not_checked，並不表示官方尚未公告。

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

新北投票所工具需要 Node 22 及 Python 3 標準函式庫。原檔不存在時由 manifest 官方連結下載；每次皆校驗原檔雜湊並重新擷取 ODS，避免沿用被修改的中介 JSON。來源更動時會停止，須重新核對。

~~~sh
node --experimental-strip-types scripts/import-new-taipei-polling-places.mjs
node --experimental-strip-types scripts/import-new-taipei-polling-places.mjs --apply-local
node --test scripts/polling-place-normalization.test.mjs
node scripts/verify-election-features-local.mjs
~~~

新增 schema 已在完整本機建立；兩份 migration 留供後續正式發布審核，這次未變更正式 migration history。

驗證結果：

- 建置、變更檔案 ESLint、公開存取範圍檢查通過。
- 前端讀取契約測試 296 通過、7 個既有整合測試跳過、0 失敗。
- 鄰號正規化測試 3 通過。
- 完整本機及發布演練的匿名實際查詢都通過；私有表、私有事件、私有候選資料與舊來源均被阻擋。
- 手機／桌面瀏覽器驗證通過：老梅里第 15 鄰對應第 0004 所，改成第 2 鄰對應第 0003 所，重新整理保留設定，請求未包含鄰號。
- 沈伯洋的 2026 登記事件顯示實際 09/02、來源公告 09/04，兩個日期分開。
- Supabase security advisors 未回報 error 等級項目。
- 發布演練的一般公開資料 smoke 通過；演練容器與拋棄式資料卷已停止並移除，完整本機資料庫保留。

## 發布前待處理

演練資料庫約 364 MiB，超過專案 350 MiB 容量目標。本次沒有為通過容量目標刪除研究資料或修改容量標準。正式發布前應另行處理容量，並審核本批登記資料哪些可公開；投開票所其餘 21 縣市可依來源 manifest 逐批補入。

原有 SelectedRegionHud 直接引入 mock 的檢查警告、Vite 設定的未來相容性及既有大區塊建置警告仍在，本次沒有調整其範圍。
