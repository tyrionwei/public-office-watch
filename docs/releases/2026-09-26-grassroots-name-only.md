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

本批狀態為release準備，不可直接合併觸發部署。以下列出已完成的證據與仍須通過的條件：

1. 已通過：手動 production dump、99表完整隔離還原，以及零批次、首批、完整精簡後的原位回復。正式切換前仍須核對來源漂移與所用備份；長期人物archive沿用精簡前本機備份。
2. 正式低容量分段精簡版本及峰值驗證。原migration會建FK索引並全表回填姓名；目前已移除全表回填，但現有compact腳本仍會複製整表至TEMP及大量更新；**不得直接套用在接近500MB的正式環境**。TEMP或UNLOGGED都不是零磁碟成本。
3. 維護期間先釋放可重建公開快取、再分批更新與回收的具體順序；需保存原公開基準於DB外，不能清空後再讀取。先提交釋放空間後，整個流程便不再是單一可回滾交易。不能修改已套用migration的ledger假裝相同流程；正式分段方案需保持DDL及migration歷史一致。
4. 正式快取重建順序、匿名API/人物頁/候選姓名/投票地區、權限與migration drift驗收。
5. 既有正式搜尋到地區頁的smoke失敗須另有修正及驗收證據；不能用本批本機通過覆蓋舊失敗。
6. 正式寫入、遠端推送與合併部署的明確授權；合併main會啟動既有自動部署。

2026-09-26唯讀資料：正式叢集499,675,313 bytes；同規則目標59,738筆人物與69,771筆候選。四個主要物化快取約55.96MB，僅可視為可研究的空間來源，不能當作完整峰值已通過。正式快照的完整精簡及原位回復已在隔離副本通過，詳細證據與正式限制見下方低容量演練。

## 回復界線

正式操作之前保存當次正式dump、必要角色/ACL、發布基準與重建定義。資料交易未提交時回滾；已提交的分段操作依階段恢復快取／索引或使用當次正式備份，並保留備份後新增資料。不得把完整本機研究dump覆蓋正式資料。只有回退前端commit不能恢復已移除人物。

發布流程沿用 `docs/deployment-environments.md`：功能分支 → 暫時release分支 → 審核/授權 → PR至main → CI及部署 → 正式smoke。正式資料migration須在適當階段另行核准套用，不能繞過部署的drift檢查。


## 低容量演練：移除全表姓名回填

正式完整備份已完成，隔離還原99表筆數及逐列指紋一致。原migration的全表回填會使候選資料表膨脹；先清四個快取或暫卸11個非唯一效能索引，都未通過容量／中途回站驗證。因此這兩個次序停止使用。

目前migration只新增結構與限制，保留人物的候選仍由 `people.name` 取得姓名；`candidate_name` 可以是NULL。只有純基層候選解除人物連結時，才在同一批交易寫入姓名。新增索引仍會佔空間，這份migration不能單獨在接近額度的正式庫直接套用。

依 `docs/local-supabase-validation.md` 的歷史migration修正规則，保留SQL雜湊：

- 原本機已套用版本 SHA-256：`41aca2275eac9bc8b125c9fc6929a4ec4035e1ee75a687564c5ef46b1283d498`。
- 本次不做全表回填版本 SHA-256：`8cd2262398f0eb7b52753ab40ac234c8f152876a3d102567b4884edfb107fcc5`。

原本機已保存的candidate_name維持原值，不重跑migration、不改既有ledger、不reset資料庫；正式尚未套用此版本。新版本的linked候選NULL姓名已在正式dump隔離副本驗證，公開姓名與原公開名單逐列相同。

新隔離流程按canonical身分整群分60批處理，全部候選ID/原欄位、公開姓名/選取、非目標人物身分連結及發布範圍比對通過：移除59,738筆純基層人物、69,771筆候選name-only、候選總數94,681不變。12個快取重建及匿名 `published.race_page_for` 回傳姓名/NULL人物通過；內部資料仍不開放anon直接讀取。以正式備份容量與隔離實體差額投影，精簡與回收階段取樣峰值約462MB、完成約342MB。這是隔離投影，不能當正式實測或峰值上界。

