# Source List

## 優先來源

1. 監察院財產申報
2. 監察院政治獻金公開查閱
3. 經濟部商工登記公示資料
4. 政府電子採購網
5. 中選會候選人資料
6. 公開資訊觀測站
7. 司法院裁判書查詢系統

### 公民投票

- 中選會選舉資料庫－公投：https://db.cec.gov.tw/Referendum
- 中選會公投結果列表：https://web.cec.gov.tw/referendum/article/list/3863?page=1
- 中選會全國性公民投票計票結果開放資料：https://data.cec.gov.tw/?dir=%E5%85%A8%E5%9C%8B%E6%80%A7%E5%85%AC%E6%B0%91%E6%8A%95%E7%A5%A8%E8%A8%88%E7%A5%A8%E7%B5%90%E6%9E%9C
- 中選會地方性公民投票結果：https://web.cec.gov.tw/referendum/article/32310
- 2022 憲法修正案公民複決必須使用獨立類型與外部編號，不得和全國性公投第 1 案合併。
- 公投同意／不同意是選票選項，不得為沿用候選人模型而建立虛構人物。

## 必須保留連結的高風險來源

### 政治獻金

- 監察院政治獻金公開查閱平台：https://ardata.cy.gov.tw/home
- 113年度政黨政治獻金會計報告書：https://data.gov.tw/dataset/175227
- 同步下載端點目前記錄在 `data-sources/real-public-data.seed.json` 的 `data-gov-tw-party-contribution-6562003.downloadUrl`。
- 公開 UI 必須至少保留 `sourceName` 與 `sourceUrl`，讓使用者能回到來源平台查核。
- 不公開個人捐贈明細；只公開政黨年度摘要與具統一編號的公司層級彙總。

### 政黨年度財務

- 內政部政黨資訊網查財報：https://party.moi.gov.tw/PartyFinancialChecklist.aspx?n=16101&sms=13073
- 每年 7 月中旬與 8 月底保存申報、追認、黨員代表大會通過狀態與官方 PDF 連結；不得把這份黨務財報混入監察院政治獻金摘要。
- 官方 PDF 多為掃描影像，金額須經 OCR 與人工覆核後才可進入資料庫或公開層。

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
