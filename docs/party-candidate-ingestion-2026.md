# 2026 政黨候選人資料匯入準備

檢查日期：2026-07-29

本階段只確認來源與匯入邊界，不新增候選人、不寫入正式 Supabase。

## 現有基礎

- `candidates.candidacy_status` 已支援：
  - `potential`
  - `party_nominee`
  - `officially_announced`
  - `registered`
  - `qualified`
  - `withdrawn_or_disqualified`
  - `unknown`
- `candidate_status_history` 會保存候選狀態變更及當時來源。
- 中選會正式名單已有獨立 importer，且只接受 `cec.gov.tw` 來源與
  `registered`、`qualified`、`withdrawn_or_disqualified` 三種狀態。
- 政黨提名與個人宣布參選必須走另一條來源流程，不能送進中選會 importer。
- 本機目前有一筆可公開的 2026 地方選舉：
  `planned-2026-local-public-officials`，包含 236 個市長、縣市長及議員選區，
  尚未有候選人。
- 236 個選區中只有 21 個縣市長選區；缺少嘉義市市長選區。這是因為既有
  2026 選區由 2022 一般選舉資料建立，而嘉義市長選舉當年延期另行舉行。
  候選人匯入前必須先以中選會來源補齊嘉義市市長選區。
- 另一筆只有 4 個選區、來源為 `example.invalid` 的 2026 選舉是非公開測試資料，
  後續匯入不得使用。

## 狀態判定

| 官方來源用語 | 寫入狀態 | 說明 |
| --- | --- | --- |
| 政黨核定、提名、徵召某人 | `party_nominee` | 政黨網站候選人頁也屬於此類 |
| 當事人正式宣布參選，但政黨尚未提名 | `officially_announced` | 必須使用當事人官方來源 |
| 有意參選、爭取提名、初選登記 | `potential` | 不可誤標為正式候選人；第一階段先不匯入 |
| 中選會受理登記 | `registered` | 只由中選會 importer 更新 |
| 中選會審定候選資格 | `qualified` | 只由中選會 importer 更新 |

同一人後續被正式登記或審定時，更新既有 candidacy 並保留狀態歷程，
不要建立第二筆候選關係。

## 已確認官方來源

### 民主進步黨

- 2026 選舉官網：`https://teamtaiwan.dpp.org.tw/`
- 縣市長資料：公開 JavaScript 資料檔，2026-07-29 檢查時有 20 筆。
- 直轄市議員資料：`https://teamtaiwan.dpp.org.tw/councilor`
  目前涵蓋六個直轄市，頁面直接輸出候選人卡片。
- 可取得欄位包括姓名、縣市／選區、照片、經歷、學歷及官方社群連結。
- 首頁及資料檔一般公開請求回傳 200；`robots.txt` 未列出禁止路徑。
- 適合第一階段建立低頻、可重現的來源 adapter。

### 中國國民黨

- 官方網站：`https://www.kmt.org.tw/`
- 目前提名資料分散在中常會、徵召及提名新聞稿，未找到集中且完整的候選人名冊。
- 只解析明確寫有「通過提名／徵召／核定」的句子。
- 初選登記、民調勝出但尚待中央審議者不能寫成 `party_nominee`。
- adapter 應以公告 URL 作為來源單位，支援多批公告去重與後續撤回。

### 台灣民眾黨

- 官方網站：`https://www.tpp.org.tw/`
- 官網已有多批 2026 提名公告，內容包含姓名、職位、縣市與選區。
- 2026-07-29 以一般公開 HTTP client 檢查時回傳 Cloudflare Managed Challenge：
  HTTP 403、`cf-mitigated: challenge`。
- 不嘗試繞過驗證、不使用挑戰 token，也不把搜尋引擎摘要當成可直接發布的來源。
- 第一階段採人工在一般瀏覽器開啟官方公告，保存原始 URL、標題、日期與本文快照，
  再交給離線 parser；若網站後續開放一般讀取，再改為低頻 adapter。

