# 2026 登記名冊：出生年份區分同名者（第十三輪）

2026-09-05；分支 codex/2026-registration-polling-analytics；完整本機研究資料庫。

建立 17 位獨立人物並接上官方登記，待核由 1,104 降至 **1,087**，本批公開登記資料由 17,313 增至 **17,330**。累計十三輪解除 508 筆身分待核；正式環境未變更。

## 核對依據

先前比對只採獨立的生日資料欄位，本輪也納入已確認之 2026 登記原始表所提供的出生日期、年份及性別。只有所有已知同名人物均具一致且不同的出生年、沒有同村里或代表選區的歷史關係、且沒有其他同名待核登記時，才建立獨立人物。本輪資料全部具備官方登記出生年；不靠性別差異單獨判定，不推測出生月日。

19 件符合出生年差異條件，其中林敏㨗仍有字形及舊資料對應疑點、陳彥廷仍有另一筆同名待核登記，均保留待核；其餘 17 件完成。

| 姓名 | 登記選區 | 官方登記來源 |
|---|---|---|
| 林宜瑾 | 臺東縣鹿野鄉第3選舉區 | [原始名冊](https://web.cec.gov.tw/api/file/ad6f26ea-8ca2-4c9f-b746-f467c4768230.pdf) |
| 陳金昌 | 宜蘭縣員山鄉蓁巷村 | [原始名冊](https://web.cec.gov.tw/api/file/393f2e1b-f64d-47ae-adb0-d82e0853e9f2.pdf) |
| 林建國 | 宜蘭縣南澳鄉東岳村 | [原始名冊](https://web.cec.gov.tw/api/file/5ef7176b-6287-47b0-9c4e-b4aa49dedcf2.pdf) |
| 陳國禎 | 宜蘭縣南澳鄉金岳村 | [原始名冊](https://web.cec.gov.tw/api/file/393f2e1b-f64d-47ae-adb0-d82e0853e9f2.pdf) |
| 李素娥 | 臺東縣臺東市南王里 | [原始名冊](https://web.cec.gov.tw/api/file/d1f90517-2239-475d-a9ed-fba93c43b96a.pdf) |
| 許麗珠 | 臺東縣太麻里鄉第2選舉區 | [原始名冊](https://web.cec.gov.tw/api/file/ad6f26ea-8ca2-4c9f-b746-f467c4768230.pdf) |
| 黃萬春 | 臺東縣池上鄉新興村 | [原始名冊](https://web.cec.gov.tw/api/file/d1f90517-2239-475d-a9ed-fba93c43b96a.pdf) |
| 何國維 | 臺東縣臺東市豐谷里 | [原始名冊](https://web.cec.gov.tw/api/file/d1f90517-2239-475d-a9ed-fba93c43b96a.pdf) |
| 陳中正 | 宜蘭縣宜蘭市梅洲里 | [原始名冊](https://web.cec.gov.tw/api/file/393f2e1b-f64d-47ae-adb0-d82e0853e9f2.pdf) |
| 張永德 | 宜蘭縣壯圍鄉復興村 | [原始名冊](https://web.cec.gov.tw/api/file/5ef7176b-6287-47b0-9c4e-b4aa49dedcf2.pdf) |
| 陳牡丹 | 臺東縣成功鎮信義里 | [原始名冊](https://web.cec.gov.tw/api/file/d1f90517-2239-475d-a9ed-fba93c43b96a.pdf) |
| 洪偉倫 | 宜蘭縣宜蘭市孝廉里 | [原始名冊](https://web.cec.gov.tw/api/file/393f2e1b-f64d-47ae-adb0-d82e0853e9f2.pdf) |
| 王國華 | 宜蘭縣南澳鄉第2選舉區 | [原始名冊](https://web.cec.gov.tw/api/file/83f3d8f4-ba18-4eae-9c1b-cfa51deecfeb.pdf) |
| 吳村田 | 臺東縣東河鄉第1選舉區 | [原始名冊](https://web.cec.gov.tw/api/file/ad6f26ea-8ca2-4c9f-b746-f467c4768230.pdf) |
| 陳世軒 | 宜蘭縣壯圍鄉第3選舉區 | [原始名冊](https://web.cec.gov.tw/api/file/cd5a1add-e814-46d3-a6ff-e3ffc8dd07a2.pdf) |
| 黃振榮 | 新北市新莊區國泰里 | [原始名冊](https://web.cec.gov.tw/api/file/472d2f18-af27-4d33-9f1c-8ab548311f52.pdf) |
| 梁文德 | 宜蘭縣三星鄉第3選舉區 | [原始名冊](https://web.cec.gov.tw/api/file/cd5a1add-e814-46d3-a6ff-e3ffc8dd07a2.pdf) |

## 本機驗證

- 先試跑回滾，通過後才寫入。核對 15 份官方原始文件校驗值，包含新登記資料及同名者已確認登記的生日來源。
- 新增 17 位人物、17 筆參選關係、17 筆登記事件，更新 17 筆私人審核結果。
- 17 位新人物的現職及 position 均為空，只有自己的 2026 登記紀錄；未帶入同名者的生日、經歷或當選紀錄。
- 累計 508 筆已解除案件及其公開人物、登記事件完全一致，194 個訪客樣本通過，包含本輪全部 17 人。
- 整批 17,330 筆參選與登記事件一致；重複人物 0、錯誤資格狀態 0、公開原始審核資料 0。郭璽職位回歸檢查通過。
- Windows 網站及本機 Auth API 回應 200；本機 published 環境檢查與 Docker 實際 54321 映射正常。

本機發布識別：bdfcf732-016f-4e8b-926f-097ad2e644d6。

## 剩餘範圍

剩餘 1,087 筆中仍有 201 筆提供出生日期或年份，但不代表皆可直接通過；多數還缺少可比對的既有人物出生資料。本輪未宣稱其餘案件已完成外部來源查核。上一輪林庭秝與顏翎熹的舊名履歷對齊仍待處理。

逐筆證據及檔案校驗值見同名 JSON；完整本機輸入、試跑與正式寫入報告保存在 tmp/cec-registration-identity-review-13。
