# 正式發布紀錄（2026-08-12）

## 發布範圍

- 分支：`codex/global-chat-foundation`
- Supabase project ref：`vsstbjyshortwoawvvzc`
- 正式 migration ledger 起點：`202608010036`
- 本次最後一筆 migration：`202608110016`
- 發布前備份：`tmp/production-backups/2026-08-11-pre-deploy-7cd6146/`
- 備份的 schema、data、roles 與 SHA-256 已驗證；備份不得提交至 Git。

## Migration 分流

以下版本只適用完整本機研究／審核資料庫。正式精簡資料庫缺少其 staging 前置資料，不直接執行，需在 linked ledger 標記為已處理：

- `202608030001`–`202608030056`
- `202608090001`–`202608090007`
- `202608100006`
- `202608100013`
- `202608110001`
- `202608110002`
- `202608110008`

正式環境改由下列 production-safe snapshot／alignment migrations 承接最終已審核狀態：

- `202608110009`：封存正式端重複公開人物欄位。
- `202608110010`：封存正式端重複家族與政見 claims。
- `202608110011`：同步正式端選舉名稱與已確認人物例外。
- `202608110012`：發布 1994–2014 已當選正副總統與地方首長歷史。
- `202608110013`：發布 136 筆已審核刑事司法紀錄。
- `202608110014`：補齊正式公開身分與候選資料差異。
- `202608110015`：同步 196 組已審核人物 canonical 合併決策。
- `202608110016`：固定同品質候選紀錄的來源優先順序，避免資料庫執行順序造成結果漂移。

不得移動、改名或刪除既有 migration。只有在完整演練通過且 production-safe 替代 migration 已存在時，才可修復上述 ledger 版本。

## 乾淨演練結果

執行順序：正式備份還原 → source bootstrap → Phase 1 → 29 個正式 migration → Phase 2 → 公開集合比對。

- 狀態：`PASS`
- 套用 migration：29
- 還原基準：300,469,395 bytes
- Phase 1 後：314,723,475 bytes
- Migration 高峰：354,897,043 bytes
- 最終：334,130,323 bytes（約 318.7 MiB）
- 內部警戒線：367,001,600 bytes（350 MiB）
- 人物、候選人、候選事實、選舉、選區與搜尋文件：全部 `missing=0 / added=0`
- `published.release_state`：唯一且為 `current`

驗證程式現在同時拒絕「少資料」與「非預期多資料」，任何一項不為零都會中止演練。

## 正式執行順序

1. 再次驗證備份 checksum。
2. 產生並套用 production source bootstrap。
3. 套用 `scripts/production-compaction-phase-1.sql`。
4. 依本文件分流清單修復 linked migration ledger。
5. 執行 `supabase db push --dry-run`，確認只剩 29 筆 production-safe migrations。
6. 執行正式 `db push`。
7. 所有 migration 成功後，套用 `scripts/production-compaction-phase-2.sql`。
8. 核對容量、migration ledger、公開列數與 release state。
9. 部署 `update-admin` Edge Function 與網站。
10. 以 anon 權限測試首頁、搜尋、人物、選舉、縣市、政黨、聊天室與更新動態；確認內部資料仍不可讀。

任一步驟失敗時停止後續操作並保留現場，不猜測性補 SQL，也不把未執行的 production-safe migration 標成已套用。