### 第二批來源

- 時代力量 2026 候選人頁：`https://newpowerparty.tw/vote2026`
- 台灣綠黨 2026 參選人頁：
  `https://web.greenparty.org.tw/posts/news/2026candidate/`
- 小民參政歐巴桑聯盟及台灣前進陣線的官方公告，可在主要三黨流程穩定後納入。

## 正規化來源契約

政黨來源 adapter 先輸出 JSON 快照，不直接寫資料庫：

```json
{
  "schemaVersion": 1,
  "electionYear": 2026,
  "sourceType": "official_party_nomination",
  "party": "民主進步黨",
  "source": {
    "name": "政黨官方來源名稱",
    "url": "https://official.example/path",
    "publishedAt": "2026-07-01",
    "retrievedAt": "2026-07-29T12:00:00+08:00"
  },
  "records": [
    {
      "sourceCandidateKey": "party-and-source-stable-key",
      "personName": "姓名",
      "candidacyStatus": "party_nominee",
      "raceType": "municipality_mayor",
      "regionName": "臺北市",
      "districtName": null,
      "nominationAnnouncedAt": "2026-07-01",
      "profileUrl": null,
      "photoUrl": null
    }
  ]
}
```

規則：

- `sourceCandidateKey` 必須由政黨、選舉、選區及來源內穩定識別組成，不可只用姓名。
- 縣市名稱先正規化，例如 `台`／`臺`，再比對既有 region 與 race。
- 不從政黨網站寫入候選人號次；號次只能來自中選會正式資料。
- 政黨頁面的自傳、口號與社群連結不是建立候選關係的必要條件，可分開審核。
- 原始快照先進 `raw_source_records`，解析結果必須先 dry-run。

## 身分與選區比對

1. 只連到 `planned-2026-local-public-officials` 這筆公開選舉。
2. 先依 `race_type + region + district` 找唯一 race，不靠標題模糊猜測。
3. 先用既有官方來源識別及 canonical map 找人。
4. 姓名只能提供待審核候選，不可自動合併同名人物。
5. 找不到既有人物時建立來源限定的待審核人物，再經 identity review 決定是否合併。
6. race 不唯一或不存在時整筆阻擋，不能自動建立猜測選區。

## 分階段實作

### Phase 1：政黨候選來源 importer

- 先補齊並驗證嘉義市市長選區，確認全國共有 22 個縣市長選區。
- 建立正規化 JSON validator 與 dry-run report。
- 驗證來源網域、狀態值、選舉年份及 source key 唯一性。
- 列出新增、更新、人物待確認、選區未匹配及狀態降級等結果。
- 預設不寫入資料庫。

### Phase 2：民進黨 adapter

- 擷取縣市長 JavaScript 資料與議員頁面卡片。
- 產生快照並與 236 個既有 race 比對。
- 先處理縣市長，再處理六都議員。

### Phase 3：國民黨公告 adapter

- 以官方公告 URL 清單作為輸入。
- 僅解析已核定的提名／徵召資訊。
- 將初選中、待審議與正式提名分開。

### Phase 4：民眾黨人工快照流程

- 由一般瀏覽器人工開啟公告並保存本文。
- 離線 parser 產生相同正規化快照。
- 不自動操作 Cloudflare challenge。

### Phase 5：審核後寫入本機

- 寫入來源、candidate、狀態歷程與必要的來源限定人物。
- 驗證人物頁、選舉頁、選區頁與搜尋。
- 確認沒有同名錯接及重複 candidacy 後，才另行決定正式發布。

## 暫不執行

- 不從搜尋引擎摘要直接匯入或發布。
- 不用媒體整理取代政黨官方提名來源。
- 不繞過 CAPTCHA、Cloudflare 或其他安全驗證。
- 不在候選人完成中選會登記前標為 `registered` 或 `qualified`。
- 不在本階段自動發布到正式 Supabase。
