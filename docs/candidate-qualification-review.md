# 候選登記與資格審查

官方審定合格與不符資格都要保存審定日期及官方來源，並保留原始登記來源、人物歷屆紀錄及既有公開邊界。資格合格不代表當選；不符資格顯示「已登記，審查後資格不符」，不以刪除紀錄或「落選」取代資格結果。

- 審定合格的候選：將精確對應的 `candidates` 與 `published.candidate_facts` 同步為 `registration_status=qualified`、`candidacy_status=qualified`，保留原選舉結果、票數、票率、當選布林值、來源及現任職務；新增 `qualification_confirmed` 事件，不因審定而補零票或改成已當選。
- 審定不符資格的已連結人物候選：`registration_status=disqualified`、`candidacy_status=withdrawn_or_disqualified`、`election_result=unknown`；票數、票率、當選布林值均為 `NULL`。保持原先公開邊界，不新增人物或推定同名身分。
- 姓名名錄：保留 `registration_name_roster` 原列與來源，精確更新為 `qualified` 或 `disqualified`；以 `candidate_lifecycle_events.registration_name_id` 保存相應審定事件，不因審定而建立或連結人物頁。事件維持既有公開邊界，不能為讀取名錄事件開放內部表。
- 撤回使用 `withdrawn` 的獨立文案。有效名單、選舉統計及分享選區名單排除撤回／資格不符；人物歷屆查詢仍保留。
- 公開事件只輸出既有白名單欄位。官方公告中的司法、戶籍等理由不自動轉為人物公開主張，私人 `event_data` 不公開。

## 套用與驗證

2026年10月16日中選會[審定公告](https://web.cec.gov.tw/central/article/65213)與已封存的四份官方登記名冊總數吻合：81位首長（23位直轄市長、58位縣市長）逐名全合格；直轄市議員登記610人，605人合格、5人不合格；縣市議員登記892人，887人合格、5人不合格。對照必須限定在這1583筆完整官方登記 cohort，按縣市、職位、選區、姓名與來源核對，再精確扣除公告10筆不合格，才能得到公告合格1573人的範圍；不能對全站候選排除10人後一律標合格。

官方名冊與既有1495筆對照及臺南88筆補件的集合完整閉合。洪建興／洪健興1筆官方來源用字衝突保持待核；7筆完整姓名／中文簡稱沿既有逐筆證據對應，不據此合併人物。公告合格總數不等於本批實際套用數，實套數、排除項與待核項以該批已審映射及套用後讀回為準。

本批已審計畫的合格更新目標為1572筆：1348筆人物候選、224筆姓名名錄；按職位為81位縣市首長、1491位議員。洪建興／洪健興1筆維持待核，10筆不符資格維持原狀。此為發布目標，不代表已正式套用或發布。

沿用 [環境與發布流程](deployment-environments.md)。先核對官方姓名、年份、職位及選區，再用既有候選／名錄的 external ID 對應；本機 UUID 不可直接重播正式。資料批次須保存原列、來源雜湊及漂移守門，同步 `candidates` 與 `published.candidate_facts`，並保留原登記來源，另新增審定事件。

正式發布前，必須以同一版本的已審映射與SQL完成隔離套用、公開RPC讀回及依完整 after-image 守門的精確反向回復演練；資料、SQL或回復產物變更時，重新驗證受影響部分。COMMIT前須將此次 after-image 與精確回復SQL持久保存，不能以合成fixture或單次套用成功取代整批回復驗證。

狀態更新後要依既有發布流程刷新 `public.public_people_list_cached` 及實際存在的 `published.people_directory`，確認資格狀態與候選標籤一致，且現任職務不受影響。資格更新不改生日資料，不無故刷新生日／人口資料快取。不要刪除人物的其他年度紀錄、將空票數填為零，或為測試恢復已退役 RPC 的匿名權限。

小型回歸使用 [candidate-qualification-regression.sql](../scripts/sql/candidate-qualification-regression.sql)，僅在已確認的本機／隔離資料庫執行，需載入本次 schema；該測試以交易回滾合成資料，包含 `registered` → `qualified`、合格姓名名錄及審定事件，並核對回復原列與事件／狀態歷史。未持久套用 schema 時，可在同一交易載入 migration（省略其最後的 `COMMIT`）再執行 fixture。必須實測匿名 `race_page_for`、`home_page_for`、`registration_names_for`、`person_profiles_for`、`candidate_lifecycle_for` 及統計，讀回合格狀態與官方事件，且不符資格／撤回資料不能回流有效名單；不把 owner 查詢或靜態測試當匿名驗收。

發布包若包含審定前的登記名錄，必須與最新審定結果整合後再發布。舊包可保留為基線，但不得單獨重播，否則可能重新刊出已不符資格的人。
