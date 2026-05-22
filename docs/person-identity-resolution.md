# 人物身份解析與新人物匯入流程

這一層的目標是讓不同來源抓到的同一位政治人物可以保守合併，同時保留原始來源、比對理由與可撤銷的審核狀態。未來要從解嚴後選舉一路累積到現在時，所有來源都先進身份解析流程，不直接污染正式 `people` 主檔。

## 資料分層

- `source_people`：每個來源抓到的人物原始身份。中選會、立法院、監察院、司法院、Wikipedia、媒體選舉指南、候選人官網都先各自成為一筆 source person。
- `person_identity_matches`：source person 與正式 `people` 的比對結果。第一版支援 `auto_matched`、`probable_match`、`possible_match`、`rejected_match`、`unmatched`。
- `person_claims`：來源對人物欄位的宣稱，例如性別、黨籍、職位、選區、學歷、經歷、政見、司法線索、家族關係與外部 ID。
- `people`：公開人物主檔，只放已整理後要作為主結論的資料。

## 新人物進來流程

1. 抓取來源資料，保留來源名稱、URL、原始欄位、抓取批次與 hash。
2. 建立 `source_people`，產生穩定 `source_person_key`，並標準化姓名、黨籍、地區、職位與性別。
3. 產生 `person_claims`，所有可用欄位先以 claim 形式保存。
4. 執行身份比對：
   - 官方外部 ID 相同：`auto_matched`，分數 100。
   - 姓名、性別、政黨、地區、職位高度一致：`probable_match`。
   - 只有姓名相同或缺少佐證：`possible_match`。
   - 已確認不同人：`rejected_match`。
   - 沒有候選對象：`unmatched`。
5. 只有 `auto_matched` 或人工確認後的資料才更新 `people` 主檔；低可信度資料保留在 claim/review 區。

## 可信度與顯示規則

- A：官方結構化資料，例如中選會、立法院、監察院、司法院資料開放平台。
- B：官方網站、本人或政黨公開頁。
- C：可信媒體、選舉指南、Wikipedia/Wikidata。
- D：同名風險高、缺少佐證或尚未完成比對的線索。

`public_person_claims` 只公開 `verified + public + is_public` 的 claims。司法、犯罪紀錄、政二代關係等敏感資料可以入庫，但第一版不得直接產生強結論；必須保留來源、可信度與審核狀態。

## 目前第一版落地

- 既有官方同步會同步寫入 `source_people`。
- 每個已匯入的官方人物會建立 `auto_matched` identity match。
- 姓名、性別、黨籍、職位、選區、學歷、經歷、外部 ID 會拆成 verified public claims。
- `identity_unmatched_source_people` 是內部 review view，不列入前端 public view 白名單。

## 後續擴充方向

- 將中選會歷年選舉資料擴展到解嚴後完整時間範圍。
- 新增 Wikipedia/Wikidata 與媒體選舉指南匯入器，預設 C 級。
- 新增司法院裁判書姓名比對線索，預設 D 級或 `possible_match`。
- 建立人工審核 UI 前，先用 SQL view / script 匯出 review queue。
