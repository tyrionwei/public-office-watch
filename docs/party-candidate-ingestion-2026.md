# 2026 政黨候選人資料匯入準備

檢查日期：2026-07-29

本階段允許寫入本機待審核層；未經人工決定不建立候選關係，也不寫入正式 Supabase。

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
  `planned-2026-local-public-officials`，包含 237 個市長、縣市長及議員選區，
  尚未有候選人。
- `202607290013_add_2026_chiayi_city_mayor_race.sql` 已補齊嘉義市市長選區；本機驗證共有 22 個縣市長選區。
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
- 縣市長資料：公開 JavaScript 資料檔，2026-07-29 實際產生快照時有 19 筆。
- 直轄市議員資料：`https://teamtaiwan.dpp.org.tw/councilor`
  目前涵蓋六個直轄市，頁面直接輸出候選人卡片；實際快照共 188 筆。
- `build-dpp-2026-candidate-snapshot.mjs` 只解析公開資料，不執行遠端 JavaScript，
  並將縣市長與議員分成兩份可驗證快照。
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
- 解析結果必須先 dry-run；通過後才以 `source_people.source_payload` 保存官方來源快照，
  並建立私有、待審核的 `person_claims`。

## 身分與選區比對

1. 只連到 `planned-2026-local-public-officials` 這筆公開選舉。
2. 先依 `race_type + region + district` 找唯一 race，不靠標題模糊猜測。
3. 先用既有官方來源識別及 canonical map 找人。
4. 姓名只能提供待審核候選，不可自動合併同名人物。
5. 找不到既有人物時建立來源限定的待審核人物，再經 identity review 決定是否合併。
6. race 不唯一或不存在時整筆阻擋，不能自動建立猜測選區。

## 分階段實作

### Phase 1：政黨候選來源 importer（本機完成）

- 已補齊並驗證嘉義市市長選區，確認全國共有 22 個縣市長選區。
- 已建立正規化 JSON validator、dry-run report 與本機限定的 `--stage`。
- 已驗證來源網域、狀態值、選舉年份及 source key 唯一性。
- 已列出人物待確認、新人物待確認、既有候選關係及選區未匹配等結果。
- `--stage` 只建立來源、待審核參選聲明與非確認性的身分建議。
- `--apply-reviewed` 只接受具審核人、審核時間及逐筆決定的 JSON；
  通過後才建立私有候選關係，新人物也只在 `create_new` 決定後建立。
- 兩種寫入模式都會拒絕非 localhost 的 Supabase URL。

### Phase 2：民進黨 adapter（本機完成）

- 已擷取 19 筆縣市長 JavaScript 資料與 188 筆六都議員頁面卡片。
- 207 筆資料均成功匹配 2026 公開選區，沒有選區阻擋。
- dry-run 先依 `person_canonical_map` 合併歷史重複列，再比對政黨與歷史參選地區。
- 縣市長分為 9 筆高信心建議、3 筆可能配對、4 筆人工辨識及 3 筆新人物。
- 六都議員分為 139 筆高信心建議、9 筆可能配對、3 筆人工辨識及 37 筆新人物。
- 207 筆均已寫入本機待審核層；其中 160 筆有非確認性的身分建議。
- 初始 staging 重跑後筆數不增加；2026-07-29 已套用 148 筆 A 級身分配對，
  建立同數量的私有 `party_nominee` 候選關係，其餘 59 筆維持待審核，公開候選仍為 0。

### Phase 3：國民黨公告 adapter（本機完成）

- 以 5 篇官方中常會公告作為輸入，解析出 14 位正式縣市長提名人。
- 僅解析同一句同時包含「通過」、「徵召／提名／核定」與「參選」的明確決定。
- 初選中、現任優先、待審議或只描述合作機制的內容不會進入快照。
- 14 筆均成功匹配選區並寫入本機待審核層：7 筆高信心、3 筆可能配對、
  3 筆人工辨識、1 筆新人物。2026-07-29 已套用 7 筆 A 級身分配對並建立私有
  `party_nominee` 候選關係，其餘 7 筆維持待審核，公開候選仍為 0。

### Phase 4：民眾黨 Chrome 輔助快照流程

- 由使用者在一般 Chrome 正常通過 Cloudflare 檢查後，讀取 2026 選戰專區公開頁面。
- 原始 105 筆瀏覽器快照永久保存於
  `data-sources/tpp/2026-election/browser-capture-2026-07-29.json`；可匯入的 64 筆正規化快照保存於
  `data-sources/tpp/2026-election/normalized-candidates-2026-07-29.json`。
- 2026-07-29 已取得 105 個不重複候選人頁：64 筆縣市長／縣市議員可對應現有選區，
  40 筆鄉鎮市長、代表、區長或里長先保留於原始快照。