零批次、首批與完整精簡後的原位回復均已通過：10張受影響/歷程表的筆數與逐列指紋、69,833筆公開候選及41,968筆原人物目錄完全吻合，12個快取回建。完整逆向階段取樣投影峰值約496.9MB；回復由原UUID補回資料與連結，不清空資料庫、不停用觸發器/FK、不改既有local ledger。這仍只有約3MB的投影餘裕；零批次回復更接近500MB，不能據此直接進正式。私人dump、逐列journal與執行紀錄不提交至公開repo。


### 正式操作仍須通過的維護關卡

1. 先完成全站維護與正式停寫，確認當次正式project、完整dump、外部journal/發布基準/SQL雜湊及所有FK依賴。執行前與每批交易內都拒絕未預期的來源變更；不覆蓋備份後的新資料。
2. 先清四個可重建快取，在資料保持原狀時，依序重建people、candidates、person_claims、person_merge_decisions、candidate_facts的索引，再重建四個快取。此順序已在恢復原資料的隔離副本通過。正式索引與同資料量、同DDL的隔離重建結果相差約19.2MB，僅為可能節省值。
3. **必須在四個快取已回建、可完整服務的狀態下，實測正式cluster不超過485,000,000 bytes，才開始候選DDL或精簡。**15MB是操作緩衝門檻，不能用隔離估算代替實測，也不是峰值上界證明；未達門檻則保持原人物資料、不進精簡。
4. 在維護狀態重新清四個快取，套用已審查的DDL-only migration與正確ledger；按canonical整群分批，候選姓名/發布選取凍結於外部基準。每批候選/facts更新及人物刪除同交易，批次間一般VACUUM重用空間，再按已驗順序回收與重建12個快取。
5. 索引與快取各階段均須有容量上限、失敗後斷點續行與原位回站工具。逆向順序為先補原UUID人物與依賴資料，再復原候選/facts；空間整理期間保留PK、唯一性及FK保護。完成資料/ACL/匿名RPC驗收及既有搜尋問題修正後，才可依授權合併PR及部署新版前端；維護須持續到部署後人物頁/候選姓名/投票地區/搜尋流程smoke通過，才恢復公開服務。

隔離流程與可續行maintenance executor已完成限定驗證；正式索引尚未整理、15MB緩衝尚未取得。正式維護/停寫、逐階段上界與回復證據、當次資料epoch/內容斷言及部署驗收仍是blocking。


### 離線操作包

`scripts/build-grassroots-compaction-plan.py` 從已校驗的私人journal與外部發布基準產生forward/reverse SQL及雜湊manifest，完全不連線、不執行SQL。輸出含原始人物與依賴資料，必須放在未追蹤的私人目錄，不能提交Git。原local runner仍僅限本機，不可用於正式低容量操作。

每批交易核對完整原列、canonical群、基層職類、公開候選集合/姓名及FK依賴；公開view的已知依賴表納入鎖定。每個群必須有原候選，facts人物核對canonical ID而非raw候選person_id。跨群的已拒絕合併紀錄只連結操作批次，不改人物身分；範圍外依賴或超過2,000人的操作component拒絕。逆向先補所有原UUID人物，再恢復依賴及候選，拒絕覆寫與原始/精簡狀態不同的列。

16項合成測試與獨立唯讀審查通過；使用正式封存成功產生60批操作包。這個離線SQL產生器不執行正式操作；索引/快取/實體回收另由下方maintenance executor處理。schema/ledger、全站維護及正式停寫仍由既有流程處理，正式各gate未通過前不能合併部署。

