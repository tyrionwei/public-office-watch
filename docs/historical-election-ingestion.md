# 歷史選舉資料匯入流程

這一版先建立中選會歷史候選人資料的匯入入口，目標是支援從解嚴後選舉一路累積到現在。歷史資料預設只進身份解析層，不直接新增公開人物或候選人頁資料，避免同名與跨年度重複人物污染主檔。

## 同步方式

- 一般同步維持原本範圍：`npm run sync:real-data:dry-run` / `npm run sync:real-data:write`
- 歷史資料預覽：`npm run sync:real-data:historical-dry-run`
- 歷史資料寫入 local Supabase：`npm run sync:real-data:historical-write`

歷史模式會加上 `--include-historical-cec`，掃描中選會公開資料包內可辨識的 `elcand.csv`。

## 第一版匯入範圍

- 掃描 1989 年以後的中選會候選人檔。
- 支援總統、副總統、區域立委、平地/山地原住民立委、縣市首長、直轄市/縣市議員。
- 略過目前已由 baseline 同步處理的 2024 總統立委與 2022 地方公職資料，避免重複。
- 略過不分區政黨名單，因為該檔案目前不是個人候選人資料。

## 寫入策略

- 歷史候選人先寫入 `source_people`，`is_public = false`。
- 欄位宣稱寫入 `person_claims`，`review_status = pending`、`visibility = review_only`。
- 不直接寫入 `people`、`candidates` 或公開人物頁。
- 之後透過 `identity_unmatched_source_people` 與比對分數逐步合併到正式人物。

## 後續工作

- 針對歷史資料建立姓名、性別、政黨、地區、職位、年代的 match scoring。
- 將高可信度跨來源人物列為 `probable_match`，人工確認後再合併。
- 補歷史選舉 voting date 與已改制縣市對照表。
- 完成後再把已確認人物的歷年參選紀錄整理到人物詳情頁。

## 已知歷史代碼對照

第一版已先處理中選會歷史資料裡常見的新舊縣市碼，讓 review queue 不再只顯示 `縣市代碼01000`。仍需在後續補完整官方代碼來源與改制紀錄，例如升格前後的臺北縣/新北市、桃園縣/桃園市等。

## 初步比對策略

歷史來源人物寫入時會嘗試產生 `probable_match`：

- 標準化姓名相同作為基本條件。
- 性別、政黨、角色、地區線索加權。
- 分數達 75 以上才寫入 `probable_match`。
- 不直接更新 `people`，仍需後續審核或更嚴格規則確認。
