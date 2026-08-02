# 正式 Supabase migration 差異盤點（2026-08-02）

## 範圍與安全邊界

- 分支：`codex/global-chat-foundation`。
- Linked project：`vsstbjyshortwoawvvzc`。
- 已完成 `migration list`、`db push --dry-run`、正式備份、本機完整還原與瘦身演練；尚未 push、尚未套用正式 SQL，也沒有刷新正式資料。
- `supabase/snippets/` 維持未追蹤，未納入 migration 差異。

## 差異結果

- 正式端最新 migration：`202607300010_refresh_published_people_after_tsai_merge.sql`。
- 本地最新 migration：`202608010036_publish_tnl_dark_guide_family_claims.sql`。
- 遠端沒有本地缺少的 migration，也沒有版本分岔。
- 待套用 migration 共 59 個；CLI dry-run 成功並依版本順序列出全部項目。

| 批次 | Migration 範圍 | 數量 | 內容 |
| --- | --- | ---: | --- |
| A | `202607300011`–`202607300023` | 13 | 選區編號正規化、歷史人物自動／人工審核結果、同屆與跨屆人物合併 |
| B | `202607300024`–`202607300033` | 10 | 建立歷史中選會選舉、選區、人物與候選關係，完成剩餘人物合併 |
| C | `202608010001`–`202608010003` | 3 | 2026 政黨候選人公開讀取面與高雄張耀中私有追蹤 |
| D | `202608010004`–`202608010034` | 31 | 1994–2018 地方議員、2020 全國選舉、2012 桃園立委選區的發布、得票與身分修正 |
| E | `202608010035`–`202608010036` | 2 | 暗公報 56 位親屬人物與 174 筆已審核家族關係 |

## 容量與執行風險

- 2026-08-02 正式備份還原後的精確基準為 413,068,435 bytes（約 **393.9 MiB**）；先前 Dashboard／inspect 顯示約 443 MB，兩者不可混用作同一單位的容量門檻。
- Supabase Free project 超過 500 MB database size 會進入 read-only mode；不能把 1 GB disk space 誤認為可使用到 1 GB 的資料庫額度。
- 最終乾淨演練依序執行 Phase 1、59 個 migration 與 Phase 2：Phase 1 後 398,322,835 bytes，migration 完成後高峰 498,232,467 bytes，最終 340,438,163 bytes（約 **324.7 MiB**）。最終距 350 MiB 專案內部警戒線約 25.3 MiB。
- 正式端與隔離環境相差約 110 MB，主要不是可回收 bloat，而是正式端仍保存完整的內部匯入／審核資料。正式端估算 bloat 約 15 MB，單做 `VACUUM FULL` 不足以形成可接受的發布空間，且會鎖表。

| 資料 | 正式端約略大小 | 隔離正式環境約略大小 | 判讀 |
| --- | ---: | ---: | --- |
| `source_people` | 60 MB | 240 KB | 原始來源人物與 payload，不屬公開網站必要資料 |
| `person_identity_matches` | 30 MB | 240 KB | 身分比對／審核紀錄，不屬公開讀取面 |
| `candidate_status_history` | 26 MB | 24 KB | 候選狀態歷史，不屬目前公開讀取面 |
| `person_claims` | 96 MB | 66 MB | 隔離環境只保留已核准公開且在白名單內的 claims |
| `candidates` | 46 MB | 53 MB | 完整 migration 後公開核心資料會增加 |
| `people` | 33 MB | 36 MB | 完整 migration 後公開核心資料會增加 |
| `published.candidate_facts` | 22 MB | 28 MB | Promote／refresh 後發布快照會增加 |

- 依隔離環境差異推估，59 個 migration 與刷新發布層會增加約 30–40 MB 的核心／公開資料。若直接從 443 MB 完整 push，常態容量可能逼近 500 MB，刷新期間的暫存高峰更可能越線。
- `source_people` 不能在 migration 前先全部刪除：批次 A、B、D 仍會讀取它與 `person_identity_matches` 完成人物配對、候選建立及得票回填。其外鍵也會在刪除來源人物時連帶刪除 identity matches，並把 `person_claims.source_person_id` 設為 `NULL`，必須先確認來源名稱與網址已足以保留公開 provenance。
- Supabase CLI 2.98.2 的 `db push` 沒有指定結束版本的參數；從目前工作樹執行會一次依序處理全部 59 個 migration。不要為了分批而手動修改 migration history。

## 唯讀瘦身預覽

