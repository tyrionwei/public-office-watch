# 上訴駁回與已核對原審主文

本擴充沿用逐人主文原則：不從事實、理由、新聞敘述或被告主張擷取刑責。
本次裁判處置、該次維持之原審結果／刑度、目前是否定讞，是三種分開保存的資訊。

## 保持原有資料

version 1 仍支援直接核對的逐人主文。其純「上訴駁回」現在可顯示裁判處置，但仍不自行推論有罪。
沒有逐人主文的舊紀錄保留原文；不再畫出空白罪名／刑度與未知結果四欄，不以「本站尚未整理」冒充裁判結論。
既有明確無罪階段仍依原規則保存。原文與來源不刪除，裁判日期重複只在呈現層避開。

## version 2：限逐人全部上訴駁回

`judgmentDisposition` 的共同必填欄位不變。version 2 額外要求：

- 根 `result` 必須是 `unknown`，因為根的主文原句並未重述定罪。不能把兩份主文拼成一句。
- `caseNumber`、`judgmentDate` 與 claim 的日期一致。
- `text` 是本次主文相關原句，允許共同駁回句；`personScopeQuote` 是其中指向該人的原句片段。
  共同句只供顯示處置及來源，絕不用來提取其他人的刑期。
- `upheldJudgment` 要有 reviewed、相同 canonical personId、`relation=appeal_dismissed`、
  `scope=entire_person_disposition`、相同 `currentCaseNumber/currentSourceUrl/currentDispositionText/personScopeQuote`。
- `evidenceSourceUrl` 指向本次判決，`evidenceText` 保存判決開頭識別原審的原句，並包含 `priorCaseNumber`。
- `prior` 是另一份 version 1 reviewed 逐人主文，personId 相同；保留獨立 `sourceUrl/caseNumber/judgmentDate/text/result`。
  `sourceKind` 為 `court_judgment` 或 `court_published_main_text`；法院新聞稿中的主文節錄必須標成後者，不冒充全文。

資料契約實例見 `tests/legalAppealPresentation.test.ts` 的合成案例，不含真實人物。
每個 reviewStatus 都由既有審核流程給定；不是前端核准、安全權限或自動資料蒐集。
程式核對格式與一致性，不能代替人員確認引用真的屬於該人、該次裁判與該範圍。

## 範圍與顯示

支持已核對的逐人全部駁回，不支持僅刑度／沒收部分上訴、部分撤銷、更審、發回或多層連鎖沿用。
不支援者保持本次已核對處置及原文，不沿用原判罪名／刑度。不得把 scope 改成 entire 來繞過。

完整關聯通過才從原審主文擷取罪名／刑度，並在卡片顯示原審來源、日期、案號及原句。
本次二審原句仍獨立保留。classification 只沿用既有 caseStage，不從駁回、日期或期間推導定讞。
既有無罪階段與沿用有罪結果衝突時，停用結果及刑度並交回審核。

## 單筆回填與驗證

回填與程式套用分開。真實個案提案留在 private/local-data，不隨共用程式 patch 發布。
先用指定原始來源與日期查到確切 claim ID，再查公開 canonical person ID；不能按姓名更新。
資料原值、完整 claim_json、原始 person_id、來源及 updated_at 應備份並比對版本。
只合併 judgmentDisposition，不覆寫其他欄位，不變更現有 caseStage、review_status、is_public 或 visibility。
回復只還原這筆原 claim_json，不刪除資料表或回滾其他使用者資料。正式發布使用原流程。

```sh
node --experimental-strip-types --test apps/web/tests/legalRecordPresentation.test.ts apps/web/tests/legalAppealPresentation.test.ts
```

新增測試由既有 test:read-contracts 的 tests/*.test.ts 自動納入。
仍需完整建置／lint、人物頁兩種版型、鍵盤及滑鼠展開、資料來源連結驗證；本文件不表示這些已執行。

## 2026-09-22 本機回填摘要

以下只記錄不含私人原文的批次結果；逐筆證據、前後快照、回復 SQL 與缺件仍保留在忽略追蹤的
private/local-data。兩批合計涵蓋 47 筆不重複舊案，實際在 full local 合併
`judgmentDisposition` 41 筆；其中 29 筆完成、12 筆僅按已核範圍部分整理，最後 6 筆未寫入。

- 首批選取 10 筆：更新 9 筆（完成 7、部分整理 2），受阻 1 筆。
- 其餘批次選取 38 筆，其中 1 筆是首批受阻案的續查：更新 32 筆（完成 22、部分整理 10），受阻 6 筆。
- 缺件集中在封存資料未含逐人主文／附表、上訴或撤銷範圍不足，以及來源其實不是對應罪刑裁判；
  均未由敘述、前科或其他被告結果反推。
- 指定的 2026-09-03 上訴案在原批次先通過 published RPC payload 與卡片呈現契約；後續另以
  full-local 真實人物頁做唯讀 DOM 驗收：本次顯示「駁回上訴」，
  原審顯示對主管事務圖利罪、有期徒刑 3 年 6 月及褫奪公權 3 年，兩份來源連結皆可見。
- 另有一個不依賴真實人物資料的 version 2 人物頁瀏覽器案例，驗證本次處置、原審罪名／刑度、
  原審來源與展開後的本次來源；避免把純函式測試當成卡片整合證據。

上述回填沒有更改既有 review status、公開旗標、程序狀態或其他 claim 欄位；本批發布數為 0，
正式與 rehearsal 寫入均為 0。此摘要不表示受阻或部分整理案件已完成，也不擴張目前僅支援
單層、逐人全部上訴駁回的範圍。
