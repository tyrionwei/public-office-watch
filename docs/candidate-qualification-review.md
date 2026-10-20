# 候選登記與資格審查

官方審定不符資格時，顯示「已登記，審查後資格不符」。保留原始登記來源、人物歷屆紀錄及審定日期／官方來源，不以刪除紀錄或「落選」取代資格結果。

- 已連結人物的候選：`registration_status=disqualified`、`candidacy_status=withdrawn_or_disqualified`、`election_result=unknown`；票數、票率、當選布林值均為 `NULL`。保持原先公開邊界，不新增人物或推定同名身分。
- 姓名名錄：保留 `registration_name_roster` 原列與來源，更新 `registration_status`；以 `candidate_lifecycle_events.registration_name_id` 保存審定事件，不因審定而建立人物頁。
- 撤回使用 `withdrawn` 的獨立文案。有效名單、選舉統計及分享選區名單排除撤回／資格不符；人物歷屆查詢仍保留。
- 公開事件只輸出既有白名單欄位。官方公告中的司法、戶籍等理由不自動轉為人物公開主張，私人 `event_data` 不公開。

## 套用與驗證

沿用 [環境與發布流程](deployment-environments.md)。先核對官方姓名、年份、職位及選區，再用既有候選／名錄的 external ID 對應；本機 UUID 不可直接重播正式。資料批次須保存原列、來源雜湊及漂移守門，同步 `candidates` 與 `published.candidate_facts`，並保留原登記來源，另新增審定事件。

狀態更新後要依既有發布流程刷新 `public.public_people_list_cached` 及 `published.people_directory_snapshot`，確認人物不再帶過期的本屆候選標籤，但現任職務不受影響。不要刪除人物的其他年度紀錄、將空票數填為零，或為測試恢復已退役 RPC 的匿名權限。

小型本機回歸使用 [candidate-qualification-regression.sql](../scripts/sql/candidate-qualification-regression.sql)，需載入本次 schema；該測試以交易回滾合成資料。未持久套用 schema 時，可在同一交易載入 migration（省略其最後的 `COMMIT`）再執行 fixture。必須實測匿名 `race_page_for`、`home_page_for`、`registration_names_for`、`person_profiles_for`、`candidate_lifecycle_for` 及統計，不把 owner 查詢或靜態測試當匿名驗收。

發布包若包含審定前的登記名錄，必須與最新審定結果整合後再發布。舊包可保留為基線，但不得單獨重播，否則可能重新刊出已不符資格的人。
