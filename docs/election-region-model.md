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