- 另有 1 筆新竹市議員頁只標示「西區」、未提供第幾選區，先列人工確認，不猜測選區。
- 個人頁可取得姓名、職位、選區、照片、社群連結，以及官網有填寫的學歷、經歷與個人政見。
- `build-tpp-2026-candidate-snapshot.mjs` 將瀏覽器快照轉成既有政黨候選人契約；
  不支援的低層級職位不會進入本階段候選關係。
- 不自動操作或繞過 Cloudflare challenge；驗證再次出現時停止，由使用者自行處理。

### Phase 5：審核後寫入本機（流程完成，尚待逐筆審核）
- 彰化縣第 10 選區與新竹市第 7 選區均為 2026 新增的山地原住民議員選區，
  已依地方選舉委員會會議紀錄補入 planned races。
- 64 筆均成功匹配選區並寫入本機待審核層：18 筆高信心、17 筆可能配對、
  2 筆人工辨識、27 筆新人物；保存 39 筆學歷、36 筆經歷、37 筆政見及 44 筆社群資料，
  2026-07-29 已套用 18 筆 A 級身分配對並建立私有 `party_nominee` 候選關係，
  其餘 46 筆維持待審核，公開候選仍為 0。

- 審核檔可逐筆選擇 `use_existing`、`create_new` 或 `reject`。
- `use_existing` 只能選同名 canonical 候選；`create_new` 才建立私有人物。
- 通過的資料寫入私有 candidate，狀態為 `party_nominee`，並由 trigger 保存狀態歷程。
- 來源聲明維持 `review_only`，不會因完成身分審核而自動公開。
- 驗證人物頁、選舉頁、選區頁與搜尋。
- 確認沒有同名錯接及重複 candidacy 後，才另行決定正式發布。

### Phase 6：台灣前進四黨聯合網站（本機完成）

- 官方候選人總覽：`https://taiwangogo.tw/candidates/`，網站由時代力量管理，
  涵蓋時代力量、台灣基進、小民參政歐巴桑聯盟、台灣綠黨及部分無黨籍參選人。
- `build-taiwan-forward-2026-candidate-snapshots.mjs` 低頻讀取公開總覽與個人頁，
  使用個人頁 JSON-LD 的正式第幾選區，不依行政區名稱自行猜測選區。
- 2026-07-29 保存 35 筆來源擷取於
  `data-sources/taiwan-forward/2026-election/capture-2026-07-29.json`；四黨正規化快照保存在同一目錄。
- 現有市長／縣市議員契約可接受 26 筆：時代力量 11、台灣基進 5、
  小民參政歐巴桑聯盟 7、台灣綠黨 3；每筆均保存官網提供的學歷、經歷、政見及社群連結。
- 另外 3 筆 `data-party="台灣前進"` 的無黨籍參選人未歸入任一政黨；
  6 筆市民／鎮民／鄉民代表先保留於來源擷取，不擴張本階段候選人契約。
- 26 筆均唯一匹配 2026 選區並寫入本機待審核層：9 筆高信心、6 筆可能配對、
  11 筆新人物；共建立 15 筆非確認性的身分建議。2026-07-29 已套用 9 筆 A 級
  身分配對（時代力量 4、台灣基進 2、小民參政歐巴桑聯盟 3），其餘 17 筆維持待審核，
  公開候選仍為 0。
- `taiwangogo.tw` 只對上述四黨列入允許的官方聯合來源網域；其他政黨仍會被 validator 拒絕。

執行方式：

```bash
node scripts/build-taiwan-forward-2026-candidate-snapshots.mjs \
  --output-dir /tmp/taiwan-forward-2026 \
  --capture-output /tmp/taiwan-forward-2026-capture.json
```

### Phase 7：親民黨 2026 選舉專區（本機完成）

- 集中候選人頁：`https://youth.pfpnext.com/2026/`，目前列出 7 位縣市議員參選人。
- 前 5 位可由親民黨中央黨部 2026-05-26 首波提名公告確認；蕭夙玲另有
  2026-07-09 中央黨部徵召公告。黃朝淵目前未找到中央站獨立公告，
  但已列在親民黨青年團正式候選人頁，依本文件既定規則仍標為 `party_nominee`。
- `build-pfp-2026-candidate-snapshot.mjs` 只解析頁面內的候選人 JSON，
  不執行遠端 JavaScript；保存姓名、選區、照片、主要經歷、核心政見與公開社群連結。
- 原頁面另含服務處電話、地址及政治獻金銀行帳號，這些欄位不進正規化快照，
  也不保存原始 HTML；只保存已移除上述資料的
  `data-sources/pfp/2026-election/normalized-candidates-2026-07-29.json`。
- 7 筆均唯一匹配 2026 選區並寫入本機待審核層：2 筆高信心、2 筆可能配對、
  1 筆需人工辨識、2 筆新人物；建立 4 筆非確認性身分建議，正式 candidate 仍為 0。