生成SQL另在既有隔離副本實測一批：999位人物、1,190筆候選精簡與7份逆向SQL全部成功，schema回退後10表逐列指紋、公開候選名單一致。驗證程式首次漏掉回復後的空間整理，直接重建快取時投影500,764,849 bytes而容量驗收失敗；只補上既有已驗證的索引/候選/facts整理後回站通過，完成投影498,741,425 bytes。此失敗保留為操作順序限制：普通VACUUM不足以保證回站容量，完整回復包含空間整理；本測試不宣稱正式容量充足，也沒有重跑60批精簡或原CI。


### 正式可續行的維護 executor

`scripts/grassroots-maintenance-executor.py` 專責 cache/index/physical reclaim。保留原60批guarded compaction，不改批次分組、人物身分判斷、DDL或migration ledger；產生器只新增每批交易 `SET LOCAL statement_timeout='5min'`，既有lock timeout仍為5秒。私人原操作包保留，另存timeout版本，463份SQL逐檔比對只增加該行，60批成員及順序不變；沒有重新執行精簡。

執行器支援 `cache_clear`、`cache_refresh`、`index_drop`、`index_create`、`reindex_index`、`reindex_table`、`vacuum_full`、`vacuum_reuse` 與只讀 `gate`。只有索引建立可讀取保存的 `pg_get_indexdef` 單句定義，不接受任意維護SQL；移除索引前拒絕PK、unique、replica identity、constraint及FK前綴索引。普通VACUUM固定 `TRUNCATE FALSE`，只記頁面重用，不宣稱實體容量回收；後續容量只採當下實測cluster值。

- 計畫與所有備份、逆向SQL、DDL、前後置SQL及峰值報告均以SHA-256固定，檔案限於私人package內。計畫只保存host/port/dbname/user，憑證不放manifest或journal。
- 每個phase開始前，重新核對實際DB/system identifier/PostgreSQL版本、維護/停寫斷言、資料epoch、備份及回復斷言；物件大小必須落在峰值證據的範圍內。
- 每個phase都有操作峰值、操作前回站及提交後回站三個容量門檻；提交後再用實際cluster量與剩餘回復需求驗證，不能沿用操作前的較小數字。
- 所有rewrite/reindex（包括快取回建和索引重建）都要求與SQL、資料前後置條件、版本、連線目標、執行設定、備份及回復路線綁定的保守上界證據，涵蓋heap/TOAST、indexes、temporary及其他增長。只有取樣最大值、缺報告、版本/大小不同或fixture證據，皆不准正式執行。過去演練的取樣投影沒有自動升格為此證據。
- 動作之前把intent原子寫入外部journal並fsync檔案與目錄；完成後驗資料/索引有效性/快取內容及容量，再寫done。全程使用同一資料庫session持有advisory lock，另有本機檔案鎖，沒有在接近額度的DB新增操作狀態表。
- 中斷先等原session釋鎖再只讀reconcile。filenode改變不是單獨成功證據；還要通過完整前後置資料/catalog斷言、全部相關index有效性及容量。已提交且驗證完成才標done，不重送；已確認未執行須明確retry，或轉回復。狀態不明停止，不能手改journal冒充完成。
- 普通VACUUM中斷後無法證明是否已完成時，若資料與回復條件通過，標記 `reuse_unconfirmed`，只准轉回站，不自動重送、不給回收容量credit。已提交但未通過容量門檻則標 `committed_blocked`，只准走回復路線。
- 首輪必須prepare；完成後才可finish，recover開始後不得再走forward。正式每條路線以完整服務gate結束；12個快取須存在且已填入，內容/ACL依hash固定的post SQL核對。prepare終端實測cluster必須不超過485,000,000 bytes。

#### 私人計畫與峰值證據契約（以下為v1；正式需使用末節v2）

