# 蒐集來源失敗隔離與部分審核

每日／每週蒐集與每日 21:30 審核使用本文件。所有環境守門、私人待審、人工核准與額度限制保持不變。

## 蒐集

- 每日四個獨立主步驟依序執行；來源失敗不阻止其他獨立步驟。人物研究內部有相依性的準備、搜尋、Wikidata、輪替記錄仍維持原本順序與失敗門檻。
- 環境衝突、併行寫入、程序仍在執行及無法保存證據仍是整批停止條件。
- `tmp/daily-monitor/summary.json` 保存機器產生的主步驟結果；`tmp/daily-monitor/logs/` 保存逐步 log。每週沿用 `tmp/weekly-monitor/summary.json` 與 logs。
- 不把降級改成成功：每日與每週有失敗／降級仍以非零狀態結束；每週 passedCount 不包含 degradedCount。
- 每個 run 封存時，將主命令 summary、逐步 logs 及其 SHA-256 一起保存。manifest 每項標記 `producerStep`、`commandStep`；兩者分別對應 run summary 的步驟名稱與命令 log 中的原始步驟名稱，不能自行宣稱成功。已存在的歷史 manifest 不回寫。
- 補充司法／到期追蹤查詢有獨立 producer、開始／完成時間、log 與結果，不能冒用主命令的成功狀態。最後才計算 manifest 與 summary 的 artifactCount；主命令當時的數量另外保留為 commandArtifactCount。不得為湊數修改原始 log 或混入上次產物。

## 來源重試

立法院現任名冊的安全 HTTPS 查詢使用 `scripts/monitor-source-retry.mjs`，狀態保存在 `tmp/monitor-source-health.json`，每日／每週共同遵守：

- 暫時錯誤最多額外重試一次，至少間隔 5 秒並遵守 Retry-After；等待超過 30 秒則不占住程序，保留下一次可查時間。持續暫時失敗最早 30 分鐘後才可再次查，沒有新增高頻排程。
- TLS 相容性、404/410、403/CAPTCHA 等持續問題只嘗試一次，記錄分類與原網址，七天後才重新探測；期間依然回報來源不可用，不當成成功。網址改動須另行核實官方出處，不猜網址。
- 未知／本機工具錯誤記錄具體原因。瀏覽器啟動失敗不能被描述為官方網站故障；本次同工具失敗後停止該分支，保留其他來源的結果。
- 不關閉憑證驗證、不允許 unsafe legacy renegotiation、不改 HTTP、不繞過 CAPTCHA。
- 名冊 fallback 的新鮮度仍為 unknown，不當成新取得的現任名冊。來源重試與人物輪替、待補證期限分開；不因失敗次數而駁回人物或刪除線索。
- Wikidata 沿用既有有上限的逐人重試，不因單一人物 maxlag 重跑所有人。

## 審核

先執行唯讀資格檢查：

```sh
node scripts/plan-monitor-review.mjs tmp/monitor-history/daily/<runId>
```

這只輸出可以進一步審核的產物，不去重、不認定內容正確、不寫資料庫、不公開、不更新已審狀態。

1. runId、完成時間、manifest 與 summary 最終數量、log 雜湊、環境證據必須一致；整批證據不可信時全部停止。
2. 逐個檢查產物 SHA-256、size、JSON、mtime、producer 成功狀態與 log 是否一致。daily 產物超過七天、weekly 超過十四天，列待重新確認新鮮度，不能直接套用現況。
3. 一個來源 failed/partial/degraded 不阻擋其他有獨立成功證據的產物。只對 eligibleArtifacts 繼續原本去重、身分、信心、現有資料比對及四路分流；metadata、state、targets 檔不算新線索。
4. blockedArtifacts 不准直接入庫。若是單一檔含成功與失敗列，必須從逐項 log 重建成功列的來源證據與相依關係，另存不可變判斷紀錄後才可審成功列，不能只改 status。未知 producer 或缺少機器 log 的舊格式保持待查，不猜成功。
5. command 階段數量與最終數量不同，本身只是分階段產物的警告；新增產物仍須獨立 provenance。最終 manifest/summary 真正不一致則停止，不覆寫原始檔來消除警告。

## 續審及防重複

- 每次最多兩批、由舊到新；納入已 blocked／部分審核而仍有未審有效產物的 run，不只看有沒有 `<runId>.json`。
- 首次審核沿用 `tmp/monitor-review/runs/<runId>.json`。如果已存在，另存 `tmp/monitor-review/run-attempts/<runId>/<唯一reviewId>.json`，保留原始失敗紀錄，不覆蓋、不把舊 run 改成新批。
- 以 `runId + artifact SHA-256 + 事件／主張穩定 key` 記錄逐項進度。state 新增 `artifactReviews`，每項保存 runId、path、sha256、reviewId、status、reviewedAt；只有實際完成語意審核的 artifact 才記 reviewed。既有欄位與歷史全部保留。
- runs.jsonl 的後續列記錄 attemptId、同一 runId、incremental=true 與本次實際新增處理數。累計不重加先前已處理事件；沒有新證據的 blocked artifact 不反覆重審。
- 部分成功只能記 partial_reviewed；仍有未審或 blocked 產物時，不能把整批新增到 reviewedRuns 或宣稱 reviewCompleted。失敗來源單獨追蹤 nextCheckAt；非空 blockedRuns 不應阻擋新批的有效產物。
- 寫回前再驗輸入雜湊。公開與核准仍由人工決定；本文件不授權補搜、資料合併或正式寫入。
