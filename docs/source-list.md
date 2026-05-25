# Source List

## 優先來源

1. 監察院財產申報
2. 監察院政治獻金公開查閱
3. 經濟部商工登記公示資料
4. 政府電子採購網
5. 中選會候選人資料
6. 公開資訊觀測站
7. 司法院裁判書查詢系統

## 必須保留連結的高風險來源

### 政治獻金

- 監察院政治獻金公開查閱平台：https://ardata.cy.gov.tw/home
- 113年度政黨政治獻金會計報告書：https://data.gov.tw/dataset/175227
- 同步下載端點目前記錄在 `data-sources/real-public-data.seed.json` 的 `data-gov-tw-party-contribution-6562003.downloadUrl`。
- 公開 UI 必須至少保留 `sourceName` 與 `sourceUrl`，讓使用者能回到來源平台查核。
- 不公開個人捐贈明細；只公開政黨年度摘要與具統一編號的公司層級彙總。

### 司法 / 犯罪紀錄

- 司法院裁判書開放資料 API：https://opendata.judicial.gov.tw/api/
- 政府資料開放平台裁判書資料：https://data.gov.tw/dataset/63205
- 這類資料只能先進 review lead，不可因姓名命中自動公開。
- 公開時必須保留判決或資料來源連結、案由/摘要、判決狀態、可信度與審核時間。

## 每次擷取至少記錄

- sourceType
- sourceName
- sourceUrl
- fetchedAt
- snapshotHash
- notes