計畫格式 `grassroots-maintenance-v1`：`target` 包含kind、public connection selectors及已核實的database/session_user/server_version_num/system_identifier；`settings` 固定work_mem/maintenance_work_mem=32MB、parallel maintenance=0、lock_timeout=5s；`watch`列全部受影響物件（正式必含12個公開cache）；`maintenance_guard`、`backup_artifacts`、`phases`、`routes`均不可缺。artifact一律為 `{path, sha256}`，相對於私人package根目錄。

每個phase列 `id`、`kind`、`relation`（gate除外）、`epoch`（original/name_only/restored）、`statement_timeout_ms`（1秒至5分鐘）、`reserve_bytes`、`post_max_cluster_bytes`、`min_physical_reclaim_bytes`，以及 `pre`、`post`、`recovery_before`、`recovery_after`、`evidence`。索引create/drop另有definition。SQL斷言是一個不帶分號、恰好回傳一列boolean true的SELECT，在唯讀交易內執行；須核對真實資料/內容指紋、schema/ACL及應有的物件狀態，不能用 `SELECT true` 當正式驗證。

`routes`固定prepare/finish/recover入口及phase ID順序。prepare沿既有「四MV清空→五表索引整理→四MV回建→完整服務15MB gate」；finish沿已驗證的八表實體整理與12MV回建順序。recover入口須確認既有guarded reverse已恢復所要求的資料epoch（prepare尚未動人物時則原資料已符合），再依已驗證順序整理/回建。DDL、ledger、60批forward/reverse、外部維護切換及停寫仍由既有操作流程處理；executor不替它們製造完成狀態。

證據格式 `grassroots-space-envelope-v1` 必須包含：

| 欄位 | 意義 |
|---|---|
| `status=passed`、`basis=reviewed_conservative_upper_envelope`、`reports` | 已審查的上界報告及來源hash；取樣峰值不能代替 |
| `binding_sha256`、`server_version_num`、`scope` | 綁定精確操作與回復路徑；正式只接受production_shape |
| `operation_extra_bytes` | 操作中相對phase起點的額外峰值上界 |
| `recovery_before_extra_bytes` | 未提交/失敗回到起點狀態時，回站所需額外峰值 |
| `max_after_delta_bytes` | 成功提交後，cluster相對起點的增量上界 |
| `recovery_extra_bytes` | 從已提交狀態繼續回站的剩餘額外峰值 |
| `components`、`observed_extra_bytes` | heap_toast/indexes/temporary/other與觀測下界；上界不得低於分項加總/觀測 |
| `relation_min_bytes`、`relation_max_bytes` | 所有watch物件的適用大小範圍；不存在為0 |
| `recovery_covers` | 固定before/during/after_commit，報告必須涵蓋三種停點 |

寫入前分別要求 `current + operation_extra + reserve <= ceiling`、`current + recovery_before_extra + reserve <= ceiling`、`current + max_after_delta + recovery_extra + reserve <= ceiling`；寫入後要求 `actual_after + recovery_extra + reserve <= ceiling`，並核對實際增量/回收及post最大容量。`max_after_delta`要使用負值時，僅准已驗證的實體回收操作，且預計縮減不得高於目標物件大小下限與必要實測回收量；普通VACUUM/gate不能使用負值。這避免把尚未發生或可能已被其他操作回收的空間先當作可用。

可先用 `--print-bindings` 輸出證據需要綁定的hash；它只計算binding，不驗證或核准計畫。未提供完整正式上界與回復證據前，executor會拒絕執行，不能填入舊取樣值或合成fixture報告來過門檻。

#### 操作入口與驗收界線

在獨立Python環境安裝 `scripts/requirements-grassroots-executor.txt`（psycopg 3.2.12）。預設指令完全離線，不讀憑證、不連DB：

```sh
python scripts/grassroots-maintenance-executor.py --plan /private/package/maintenance.json --plan-sha256 <已審查SHA256>
```

