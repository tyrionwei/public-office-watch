# 候選人財產申報文件索引

本輪範圍為 2026 年 22 縣市首長及議員候選人的官方文件連結。沿用 `candidate_lifecycle_events`，以 `asset_declaration_published` 保存公開文件事件；沒有新增財產金額、家屬明細或人物身分推定。

## 蒐集及配對

`scripts/collect-cec-asset-declaration-index.mjs --output <新的本機批次目錄> --scope all` 只讀中選會公告網站的四類索引，封存每頁 HTML 與 SHA256。既有輸出目錄會拒絕覆寫。`chiefs` 可限定縣市首長；不讀鄉鎮市長、代表或村里長分類。

配對須同時核對年份、縣市、職務、選區及已審核的登記姓名／候選人對應。字形差異、中文簡稱或同名不足以自行合併人物；未確認者留在本機待審。同一人有多份官方文件時保留全部，編號不代表申報次序或取代關係。

`occurred_on` 只有原件明載申報日期且完成核對時才可填入；索引階段保持空值。`source_published_on` 是官方公告日期。`source_hash` 為封存索引的雜湊時，必須在私人 `event_data.hashTarget` 保存索引 URL，不冒充 PDF 內容雜湊。金額保持未核對。

## 公開邊界

- 文件 URL 限中選會 `pdps-dec.cec.gov.tw/release/formal/files/<數字>.pdf`。
- `published.candidate_asset_documents_for(uuid[])` 每次最多 128 個候選／姓名名錄 ID，只輸出主體 ID、文件 ID、來源名稱、URL 與公告日期。文件結果上限 512，SQL 多回一列作為溢位哨兵，前端超限顯示失敗，不靜默截斷。
- 只公開 2026 年已公開、登記或審定合格且未撤回／不符資格的主體。姓名名錄被已公開人物候選接替後不再另行輸出。
- 私人事件、`event_data`、金額與內部審核內容不經此 RPC 公開；不新增私人表的匿名權限。
- 人物時間線保留資格不符的歷史事件，但財產文件仍遵循上述有效資格邊界。選區頁只在本輪四種職務呼叫文件 RPC，載入失敗明確顯示提示。

## 驗證及發布

先完成 `preserve_rejected_registration_history` schema，再載入 `add_candidate_asset_document_links`。在已確認的本機測試環境，將兩 migration 及 `scripts/sql/candidate-qualification-regression.sql`、`scripts/sql/candidate-asset-documents-regression.sql` 合成同一交易：省略各檔的交易控制，最外層使用 `BEGIN` 與 `ROLLBACK`。測試含匿名多文件、姓名名錄、私人內容、資格不符、撤回、空輸入、超量輸入、非官方 URL，以及已被人物候選取代的名錄。

資料包與來源保存在忽略追蹤的 `local-data/`。本機 UUID 只供本機驗證；發布時依 external ID 重新解析正式主體，核對選區及來源、資格更新與既有登記批次相依，不直接重播本機 UUID。正式發布依 [環境與發布流程](deployment-environments.md) 另行執行。索引數量完整不代表逐份 PDF 或金額已核對，也不代表已發布。
