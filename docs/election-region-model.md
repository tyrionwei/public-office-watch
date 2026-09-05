# Election / Region Model

本文件說明 `regions`、`elections`、`races`、`candidates` 的用途，以及未來地圖導覽與候選人列表會如何讀取 public views。

## 1. 資料表用途

### regions
- 用於台灣、縣市、行政區、鄉鎮市區、村里、特殊選區等地理層級
- 支撐首頁台灣地圖、縣市頁、行政區導覽

### elections
- 用於大型選舉事件
- 例如：地方公職人員選舉、總統副總統選舉、立法委員選舉

### races
- 用於某地區的具體選舉項目
- 例如：台北市直轄市長選舉、台北市議員選舉、區域立委選舉

### candidates
- 用於某人物參加某場選舉項目
- 候選人資料未審核前不可公開

### 選舉與選區的正規化關係
- `same_election`：兩筆來源代表同一場選舉，只有 `verified` 決策會進入 `election_canonical_map`
- `same_race`：兩筆來源代表同一選區，只有 `verified` 決策會進入 `race_canonical_map`
- `aggregate_source_link`：大型選舉事件與較小的公職或縣市子選舉之父子關係，不得當成 `same_election` 合併
- `election_hierarchy_map` 只列出已驗證的父子關係，供匯入、稽核與後續選舉導覽使用
- `rejected` 與 `archived` 決策不影響公開資料

## 2. 地圖行政區不一定等於正式選舉選區

行政區地圖與正式選舉選區不一定完全相同。

- 地圖用的 `regions` 偏向導覽與聚合
- 真正選舉範圍可能需要 `election_district` 或其他特殊區域型別補充

## 3. 地圖第一版範圍

第一版先支援：
- 台灣整體
- 縣市
- 行政區

目前不做村里級地圖呈現。

## 4. 候選人公開規則

- `candidates.is_public` 預設為 `FALSE`
- 候選人資料未審核前不可公開
- 前端未來應讀 `public_candidates`，不直接讀 `candidates`

## 5. 前端未來使用的 public views

### 首頁
- `public_home_election_ticker`
- `public_regions`
- `public_region_election_summary`

### 選舉項目頁
- `public_races`

### 候選人列表
- `public_candidates`

## 6. 測試資料原則

- 不使用真實候選人作為測試資料
- 可使用已公告選舉事件名稱
- 候選人一律使用 clearly fake 測試人物

## 7. 未來延伸

未來若需要照片、頭像、圖片授權與媒體資產，可在 `person_media` schema 或相似結構補充。


## 現行縣市與歷史行政區（2026-09-05）

現行導覽以 apps/web/src/data/taiwanRegions.ts 的22個現行縣市識別碼為準，透過 apps/web/src/lib/countyRegions.ts 共用判斷。不可只按名稱去重，也不可讓使用者先前選取的歷史資料覆蓋現行縣市。

- 首頁縣市列表與地圖只接受現行識別碼；舊縣市不作為缺少現行資料時的替代。
- 人物篩選與歷史行政區頁保留原始識別碼、原名，顯示「歷史行政區」標記。臺中市、臺南市、高雄市另有同名舊制行政區，須用 historical-* 識別，不能只檢查舊縣名。
- 歷史行政區頁不覆蓋首頁已選縣市；首頁收到舊縣市選取時回到全國總覽。
- isCurrentCountyName 只檢查現行名稱；toCurrentCountyName 僅供明確需要沿革對照的用途，不能用它判斷資料是否現行，也不能拿轉換後的名稱改寫歷史地區或選區。
- 歷史選舉抓取須採當屆中選會地區表及代碼。相同的號碼、名稱或後繼縣市，都不代表歷史選區與現行選區相同。

本次為前端選取與呈現修正，未修改資料庫行政區名稱、識別碼、選舉關係或候選人身分。回歸測試涵蓋舊縣名、同名舊制城市、來源順序與歷史標籤。