正式作用中的環境/維護授權另行確認後，連線從私有 `POW_GRASSROOTS_DSN` 載入；必須明列已核對host/port/dbname/user，正式僅允5432 session endpoint與verify-full TLS。不能用service、hostaddr或多host覆寫目標。`--apply --route prepare --state /private/package/state.json --permit-production <project-ref>` 預設一次一phase，下一次同指令從journal續行；`--max-phases`只控制本次數量，不跳過任何gate。

出現中斷，先以同一plan/state/route加 `--reconcile-only` 核對。只有not_applied可用 `--apply --retry-not-applied` 明確重試；已驗證未執行、已提交但阻擋或reuse_unconfirmed也可在recover entry通過後切 `--route recover`。不要刪journal、換plan hash、重送未知交易或手改done。若system identifier權限不可用或版本變動，停止核對，不能放寬目標驗證來續跑。

本輪只驗新增executor及timeout：29項離線故障注入、1項batch timeout契約及5項小型PostgreSQL17合成fixture通過；涵蓋所有維護SQL型別、提交後斷線不重寫、statement timeout後回站、兩個executor排他與唯讀斷言拒絕寫函式。沒有重跑既有60批、完整還原、本機精簡、舊瀏覽器或舊CI驗證；合成fixture不支持正式峰值結論。正式仍未停寫/整理/精簡/部署，PR維持Draft；正式上界報告、具體epoch/內容與freeze斷言、來源新鮮度及執行授權尚須按實際計畫審核。

### 峰值／回復證據複核：第一步仍不可放行

本次只離線核對既有來源／journal雜湊，重算867筆階段觀測，未重跑60批、完整還原或新增正式操作。原始log第一筆仍使用舊校正值；此次一律從未變更基準453,495,955與正式快照499,675,313計算固定offset46,179,358，保留原log不覆寫。以下全部是**舊隔離觀測的投影，不是即時正式值或峰值上界**：

| 既有情境 | 含起點的觀測投影最大值（bytes） | 距500,000,000上限（bytes） |
|---|---:|---:|
| 零批次DDL／schema回退／快取回站 | 499,953,841 | 46,159 |
| 首批精簡及回復 | 499,855,537 | 144,463 |
| 完整精簡後原位回復 | 496,922,801 | 3,077,199 |
| 已整理過的副本再跑前置索引整理／回站 | 496,947,377 | 3,052,623 |
| 單批操作包回站漏掉必要實體整理（失敗） | 500,764,849 | -764,849 |
| 補做既定實體整理後回站 | 498,741,425 | 1,258,575 |