- 黃朝淵原有多個同名 canonical 候選；2026-07-29 經人工確認為同一人後，已合併至
  2022 中選會人物，並建立私有 `party_nominee` 候選關係。2020 親民黨、2022 無黨籍
  與 2026 親民黨的歷屆黨籍各自保留。
- 集中頁沒有將學歷獨立成欄位；本階段不從主要經歷文字推測學歷，7 筆均保留官網經歷與政見。
- 2026-07-29 已依「同名、同黨、同選區且 canonical 人物唯一」套用楊秀玉、陳傑麟
  兩筆 A 級既有人物配對；建立的候選關係均為私有 `party_nominee`，未新增人物、未公開資料。
- 目前親民黨 7 筆已有 5 筆完成身分確認；劉成謙、蕭夙玲 2 筆新人物仍維持本機待審核。
  B 級、同名衝突及新人物均不自動決定。
- 本機身分審核工作台確認政黨候選來源後，會建立私有候選關係並將聲明維持
  `review_only`，不會沿用一般人物補充資料的直接公開行為。

執行方式：

```bash
node scripts/build-pfp-2026-candidate-snapshot.mjs \
  --output /tmp/pfp-2026-candidates.json
```

### Phase 8：全政黨 A 級身分配對（本機完成）

- `apply-high-confidence-party-candidate-matches.mjs` 只接受已 stage 且同時具備精確姓名、
  同黨、同選區及唯一 canonical 人物的 `high_confidence_match`；預設為 dry-run，
  `--write` 僅允許 localhost Supabase。
- 預設只接受 A 級；需明確加上 `--include-probable-context` 才會納入具有黨籍或選區脈絡的 B 級。
  同名衝突、只有姓名符合或新人物一律不自動套用，也不建立新人物或公開任何關聯。
- 2026-07-29 共確認 184 / 318 筆：民主進步黨 148、中國國民黨 7、台灣民眾黨 18、
  時代力量 4、台灣基進 2、小民參政歐巴桑聯盟 3、親民黨 2；台灣綠黨 0。
- 依人工決定，另套用 27 筆 canonical 人物唯一且具有部分脈絡的 B 級配對：
  姓名加黨籍 17 筆、姓名加選區 10 筆；只有姓名符合的 B 級不自動套用。
- 2026-07-29 另由人工確認林碩彥 2018 無黨籍市民代表、2020 民眾黨立委候選人、
  2022 民眾黨縣議員及 2026 民眾黨候選人為同一人；歷史候選紀錄仍保留各屆當時黨籍。
- 2026-07-29 經人工確認黃朝淵各屆紀錄均為同一人；另確認謝龍介 2012、2016、2018、
  2022、2024 及 2026 各筆紀錄均為同一人，統一至立法院第 11 屆人物，歷史參選資料不改寫。
- 2026-07-29 另完成 11 筆高信心人工查核：王美惠、賴瑞隆、鄭朝方、陳瑩、簡嘉佑、
  布落．馬信、蘇錦雄 Paylang．Caya、黃肇輝、陳振中、陳玉珍及陳永祥。跨年份重複人物
  以 7 組、9 筆 verified merge decision 歸入 canonical person；不同地區或生日的同名者未合併。
- 目前本機共確認 231 / 318 筆：民主進步黨 167、中國國民黨 12、台灣民眾黨 34、
  時代力量 7、台灣基進 2、小民參政歐巴桑聯盟 4、親民黨 5；台灣綠黨 0。
- 其餘 87 筆保留本機審核工作台：B 級 7、需辨識同名人物 2、新人物 78；其中林家豪與
  陳怡潔仍保留人工辨識，不依姓名直接決定。
- 本機驗證共有 231 筆私有 `party_nominee` 候選關係及 231 筆 `review_only` 聲明；
  公開候選與公開聲明均為 0。

```bash
node scripts/apply-high-confidence-party-candidate-matches.mjs
node scripts/apply-high-confidence-party-candidate-matches.mjs --write
node scripts/apply-high-confidence-party-candidate-matches.mjs --include-probable-context
node scripts/apply-high-confidence-party-candidate-matches.mjs --include-probable-context --write
```

## 本機執行

```bash
node scripts/import-party-candidate-snapshot.mjs \
  --input /tmp/party-candidates.json \
  --stage
```

逐筆完成 `docs/party-candidate-review.example.json` 格式的審核檔後：

```bash
node scripts/import-party-candidate-snapshot.mjs \
  --input /tmp/party-candidates.json \
  --apply-reviewed /tmp/party-candidate-review.json
```

## 暫不執行

- 不從搜尋引擎摘要直接匯入或發布。
- 不用媒體整理取代政黨官方提名來源。
- 不繞過 CAPTCHA、Cloudflare 或其他安全驗證。
- 不在候選人完成中選會登記前標為 `registered` 或 `qualified`。
- 不在本階段自動發布到正式 Supabase。
