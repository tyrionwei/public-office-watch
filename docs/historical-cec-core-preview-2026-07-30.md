# 歷史中選會核心資料建立預覽（2026-07-30）

## 範圍

- 資料來源：`cec-2024-votedata`
- 來源類型：`official_election`
- 僅讀取本機 Supabase。
- 本階段不建立人物、選舉、選區或候選紀錄，也不更新 `published`。
- 核心預覽：`local-data/historical-cec-core-preview.json`
- 建置計畫：`local-data/historical-cec-election-race-plan.json`
- 回滾 SQL：`local-data/historical-cec-election-race-dry-run.sql`
- 三個輸出均位於本機忽略目錄，不會隨部署自動執行。

## 資料概況

| 項目 | 數量 |
|---|---:|
| 中選會來源紀錄 | 14,354 |
| 已配對人物來源 | 8,622 |
| 尚未配對人物來源 | 5,732 |
| 來源中的選舉事件情境 | 17 |
| 含未配對人物的事件 | 13 |
| 來源中的選區情境 | 1,746 |
| 含未配對人物的選區 | 1,268 |

建置計畫只處理至少含一筆尚未配對人物的事件與選區。2022 年既有議員資料沒有未配對人物，因此不混入本次 migration；其 22 個縣市事件是否合併，日後另以 election merge 流程處理。

## 既有資料對照

| 處理方式 | 選舉事件 | 選區 |
|---|---:|---:|
| 沿用既有 canonical 紀錄 | 5 | 286 |
| 建立新紀錄 | 8 | 982 |
| 仍需人工確認 | 0 | 0 |

既有 canonical 選舉若涵蓋範圍較廣，例如 `2018年地方公職人員選舉`，保留原名稱與類型，不縮窄成議員選舉。選區仍沿用該 aggregate 事件，不另建重複事件。

## 名稱與分類標準

### 選舉事件

- 總統：`2012年總統副總統選舉`
- 立法委員：`2012年立法委員選舉`
- 新建的歷史議員事件：`1998年直轄市及縣市議員選舉`
- 議員事件以年份為單位；縣市與席次留在選區層。
- 既有較廣的地方公職人員選舉事件不改名。

### 選區

- `第01選舉區`、`第02選舉區`統一為`第1選舉區`、`第2選舉區`。
- 總統副總統：`全國總統副總統選舉`
- 不分區立委：`全國不分區立法委員選舉`
- 平地原住民立委：`全國平地原住民立法委員選舉`
- 山地原住民立委：`全國山地原住民立法委員選舉`
- 地方原住民議員保留歷史縣市、選區編號及平地／山地分類，例如：
  `花蓮縣第5選舉區平地原住民議員選舉`。

### 資料分類

- 選舉類型統一使用現行標準值：`presidential`、`legislative`、`councilor`。
- 立委選區使用：`legislative_district`、`party_list_legislator`、`indigenous`。
- 平地、山地與未細分原住民另以 `seatType` 保留：
  `plain_indigenous`、`mountain_indigenous`、`indigenous`。
- 地方議員沿用 `city_councilor`／`county_councilor`，平地／山地由 `seatType` 與完整選區名稱區分。
- 不新增與既有約束重疊的 `race_type`。

## 歷史地區

目前需要補建且不能改成現代行政區的歷史 county：

- 臺北縣
- 臺中縣
- 臺南縣
- 高雄縣

四筆皆使用固定 external ID、`region_type = county`、`is_public = false`。其他縣市優先沿用 `tw-county-*` 官方地區紀錄，不使用 VoteTW 的職務型 region。

## Migration dry-run

| 動作 | 數量 |
|---|---:|
| 建立歷史地區 | 4 |
| 建立選舉事件 | 8 |
| 標準化既有選舉 | 4 |
| 建立選區 | 982 |
| 標準化既有選區 | 286 |

政策：

- 新紀錄預設 `is_public = false`。
- 來源為中央選舉委員會開放資料。
- 來源紀錄沒有可靠投票日欄位，因此 `voting_date = NULL`，不自行猜日期。
- 歷史結果狀態設為 `completed`。
- external ID 由標準 context key 穩定產生，可重跑。
- 產生器拒絕重複 external ID、重複 context key、重複 canonical 更新目標及未知歷史地區。
- SQL 固定以 `BEGIN` 開始、`ROLLBACK` 結束，不可能由本階段留下資料。

## 回滾驗證

本機 Supabase 實際執行結果：

```text
INSERT regions   4
INSERT elections 8
UPDATE elections 4
INSERT races     982
UPDATE races     286
ROLLBACK
```

回滾後再次查詢：

```text
historical regions = 0
historical elections = 0
historical races = 0
```

表示外鍵、check constraints、唯一索引與計畫筆數皆通過，而且本機資料庫未留下變更。

## 新人物預覽

| 分類 | 數量 |
|---|---:|
| 沒有既有同名人物的來源 | 2,442 |
| 可建立非公開、來源限定人物 | 2,278 |
| 暫緩的跨年份來源 | 164 |
| 暫緩的跨年份人物群組 | 57 |

安全建立條件：

1. 只有一筆中選會官方來源。
2. 公開人物表沒有同名人物。
3. 性別、縣市與職位皆可辨識。
4. 新人物預設 `is_public = false`。
5. 不以黨籍、選區或姓名相同推定跨年份為同一人。

57 組跨年份紀錄只有姓名、性別、縣市與職位等情境證據，缺少生日或穩定人物外部 ID，因此保留人工確認。

## 下一階段

1. 確認這份 4／8／4／982／286 計畫。
2. 將已驗證的 ROLLBACK SQL 轉成正式 local migration。
3. 只套用本機 Supabase，重跑對照確認全部改為沿用既有。
4. 再建立 2,278 個非公開人物及其來源配對。
5. 人物、選舉、選區都確認後，才建立候選關係、票數、得票率與當選狀態。
6. 最後獨立決定哪些歷史資料進入 `published`。