867個phase中705個只有一次取樣；表中保留失敗及修正情境，不能把最後完成值替代全程最大值，也不能加上任意百分比就視為保守上界。資料指紋回復通過與容量安全必須分別判定。普通VACUUM沒有預支實體回收量，遵循[PostgreSQL VACUUM說明](https://www.postgresql.org/docs/17/sql-vacuum.html)。

第一個清快取動作的來源起點只剩324,687 bytes。清空後約釋放19.96MB，不能倒推動作執行前／執行中的新檔案與catalog增長一定放得下。既有零批次及前置索引情境皆先清完四個快取，沒有證明「只清第一個快取後中斷」的完整回站上界。五表索引重建是在完整回復後、索引已緊密的副本上執行，各步database before=after；先前19,210,240 bytes只代表正式索引與副本的差額，不能當成正式必然節省量或15MB gate已通過。

另一個待補項是回復路線的停點適用性。executor目前只有一條固定`routes.recover`；第一步未執行時原服務仍完整，第一步已提交時search cache為空，兩者不能僅憑`recovery_covers`字面欄位就宣稱使用同一SQL序列安全。前者若不必要地重建已填入cache，反而可能在接近額度時要求額外空間。正式計畫必須逐一綁定：停點／reconcile狀態、資料epoch、cache及index狀態、可執行回復序列、操作前／中／提交後的容量上界；unknown先只讀reconcile，不能猜分支或手改journal。這項在當次複核尚未實作；後續v2分支修正與驗證見末節，正式私人回復計畫仍未核可。

因此目前不產生`status=passed`的正式space-envelope，也不允許第一筆正式prepare寫入。下一輪只補第一步的暫態上界與各停點回復分支，再處理其餘rewrite/reindex的heap/TOAST、index、temp與其他成長上界；寫入凍結、實際版本、來源新鮮度及獨立disk/WAL餘裕仍須在正式執行前確認。若第一步無法在現有餘裕下取得可信上界，才交由使用者決定額外容量或另行審查的前置釋放方式；不得直接試正式操作。

本次離線來源與journal完整性通過；獨立唯讀審查確認上述兩個缺口。既有commit `870c816` 的Web CI #113已成功；本段只更新證據分類與阻擋條件，不代表新增DB驗收。PR維持Draft，沒有merge、部署或正式DB變更。

### Checkpoint-aware recovery（v2）與首個 cache_clear 的結論

`grassroots-maintenance-v2`取代正式使用的固定recover路線。v1僅保留隔離測試相容，正式plan會拒絕。原60批forward及403份guarded reverse檔案不重分組、不修改；本輪只離線核對403份reverse的既有SHA／bytes、manifest membership、transaction格式與5分鐘timeout，沒有對真資料重跑。

`routes`只列prepare／finish；`recovery_branches`每支包含`id`、`case`、`from={route,completed,pending}`、唯讀`entry` artifact及`phases`。completed必須是來源route的精確已完成前綴，pending只能是已reconcile的not_applied_verified／committed_blocked／reuse_unconfirmed；unknown拒絕選支。符合journal且現場entry為真的分支必須恰好一支，多支或沒有都停止。分支ID與來源checkpoint保存至外部journal；恢復中斷後固定原分支。若剛保存分支、第一個phase尚未開始，續行會重验entry與data guard；已有phase時依該停點的pre/post與capacity gate續行。

| 分支 | 執行範圍 |
|---|---|
| `not_applied` | 僅原服務gate，不REFRESH原本完整的快取 |
| `cache_cleared` | 僅重建分支指定且現場仍為空的快取，再驗服務gate |
| `indexes_partially_rebuilt` | 按索引存在狀態與journal選定剩餘序列，已完成部分不重送 |
| `name_only_batches_started` | 完整逆向已提交的批次前綴，再實體回收、回建快取與服務gate |

資料分支另有`data_checkpoint={package_manifest,committed_batches,guard}`。批次只能是從0開始的連續已提交前綴；guard必須驗前綴已提交、其餘未提交及完整資料形狀，不能以候選NULL數量或`SELECT true`代替。程式機械要求reverse清單等於manifest中該前綴的全部表／檔案及原順序，不准任意省略。

新增typed `guarded_reverse` phase，沒有relation欄位，而是`package_manifest`、`reverse_file`與互斥的`post`／`not_applied`斷言，另保留既有pre、recovery_before/after、evidence及容量欄位。只能執行hash固定、manifest列出的既有逆向transaction；statement_timeout須為300000，SQL的SET LOCAL仍為5min。正式逆向資料表須列入watch。提交後斷線時，依資料前後狀態核實已提交才標done，不再重送；兩個斷言同真或同假均視為ambiguous。這是已審查SQL產物的身分／格式驗證，不是允許執行任意SQL的沙箱。

跨候選批次的plan須宣告`data_window={after_route:prepare,package_manifest,full_commit_guard}`；程式要求prepare完成後的0至60批每個可達前綴都有回復分支，正式plan另須覆蓋每個maintenance前綴及已reconcile中斷狀態。finish進入、續行及每個phase前，都強制核對與完整批次回復分支相同的full_commit_guard，不能在只提交部分批次時進finish。正式有finish或name-only回復分支卻缺data_window會被拒絕。SQL斷言的逐列語意及完整私人plan仍須獨立審核，不能把存在guard檔案當成已驗證資料。

首個`cache_clear`已專門核對PostgreSQL **17.6** 的[matview.c](https://raw.githubusercontent.com/postgres/postgres/REL_17_6/src/backend/commands/matview.c)與[cluster.c](https://raw.githubusercontent.com/postgres/postgres/REL_17_6/src/backend/commands/cluster.c)：WITH NO DATA跳過查詢填入，但仍建立transient heap、可能的TOAST、更新catalog及交換實體，提交前不能預支舊檔回收量。小型隔離PG另外測得before、未提交during、關閉session後rollback、after-commit及恢復後狀態；這是交易／續行機制證據，未做連續峰值量測，也不是正式形狀或正式上界證明。

**結論：無法在現有正式快照324,687 bytes餘裕下建立可信保守上界，停止硬證明並維持首寫阻擋。**未產生passed space-envelope。建議先增加實際可用容量；若希望維持現有額度，可另審單一非必要索引卸除，但其自身catalog增長、依賴與回建容量也須先有證據，不能直接當已安全替代。普通VACUUM、刪列或19.2MB索引差額均不是可預支的實體容量。未購買／升級資源、未連正式DB、未merge或部署，PR保持Draft。

同一release版本整合驗證：原29項受影響executor合約與新增21項checkpoint/reverse離線測試通過；新增6項小型PG17.6測試通過（不重跑既有60批／完整還原）。第一次fixture驗證的觀測連線被嚴格freeze guard納入active session，測試改為明列唯一唯讀觀測連線；帶數字的fixture schema也揭露reverse LOCK TABLE格式過窄，已與identifier契約對齊。這兩項均在修正後重新驗證，未放寬正式maintenance guard。獨立複核指出的空恢復run入口漂移、漏逆向檔／中間批次及finish完整提交guard均已修正。測試owned容器完成後停止移除，其他stack與私人備份保留。

### 2026-09-27 正式一次性維護與查詢修正（仍未完成）

使用者改採一次性全站維護、停寫後精簡，保留既有 dump/archive/reverse；先在隔離副本完整演練，再於正式移除可重建搜尋快取、套用 DDL-only schema。這是使用者另行接受未知暫態峰值、必要時人工回復或暫時增容的方案，未將歷史取樣升格為保守上界，也未放寬通用 executor 的容量要求。

正式原方案遇鎖定及 statement timeout 後停止。針對昂貴 public_candidates 核對，產生器改用共享 MATERIALIZED 結果，仍以雙向 EXCEPT ALL 檢查全部欄位及重複筆數，不改目標、順序、DML、鎖定或 5 分鐘逾時。17 項受影響離線測試、11 項隔離 PostgreSQL 語義 fixture 與單次評估計數通過；正式唯讀單項核對約 11.9 秒、所有 20 項寫入前檢查約 40.1 秒。

修正後第 21 批成功提交，但第 22 批再次觸發整個 DO 區塊的 statement timeout，當時 context 為 person_claims 比對；不能據此認定該單項查詢就是全部瓶頸。已停止唯一替代方案，不再自動重送。網站保持維護與資料庫停寫，PR 維持 Draft；physical reclaim、快取重建、migration ledger、正式前端部署及回站驗收仍未完成。普通 VACUUM 只供頁面重用。

原操作包、403 份逆向 SQL、全部備份及 archive 保留；衍生包只修改未完成批次的公開候選核對與對應 SQL 雜湊。私人操作包及正式逐列核對證據不提交公開 repository。

停止後以串流逐列核對 8 張受影響表，精確符合前 21 批，第 22 批未套用；94,681 筆候選全數保留，其中 24,818 筆已為 name-only。資料庫未再次重啟，cluster 實測 485,847,217 bytes；這只確認已提交資料與停止邊界，不能視為完成精簡或恢復服務。
