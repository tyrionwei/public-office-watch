# Person Media Policy

本文件說明人物照片資料模型與公開規則。

## 1. 人物照片用途

人物照片未來會用於：
- 人物頁
- 候選人列表
- 搜尋結果 avatar

## 2. 照片也必須經過來源與授權審核

人物照片不能只因為能找到圖片就直接公開。
必須保留：
- 來源
- 授權
- attribution
- 審核狀態
- 是否公開

## 3. 不可任意抓取的來源

以下來源不可直接抓來當人物照片：
- Google Images
- 新聞照片
- 社群平台照片

## 4. 可接受來源

- 官方開放資料
- 明確授權官方網站
- Wikimedia Commons / Creative Commons
- 自行取得授權
- placeholder 測試圖

## 5. unknown license 不可公開

若 `license_type = 'unknown'`，不得進入 public views。

## 6. pending / rejected / archived 不可公開

只有 `verified` 且 `is_public = TRUE` 的照片，才可能進 public views。

## 7. 沒照片時前端顯示預設 avatar

若 public view 沒有照片欄位，前端應顯示預設 avatar，不應出錯。

## 8. public views 只輸出 verified + public + primary photo

未來前端應只讀：
- `public_person_primary_photos`
- `public_people`
- `public_candidates`

這些 public views 只會輸出：
- `verified`
- `is_public = TRUE`
- `is_primary = TRUE`
- `license_type <> 'unknown'`

## 9. 測試資料不得使用真實政治人物照片

測試資料只能使用 clearly fake placeholder。
不得使用真實政治人物照片、新聞照、社群照片或 Google Images 圖片。
