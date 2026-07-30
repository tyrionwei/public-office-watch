# 歷史中選會核心資料建立紀錄（2026-07-30）

## 範圍

- 資料來源：`cec-2024-votedata`，類型為 `official_election`。
- 來源總數：14,354 筆。
- 所有檢查與寫入只針對 Local Supabase。
- `local-data` 下的預覽、計畫、dry-run 與覆蓋率報告皆位於忽略目錄，不會部署或公開。
- 人物、選舉、選區與候選均先建立為非公開核心資料，再以 canonical 決策整理重複身分。

## 名稱與分類標準

- `第01選舉區`、`第02選舉區`統一為`第1選舉區`、`第2選舉區`。
- 總統副總統：`全國總統副總統選舉`。
- 不分區立委：`全國不分區立法委員選舉`。
- 平地原住民立委：`全國平地原住民立法委員選舉`。
- 山地原住民立委：`全國山地原住民立法委員選舉`。
- 選舉類型使用 `presidential`、`legislative`、`councilor`。
- 立委選區使用 `legislative_district`、`party_list_legislator`、`indigenous`。
- 原住民席次另保存 `plain_indigenous`、`mountain_indigenous`、`indigenous`。
- 地方議員使用 `city_councilor`／`county_councilor`，完整名稱保留歷史縣市與平地／山地分類。
- 臺北縣、臺中縣、臺南縣、高雄縣保留為歷史 county，不改寫成現代行政區。

## 建立結果

| 項目 | 數量／狀態 |
|---|---:|
| 歷史地區 | 4 |
| 新建歷史選舉 | 8 |
| 新建歷史選區 | 1,068 |
| 第一批來源限定人物 | 2,278 |
| 第二批來源限定人物 | 3,454 |
| 歷史候選 | 11,796 |
| 尚未匹配來源 | 0 |
| 待執行候選建立／更新 | 0 |
| 待人工身分審核 | 0 |

候選建立分三批完成：2,278、6,063、3,455 筆。來源沒有提供的候選號次、票數、得票率或當選狀態均維持缺值，不猜測、不清空既有資料。

## 身分整理

最初來源分成：

- 8,622 筆已有有效人物配對。
- 2,278 筆可安全建立單一來源限定人物。
- 3,454 筆缺乏足夠證據，先建立私有、來源限定人物，避免以姓名直接推定為同一人。

完成所有候選後，再以同屆候選號次與票數、完整選區、黨籍、職位、性別／生日相容性及跨屆參選脈絡進行合併：

- 第一輪：1,696 筆 verified canonical 決策。
- 第二輪：727 筆連鎖收斂決策。
- 最後人工確認：4 組、7 筆決策。
- 最終重新掃描：可合併 0、衝突 0、重複 canonical 目標 0。

原始人物、候選與來源紀錄均未刪除；前端與發布層透過 canonical 關係取得統一人物。

## Migration 清單

- `202607300024_build_historical_cec_elections_and_races.sql`
- `202607300025_build_private_historical_cec_people.sql`
- `202607300026_build_private_historical_cec_candidates.sql`
- `202607300027_build_missing_historical_cec_races.sql`
- `202607300028_build_existing_historical_cec_candidates.sql`
- `202607300029_build_remaining_private_historical_cec_people.sql`
- `202607300030_build_remaining_private_historical_cec_candidates.sql`
- `202607300031_merge_verified_historical_cec_people.sql`
- `202607300032_merge_verified_historical_cec_people_second_pass.sql`
- `202607300033_merge_final_verified_historical_cec_people.sql`

每個寫入階段皆先做真實交易 dry-run 並 `ROLLBACK`，再套用 Local。migration 包含預期筆數、外鍵、衝突與可重跑斷言。

## 發布隔離

- 新建核心資料均 `is_public = false`。
- `published.people` 中上述歷史來源限定人物為 0 筆。
- `published.candidates` 中 `cec-historical-candidate-*` 為 0 筆。
- `published.races` 中 `cec-historical-race-*` 為 0 筆。
- `published.promote(NULL)` 已在每批 dry-run 與 Local migration 中通過。
- 正式 Supabase 未連線、未寫入、未部署。

完整候選覆蓋結果見 `docs/historical-cec-candidate-coverage-2026-07-30.md`。
