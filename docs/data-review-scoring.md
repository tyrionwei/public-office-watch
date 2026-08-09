# 資料可信度與自動過審評分標準

這份規則用來大量處理人物資料、歷史選舉資料、司法/刑事紀錄線索與政治關係資料。原則是高可信資料自動通過，敏感或爭議資料保留人工複查。

## 分數等級

- 90-100：可自動過審。官方結構化來源、人物身份已確認、欄位低歧義。
- 75-89：高可信待抽查。可列為 `probable_match` 或待確認 claim。
- 50-74：需要人工確認。常見於媒體、百科、候選人官網或同名風險資料。
- 0-49：不公開。缺少來源、同名風險高、內容敏感但佐證不足。

## 來源等級

- A：官方結構化資料，例如中選會、立法院、監察院、司法院資料開放平台。
- B：官方網站、本人/政黨/政府機關公開頁。
- C：可信媒體、選舉指南、Wikipedia/Wikidata。
- D：未完成比對、來源不足、社群或轉載線索。

## 人物身份合併

- A 級自動合併：共享已審核的穩定外部 ID，優先為官方人物 ID；已人工確認的 Wikidata QID 可作為輔助穩定 ID。
- B 級候選：標準化姓名相同、已知性別相同、已驗證生日相同，但尚未共享穩定外部 ID。
- 政黨、角色、選區、職位只能作為審核脈絡，不可把同名資料提升成自動合併。
- 不同性別或不同生日應阻擋自動合併。
- 自動通過只代表「同一人物」的資料合併，不代表所有敏感 claim 已可公開。

## 一般欄位 claim

- 官方來源 + 已連到正式人物 + 低歧義欄位，預設可達 90 分以上。
- 低歧義欄位包含姓名、性別、黨籍、職位、選區、外部 ID。
- 學歷、經歷、政見、照片等欄位若來自官方或本人來源可提高分數；來自媒體/百科則需保留來源與分數。

## 非犯罪紀錄自動審核

`scripts/auto-review-person-claims.mjs` 預設處理 review queue claim，可用 `--source-name` 收斂來源。

- 非 Wikidata 來源：除敏感 claim 以外，依既有分數門檻自動公開；預設 `review_score >= 0`，可用 `--min-score` 提高門檻。
- 不自動公開：司法/刑事紀錄 `legal_case`、家族關係 `family_relation`。
- Wikidata claim 若尚未通過 external ID，需 `claim_json.identityMatch.status = matched` 才能進入審核候選；舊版缺少 identityMatch 的資料需維持 review-only。
- Wikidata 的低敏感欄位若同一 `person_id` 已有 verified/public 的 `external_id = wikidata:Qxxx`，且 claim 的 `claim_json.wikidataQid` 相同，即可自動通過；這條規則可處理舊版缺少 `identityMatch` 但 QID 已由人工確認的 claim。
- Wikidata 可由 verified external ID 解鎖的欄位：`gender`、`birth_date`、`education`、`experience`、`position`、`office`、`district`、`party`。
- Wikidata 的 `external_id` 本身應先由 review 頁或其他明確流程確認，不靠這條 batch 規則自動通過。
- Wikidata 的「政治人物描述」只作類型過濾，不可單獨當成身份佐證；身份佐證需來自職位、地區、學歷、經歷或其他可對齊欄位。
- 未能完成身份比對或發生單筆查詢錯誤的人物會寫入 `data-sources/person-enrichment-skipped.json`，後續用 retry 批次重跑，不讓大量補資料流程卡在單一人物。
- 寫入時會標記 `review_status = verified`、`visibility = public`、`is_public = true`、`auto_reviewed_at`。
- 批次腳本會檢查 Wikidata 的 `legal_case` 仍不得進入 `public_person_claims`。

## 司法與刑事紀錄 claim

司法/刑事紀錄屬高敏感資料，不能只靠姓名或單篇新聞自動定論。詳細搜尋步驟見 `docs/legal-record-ingestion.md`。

可用官方來源：

- 司法院裁判書查詢系統：https://judgment.judicial.gov.tw/FJUD/default.aspx
- 司法院資料開放平台：https://opendata.judicial.gov.tw/dataset

評分分成兩軸：

- `identityScore`：裁判當事人是不是本站人物。
- `caseEvidenceScore`：罪名、案號、階段、結果與定讞狀態是否有官方證據。
- `overallScore` 取兩者較低分，不能以平均分掩蓋其中一軸證據不足。

自動過審最低條件：

- 僅限刑事程序，且本站人物本人是被告；助理、親屬、樁腳或公司人員涉案不得掛到人物本人。
- 來源包含可用連結的司法院裁判書或其他官方司法資料。
- `identityScore >= 90` 且 `caseEvidenceScore >= 90`。
- 已確認案號、裁判日期、罪名、案件階段與結果。
- 已追查後續上訴，最新結果確認定讞。
- 沒有生日、性別、地區、案件角色或時間矛盾。
- 只是同名出現在裁判書、新聞、論壇或社群，一律不得自動通過。

自動過審只會把內部 lead 標成 `verified`，仍維持 `is_public = false`。公開必須另行確認呈現內容及來源，不得由分數直接觸發。

必須人工確認：

- 非定讞、後續上訴未查完或最新狀態不明。
- 只有新聞，沒有官方司法來源。
- 同名一對多或識別線索不足。
- 有撤銷、改判、無罪、不起訴或新聞與裁判不一致。
- 裁判書早於所記事件年份且沒有合理說明。

媒體資料可以協助確認人物及定位案件，但媒體來源本身不能讓 `caseEvidenceScore` 達到自動過審門檻。論壇、網友留言或不明轉載只保留為低可信線索。

## 目前實作狀態

- 歷史選舉人物身份已支援自動過審門檻。
- `person_claims` 已有 `review_score`、`scoring_version`、`scoring_reasons`、`auto_reviewed_at`。
- `person_claim_review_queue` 與 `identity_probable_match_queue` 可用來抽查低分或爭議資料。
- `legal_record_leads` 與 `legal_record_review_queue` 已建立，用於存放 private review-only 司法/刑事線索。
- 司法/刑事線索目前不會自動公開，也不會自動產生 public `legal_case` claim。
- 真正公開前必須由 review queue 確認同一人、來源連結、案由/摘要與判決狀態。
- 內部審核頁 `/internal/review-queue` 僅在 local development 註冊；production 目前不顯示，正式管理介面需再接帳號權限。
