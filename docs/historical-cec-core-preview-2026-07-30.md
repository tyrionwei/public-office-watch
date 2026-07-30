# 歷史中選會核心資料建立預覽（2026-07-30）

## 範圍

- 資料來源：`cec-2024-votedata`
- 來源類型：`official_election`
- 所有檢查與寫入只針對本機 Supabase。
- 人物、選舉、選區與候選紀錄已分階段建立為非公開資料，並驗證不會進入 `published`。
- 核心預覽：`local-data/historical-cec-core-preview.json`
- 建置計畫：`local-data/historical-cec-election-race-plan.json`
- 回滾 SQL：`local-data/historical-cec-election-race-dry-run.sql`
- 候選計畫：`local-data/historical-cec-candidate-plan.json`
- 候選回滾 SQL：`local-data/historical-cec-candidate-dry-run.sql`
- 缺少選區計畫：`local-data/historical-cec-missing-race-plan.json`
- 缺少選區回滾 SQL：`local-data/historical-cec-missing-race-dry-run.sql`
- `local-data` 下的輸出均位於本機忽略目錄，不會隨部署自動執行。

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
- dry-run SQL 固定以 `BEGIN` 開始、`ROLLBACK` 結束；正式 migration 則沿用相同 upsert 與筆數斷言。

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

## 選舉與選區 Local migration 套用結果

- migration：`202607300024_build_historical_cec_elections_and_races.sql`
- `202607300023` 的既有人物合併紀錄已存在；本次只補登 migration 歷史，沒有重複建立。
- 正式 migration 已套用至 Local Supabase，沒有連線或寫入正式 Supabase。
- 套用後核心資料數量：歷史地區 4、歷史選舉 8、歷史選區 982。
- 4 個地區、8 場選舉與 982 個選區皆維持 `is_public = false`。
- 同一 migration 以單一交易重跑成功，數量仍為 4／8／982，證明 upsert 可重跑。
- `published.regions`、`published.elections`、`published.races` 對這批 external ID 的筆數皆為 0。

## 人物 Local migration 套用結果

- migration：`202607300025_build_private_historical_cec_people.sql`
- 建立 2,278 位來源限定人物，全部 `is_public = false`。
- 建立 2,278 筆 `auto_matched` 官方來源配對，分數為 100。
- `無`已在人物欄位正規化為`無黨籍`，不改動原始來源內容。
- migration 以單一交易直接重跑成功，人物與配對數量均未增加。
- `published.people` 對這批 external ID 的筆數為 0。
- 中選會來源仍有 164 筆、57 組跨年份人物留在審核區，未自動合併或建立。

## 候選 Local migration 套用結果

- migration：`202607300026_build_private_historical_cec_candidates.sql`
- 只替上一階段新建的 2,278 位來源限定人物建立候選關係，沒有改寫先前已配對的 8,622 筆來源。
- 2,278 筆候選關係全部為一位人物對一個標準選區，且 `is_public = false`。
- 中選會來源提供的 871 筆票數與 871 筆得票率已寫入；其餘缺值維持 `NULL`。
- 當選 10 筆、未當選 2,268 筆；候選資格設為 `qualified`，結果分別設為 `elected`／`not_elected`。
- migration 以單一交易重跑成功，候選總數、人物數與人物／選區組合皆維持 2,278，沒有重複資料。
- `published.candidates` 對這批 external ID 的筆數為 0。
- 正式 Supabase 未連線、未寫入。

## 補齊既有人物所需選區

- migration：`202607300027_build_missing_historical_cec_races.sql`
- 覆蓋率稽核原先找到 202 筆已配對來源，分布在 86 個尚未建立的歷史選區。
- 86 個情境皆能唯一沿用既有選舉與官方／歷史地區，不需新增選舉事件或地區。
- dry-run 在 Local 實際插入 86 筆後完整回滾，歷史選區基準維持 982。
- 正式 Local migration 後歷史選區為 1,068，全部 `is_public = false`。
- migration 以單一交易重跑後數量仍為 1,068，證明 upsert 可重跑。
- `published.races` 對全部歷史選區的筆數為 0。
- 正式 Supabase 未連線、未寫入。

## 既有候選涵蓋稽核

詳見 `docs/historical-cec-candidate-coverage-2026-07-30.md`。

- 8,622 筆既有人物配對中，8,599 筆只有一位有效人物，23 筆為多重人物配對。
- 補齊選區後，6,063 筆可安全建立候選，2,512 筆可安全更新官方欄位，24 筆已完整一致。
- 缺少選區由 202 筆降為 0；可自動處理合計為 8,575 筆。
- 目前人工待查只剩 23 筆多重人物配對。

## 下一階段

1. 以可回滾 migration 處理 6,063 筆候選建立與 2,512 筆官方欄位更新。
2. 重跑涵蓋稽核，確認 8,599 筆唯一人物來源都已有完整候選資料。
3. 逐組處理 23 筆多重人物配對，以及目前保留的 164 筆、57 組跨年份身分。
4. 最後獨立決定哪些歷史資料進入 `published`。
