# 基層候選姓名與人物資料分離（待發布）

純村里長／鄉鎮市民代表的候選紀錄可自行保存姓名，不再必須建立人物頁。只要既有身分群組有任何較高層級參選，仍保留人物及所有基層參選連結；沿用現有發布機制。

## 本批內容

- `20260926105525_stage_grassroots_profile_update.sql`：加入基層人物詳細頁暫時調整的更新紀錄草稿，說明姓名與歷屆參選紀錄保留、較高層級人物不受影響，並交代未來經費充裕及資料庫升級後逐步恢復。沿用既有草稿機制，實際精簡與網站發布驗收後再公開，published_at須設定為實際發布時間。

- `20260926093536_grassroots_candidate_names.sql`：新增 candidate_name、允許基層 candidate.person_id 為 NULL；限制無人物候選必須有姓名且只能屬基層選舉。公開候選檢視保留 target 原有欄位與私有人物 gate；不同 name-only 候選不因同名合併。
- `PartyPage.tsx`：有 person_id 才顯示人物連結，無 person_id 的候選卡片保留姓名與選舉內容。
- `compact-grassroots-name-only.sql`：以既有 canonical 群組全部參選歷史界定範圍，保存姓名、解除目標連結、移除人物與刷新公開資料，並檢查保留人物、候選歷史、回報及地區不變量。
- `compact-grassroots-local.py`：僅限完整本機資料庫的備份核對及原子套用工具，不支援正式環境。

本批不包含私人 dump/archive、研究資料、個人操作紀錄、尚未發布的現任日期推算功能或原工作區其他變更。兩筆同一身分的不可變回報歷程依賴人物，在本機保留為私有且無公開頁；正式唯讀檢查未發現該例外。

## 已有驗證與限制

本機完整 dump 在隔離 PostgreSQL 還原通過；23表逐列指紋一致後，以單一交易套用成功。移除59,736筆人物，69,771筆候選改name-only；94,681筆候選歷史全部保留。隔離驗證覆蓋同名不同候選、空名拒絕、高層級NULL拒絕、選舉改類別拒絕、私有人物gate及anon RPC。

實際本機頁面驗證通過：基層姓名存在且無人物連結、純基層人物頁不存在、高層級人物保留基層參選歷史、手機投票地區設定/儲存/reload。這些資料庫與真人資料驗收來自原本機工作區，不能冒稱完整正式副本或本release分支已部署。

本機精簡後回收七張受影響表格的空間，DB約1.67GB降至0.83GB。此數字不代表正式環境的峰值需求。

Release工作區從最新origin/main（ce1c1f7）建立，已通過建置、lint、500項資料合約測試（7項按既有條件跳過）、公開暴露檢查、資料邊界檢查（保留既有SelectedRegionHud mock import警告）與正式依賴稽核（0漏洞）。未提供DB設定的legacy view檢查依既有程式跳過，不列為通過。正式public_candidates的六個精準改寫片段已唯讀核對出現次數符合預期，這不是正式套用。

首次建置/合約檢查因借用原工作區缺少最新main的qrcode依賴失敗；改用release自身lockfile獨立npm ci後通過。CI瀏覽器入口兩次在預啟動4173埠的HTTP探測阻塞；只列測試成功、Playwright代理解析不使用proxy、直接未啟動埠請求逾時。採一次替代：預先啟動此release已建置的mock preview，暫存config僅允許重用該已確認服務，原分享/手機案例7項全部通過。狀態/錯誤處理78項通過；同一已建置mock preview的PWA離線案例1項通過（本機暫存config重用Vite preview，CI原PWA使用Python靜態server）。未改CI設定或測試斷言，不能將此結果稱為原CI自動啟動流程已修復。

## PR #53 補強：後續匯入、archive 與 nullable contract

