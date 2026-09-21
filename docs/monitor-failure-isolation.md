# 蒐集來源失敗隔離與部分審核

每日／每週蒐集與排程審核使用本文件；執行時間以目前有效的排程設定為準。所有環境守門、私人待審、人工核准與額度限制保持不變。

## 排程環境與批次交接

兩個排程使用同一持久專案 `/home/xiaosha/projects/public-office-watch`；以下路徑均以此為根。只用正式排程管理工具修正實際專案、cwd、目標任務及可寫範圍，不能只加 cd、改提示詞路徑或改 App 資料庫。沒有管理能力就列出待操作欄位，不新增重複排程或恢復舊 PAUSED 排程。

| 用途 | 既有持久路徑 |
| --- | --- |
| 蒐集封存＝審核輸入 | `tmp/monitor-history/<daily或weekly>/<runId>/`，含 summary、manifest、artifacts、logs |
| 審核結果 | `tmp/monitor-review/runs/<runId>.json`；續審用 `tmp/monitor-review/run-attempts/<runId>/<reviewId>.json`，追加 `tmp/monitor-review/runs.jsonl` |
| 共同進度／追蹤 | `tmp/codex-scheduled-review-state.json`、`tmp/monitor-followups.json`；保留原欄位與歷史 |
| 人物輪替／補證 | `tmp/daily-person-enrichment-state.json`；審核沿用 `tmp/monitor-review/followup-reviews/`、`tmp/monitor-review/evidence/` 及 state.followupReview |

- 各次執行核對當次實際資料目標及待處理批次；環境／設定未變時不重做 Docker、掛載、群組或模型全面盤點。首次使用、新工作階段、相關設定變更或異常時，才補驗必要部分。資料目標沿用 [本機驗證](local-supabase-validation.md) 及既有查詢，確認程式最終解析的 loopback endpoint／目標身分與憑證用途；不從 env 檔名、cwd 或 Docker 健康推定。
- Docker 只在確實需要容器身分證據、操作容器或診斷容器異常時檢查。已確認的來源 HTTP 下載、封存讀寫不額外依賴 Docker；資料目標無法確認時仍停止相依操作，不刪掉必要驗證。只有配置／憑證需要核對時才使用 CLI status，在程序內比對，不輸出完整結果：新版 `sb_publishable_`／`sb_secret_` 分別對應 `PUBLISHABLE_KEY`／`SECRET_KEY`，legacy JWT 的 anon／service role 分別對應 `ANON_KEY`／`SERVICE_ROLE_KEY`。缺欄位、用途錯誤或同格式值不同仍停止，不更換憑證來湊通過。
- 已有本機 API 證據可沿用；需要重驗時，public key 讀 `published.people_directory`，server key 讀 `public.person_claim_review_queue` 的 `claim_id`。權限修改或存取異常才再驗匿名拒絕。不要用未開放的 `published.people` 或不存在的佇列 `id` 欄位判定服務故障；前端 guard 不等於資料目標已驗證。
- 互動對話保留「代我核准」，必要越界命令走系統正式核准。兩個排程各自必須事先具備搜尋／下載及必要本機資料存取能力，不依賴途中核准，也不靠 Full access 解決錯誤路徑。EROFS、socket 拒絕、網路封鎖記為 local_tool，停止相依步驟；不 chmod、remount、改群組、重建服務或換入口繞過。
- 排程語意審核不等於 `review:person-claims:write` 自動核准。只有工作確實需要 RPC 時才依 [審核流程](review-workflow.md#自動審核的資料庫前置與恢復) 查安裝狀態；不為啟動排程安裝 SQL，保留 installer 的容器／workdir 守門。

改綁／權限修正後才做一次隔離批次驗收：從蒐集排程實際入口完成最小批次的原蒐集與封存，再由審核排程實際入口讀同一 runId、manifest 與 hashes，完成下述資格／語意審核、去重分流、必要補證及結果／狀態保存。驗收的所有暫存輸出與狀態副本均隔離，不能讓只改 output-dir 的子程序覆寫正常 canonical 檔或輪替狀態；不減少所選批次原本必需的審核工作，不寫正式或發布。無法隔離或缺少實際排程入口就停止驗收，分別標記蒐集、審核、交接尚未驗證。本段不是每次開發／排程的例行前置，舊批次仍不可變。

## 蒐集

- 每日四個獨立主步驟依序執行；來源失敗不阻止其他獨立步驟。人物研究內部有相依性的準備、搜尋、Wikidata、輪替記錄仍維持原本順序與失敗門檻。
- 環境衝突、併行寫入、程序仍在執行及無法保存證據仍是整批停止條件。每日與每週分別使用 `tmp/monitor-locks/daily.lock`、`tmp/monitor-locks/weekly.lock`，同一週期已有存活程序時拒絕重疊執行；回收失效主鎖前先取得獨立的原子回收鎖並重新驗證，避免刪除其他程序剛建立的新鎖。回收程序中斷留下的 `.reclaim` 標記採保守停止，須確認沒有存活程序後再人工清理。
- `tmp/daily-monitor/summary.json` 保存機器產生的主步驟結果；`tmp/daily-monitor/logs/` 保存逐步 log。每週沿用 `tmp/weekly-monitor/summary.json` 與 logs。
- 不把降級改成成功：每日與每週有失敗／降級仍以非零狀態結束；每週會從進度文字後方解析最後一段結構化 JSON，因此子步驟即使以 0 結束，回報 degraded／needs_attention 仍會被列入注意；每週 passedCount 不包含 degradedCount。
- 每個 run 封存時，將主命令 summary、逐步 logs 及其 SHA-256 一起保存。manifest 每項標記 `producerStep`、`commandStep`；兩者分別對應 run summary 的步驟名稱與命令 log 中的原始步驟名稱，不能自行宣稱成功。已存在的歷史 manifest 不回寫。
- 補充司法／到期追蹤查詢有獨立 producer、開始／完成時間、log 與結果，不能冒用主命令的成功狀態。最後才計算 manifest 與 summary 的 artifactCount；主命令當時的數量另外保留為 commandArtifactCount。不得為湊數修改原始 log 或混入上次產物。

## 來源重試

立法院現任名冊的安全 HTTPS 查詢使用 `scripts/monitor-source-retry.mjs`。每個來源各自把狀態原子寫入 `tmp/monitor-source-health/<source-key>.json`，避免同時更新不同來源時互相覆蓋；既有 `tmp/monitor-source-health.json` 只在個別來源檔尚未建立時讀取，以保留原有 cooldown。每日／每週共同遵守：

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
- 寫回前再驗輸入雜湊。公開與核准仍由人工決定；本文件不新增補搜、資料合併或正式寫入授權。有效排程已明確授權的定向補證仍須完成其原有身分／來源核對、每次審核45分鐘、每日最多10個key／30分鐘及證據與state保存，不因精簡環境檢查而取消；無此授權不自行補搜。