- `scripts/production-compaction-preview.sql` 已把 rehearsal 白名單轉成唯讀統計；整份查詢包在 `BEGIN TRANSACTION READ ONLY`，只輸出容量、保留／封存候選列數、來源 payload 大小與外鍵影響。
- 正式端已於 2026-08-02 在 Dashboard SQL Editor 執行同一份唯讀預覽，精確結果如下。

| 正式端資料 | 總列數 | 保留列數 | 封存候選 |
| --- | ---: | ---: | ---: |
| `source_people` | 46,306 | 3,548 | 42,758 |
| `person_identity_matches` | 46,008 | 0 | 46,008 |
| `candidate_status_history` | 65,136 | 0 | 65,136 |
| `person_claims` | 59,361 | 39,933 | 19,428 |
| `person_party_affiliations` | 3,139 | 3,139 | 0 |

- 42,758 筆來源人物封存候選的 `source_payload` 約 18 MB；封存時會 cascade 42,271 筆 identity matches，另有 341 筆非保留 claims 的 `source_person_id` 會設為 `NULL`。
- 正式端兩個公開來源 guard 均為 0，且沒有公開黨籍資料受影響；這次只查詢統計，沒有執行清理。
- 完整本機資料庫驗證結果如下；這是資料倉庫形狀，不可直接當成正式端列數。

| 資料 | 總列數 | 保留列數 | 封存候選 |
| --- | ---: | ---: | ---: |
| `source_people` | 57,890 | 15,187 | 42,703 |
| `person_identity_matches` | 58,400 | 0 | 58,400 |
| `candidate_status_history` | 77,155 | 0 | 77,155 |
| `person_claims` | 447,161 | 40,107 | 407,054 |
| `person_party_affiliations` | 59,125 | 17,553 | 41,572 |

- 封存來源人物會 cascade 42,219 筆 identity matches，另使 212,087 筆非保留 claims 與 41,572 筆非保留黨籍資料的 `source_person_id` 變為 `NULL`；這些資料本身也在封存候選範圍。
- 兩個公開來源 guard 都為 0：沒有任何保留的公開 claim 或黨籍資料指向封存候選來源人物。
- 最終 324.7 MiB rehearsal 中，既有公開人物、選舉、選區、候選人、候選事實與搜尋資料的穩定鍵均 `missing=0`；pending migration 另增加 107 位人物與 17 位候選人。
- 可回復匯出已完成並通過 SHA-256 與資料列檢查；備份位於 `tmp/production-backups/2026-08-02-pre-compaction/`，不得提交至 Repo。
- commit `35c78bf` 推送後另建立 `tmp/production-backups/2026-08-02-pre-deploy-35c78bf/`；此版包含正式端 `auth`／`storage` schema 與資料，完整還原後為 415,141,011 bytes，並通過相同核心列數驗證。

## 發布建議

1. 再次執行 `scripts/verify-production-backup.sh`；備份或 checksum 不符時立即停止。
2. 從完整本機資料庫重新產生並核對兩份 bootstrap：`build-production-source-bootstrap.sh` 與 `build-production-existing-people-bootstrap.sh`。
3. 在正式維護時段先套用 source bootstrap，再套用 `production-compaction-phase-1.sql`。Phase 1 只清除可重建的候選狀態歷史與衝突的未追蹤身分工作列，不提前刪除 migration 仍需要的來源資料。
4. 執行 linked project 的 `db push --include-all`，一次依序套用 59 個 migration；不可移動既有 migration，也不可手動修改 migration history。
5. 59 個 migration 全部成功後才套用 `production-compaction-phase-2.sql`，保留已核准公開 claims、媒體、公司關係、黨籍、黨職事件與仍被它們引用的來源列，並回收實體空間。
6. 立即確認資料庫低於 350 MiB 內部警戒線，重新執行 `migration list`，並核對公開列數與 release state。
7. 使用 anon key smoke test 首頁、搜尋、人物頁、縣市頁、選舉頁、政黨頁，再測試聊天室與管理登入；同時確認 internal tables 仍不可由 anon 讀取。
8. 任一步驟失敗即停止後續操作並保留現場，不手動標記 migration 為已套用；需要回復時使用已驗證備份重建，而不是猜測性補 SQL。

## 目前結論

Migration 歷史沒有衝突，dry-run 與最終乾淨演練均通過。**仍不可從目前基準直接只執行 `db push`**；必須依序執行 bootstrap、Phase 1、59 個 migration、Phase 2。完整演練的 migration 後高峰為 498,232,467 bytes，最終為 340,438,163 bytes，且既有公開穩定鍵全部 `missing=0`。目前已達 go/no-go 前的技術門檻，但實際正式寫入仍應在乾淨 commit、明確維護時段與最後人工確認後開始。