- 維護中的官方候選審核入口 `review-official-candidate-snapshot.mjs` 支援明確 `name_only` 決策。純基層不建立 `people` 或人物 identity match，只保存候選姓名與 `person_id = NULL`；來源及 claims 仍保留私有審核紀錄。候選寫入後將 ID 寫回 claim，後續 registration lifecycle 及狀態歷史繼續使用 candidate ID。
- 基層要 `use_existing`，必須提供人工交叉身分證據，且目前候選歷史須證明目標人物有較高層級參選。同名、external ID 存在或有 `people` 紀錄，都不足以直接連結。缺少／未分類職類、無審核決策、嘗試清掉既有人物連結均拒絕。
- 兩支 2018 村里長／鄉鎮市基層 legacy importer 的 `--write` 已停用；保留 dry-run，後續寫入改走新版審核入口。其原有自動建人物與人物合併不再重放；mixed subcounty 舊批次亦須改走審核流程。固定 identity-review round 若未傳入新版明確決策，基層寫入會被共用 writer 擋下。既有 generic 人物 claim UI 仍維持人物審核界線，name-only 使用上述官方審核入口。
- 一般內部 identity API 的 create／approve 會先依已保存來源及實際目標職類檢查，基層與不明選舉職類導向官方候選審核，不先建立人物。拒絕錯配仍可使用原入口。
- `sync-real-public-data.mjs` 在第一次寫入前拒絕基層／未知候選 seed 及明確基層人物 seed；基層來源仍可蒐集，但不寫自動 identity 配對，保留既有人工核對結果。五個會掃描全部既有來源的 legacy identity RPC 暫停呼叫並明確回報 skipped，**包含它們原本對較高層級人物的自動處理**；恢復前須另補可限制職類的方案，不能只過濾當批輸入。未修改或執行 DB 函式。
- Registration lifecycle 同時要求 claim 的 candidate ID 與 manifest 候選一致，防止同選區錯配。舊 claim 沒有 candidate ID 時停止，需核對後補關聯，不按同名推斷。
- `PublicCandidate.person_id` 改為 `string | null`，mapper 保留 SQL NULL。人物比較及人物清單明確排除無人物 ID 的紀錄；人口屬性依候選 ID 索引，候選分組不再以同名當身分。沿用原本發布機制，未新增前端人物頁隱藏規則。
- 新增離線 `scripts/export-grassroots-archive.py`，從已驗證的精簡前 tagged archive 拆成獨立 gzip JSONL：`people`、`person_claims`、完整候選列、candidate-person links、`source_people`、identity matches、merge decisions，以及 manifest／外部 identity 依賴清單。保留 UUID、external ID、審核狀態與證據，依主鍵挑選增量恢復；不按姓名猜 canonical identity、不覆寫較新的目標資料、不自動公開。archive 範圍是原始 UUID 快照的超集合，不能當精簡刪除名單。

私有備份旁已另外產生 `grassroots-incremental-v1/`：59,940 筆 people、292,802 筆 claims、69,977 筆候選及 links、51,582 筆 source_people、51,583 筆 identity matches、28,727 筆 merge decisions。來源 SHA-256／完整筆數及產物解壓、JSON、筆數與 manifest 雜湊均驗證；原本完整 dump 與 tagged archive 保留。這次沒有連線寫入資料庫，也沒有執行 restore UI／新一輪完整還原演練。外部 identity 與 race 依賴須在將來恢復時核對既有目標或完整 dump。

本次只跑新增及受影響範圍的測試：同一工作樹整合執行官方審核／匯入、同步防護、registration 靜態 SQL 契約、name-only／候選分組／選舉統計、內部審核 API／claim 合約，共 64 項通過；archive 合成資料另 2 項通過。前端 app 與 Vite/node TypeScript、修改檔 lint 通過。未重跑既有大量 local compaction、CI、瀏覽器或正式環境驗收；新版匯入未對真實 DB 寫入，mock REST 與 registration 靜態檢查不等於現場驗收。獨立唯讀審查指出的同步覆寫身分配對及 registration 錯配風險已修正，複核無新增阻斷。正式低容量方案仍為 blocking，PR 保持 Draft。

## 正式部署前阻擋條件

本批狀態為release準備，不可直接合併觸發部署。以下條件尚未完成：

1. 新的手動 production dump、完整隔離還原與回復演練。正式備份只供部署回復，長期人物archive沿用精簡前本機備份。
2. 正式低容量分段精簡版本及峰值驗證。現有migration會建FK索引並全表回填姓名，現有compact腳本會複製整表至TEMP及大量更新；**不得直接套用在接近500MB的正式環境**。TEMP或UNLOGGED都不是零磁碟成本。
3. 維護期間先釋放可重建公開快取、再分批更新與回收的具體順序；需保存原公開基準於DB外，不能清空後再讀取。先提交釋放空間後，整個流程便不再是單一可回滾交易。不能修改已套用migration的ledger假裝相同流程；正式分段方案需保持DDL及migration歷史一致。
4. 正式快取重建順序、匿名API/人物頁/候選姓名/投票地區、權限與migration drift驗收。
5. 既有正式搜尋到地區頁的smoke失敗須另有修正及驗收證據；不能用本批本機通過覆蓋舊失敗。
6. 正式寫入、遠端推送與合併部署的明確授權；合併main會啟動既有自動部署。

2026-09-26唯讀資料：正式叢集499,675,313 bytes；同規則目標59,738筆人物與69,771筆候選。四個主要物化快取約55.96MB，僅可視為可研究的空間來源，不能當作完整峰值已通過。隔離副本驗證搜尋快取清空可立即釋放空間且重建前後資料相同，但正式快照全流程尚未演練。

## 回復界線

正式操作之前保存當次正式dump、必要角色/ACL、發布基準與重建定義。資料交易未提交時回滾；已提交的分段操作依階段恢復快取／索引或使用當次正式備份，並保留備份後新增資料。不得把完整本機研究dump覆蓋正式資料。只有回退前端commit不能恢復已移除人物。

發布流程沿用 `docs/deployment-environments.md`：功能分支 → 暫時release分支 → 審核/授權 → PR至main → CI及部署 → 正式smoke。正式資料migration須在適當階段另行核准套用，不能繞過部署的drift檢查。
