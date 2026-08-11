# Person claims 重複與容量盤點（2026-08-11）

## 結論

`person_claims` 的大部分重複外觀不是可直接刪除的重複資料，而是同一人物在不同選舉、任期或來源紀錄中的證據軌跡。正式環境既有瘦身流程只保留頁面實際需要的豐富 claims，因此不應為了本機容量直接刪除完整歷史 claims。

本輪採用以下安全界線：

- 本機完整資料庫保留歷史來源與審核軌跡。
- 正式 runtime claims 只包含 `education`、`experience`、`platform`、`family_relation`、`legal_case`、`office`。
- 第一批只考慮收斂「同一 canonical 人物、同欄位、同值、同來源名稱、同來源網址」的學歷與經歷公開 claims。
- 家族、司法、政見、現任職務及多來源網址資料不自動處理。
- 第二階段已在 local Supabase 封存 928 條重複公開 claims；沒有刪除資料，也沒有碰正式環境。

## 本機量測

| 項目 | 數量 |
|---|---:|
| `person_claims` 全部列 | 449,978 |
| 已確認且公開 | 427,841 |
| 已連結人物的已確認公開 claims | 424,225 |
| 尚未連結人物的已確認公開 claims | 3,616 |
| 最深 verified 人物合併鏈 | 4 層 |
| 一個 duplicate 指向多個 verified canonical | 0 |
| 完全相同的 claims | 0 |

先前約 53,000 組的數字代表「同一 canonical 人物、欄位、值與來源名稱」的語意重複群組，不代表資料列完全相同。每列通常仍有不同的 `source_person_id`、選舉脈絡、查核 JSON 或時間，因此不能直接刪除。

## 正式 runtime 範圍

既有 `scripts/production-compaction-phase-2.sql` 會讓正式環境只保留已確認、公開且屬於下列類型的 claims：

- `education`
- `experience`
- `platform`
- `family_relation`
- `legal_case`
- `office`

封存前本機共有 43,142 列符合這個範圍，列內容估計約 56 MB（不含索引與資料頁額外成本）。其中：

| 類型 | 重複群組 | 多餘公開列 |
|---|---:|---:|
| 學歷 | 410 | 482 |
| 經歷 | 409 | 448 |
| 家族關係 | 12 | 16 |
| 政見 | 1 | 1 |
| 司法紀錄 | 0 | 0 |
| 現任職務 | 0 | 0 |

若先以「同 canonical 人物、欄位、文字與來源名稱」分組，其中有 817 組只有單一來源網址，可收斂 925 條多餘公開列。實際封存會再精確到來源網址分區，因此共有 820 個安全分區、928 條可封存公開列；同一來源名稱若有兩個不同網址，仍會各保留一條。

另有 15 個語意群組需要人工判斷。先完成 928 條自動封存後，這些群組仍會留下 19 條語意重複：

- 2 組學歷來自同一來源名稱但不同頁面網址。
- 12 組為家族關係。
- 1 組為政見。

## Local 第二階段結果

`202608110001_archive_duplicate_public_profile_claims.sql` 已套用 local Supabase：

- 928 條學歷／經歷 claims 改為 `archived + private + is_public = false`。
- 每個 canonical 人物、欄位、文字、來源名稱與來源網址仍至少保留一條公開 claim。
- 公開學歷與經歷由 42,342 列降為 41,414 列，公開事實與來源網址集合仍為原本的 41,414 組。
- 同 canonical 人物、文字、來源名稱與來源網址的學經歷重複已歸零。
- 108 項前端讀取契約、public view 契約與資料邊界檢查通過。
- 既有 local migration ledger 落後，CLI 會先嘗試重跑舊 migration；本輪因此直接執行已通過回滾演練的 SQL，未改寫既有 migration 紀錄。

## JSON 重複內容

82,296 條 claims 的 `claim_json` 含有 `sourcePayload`，而且全部都有有效的 `source_person_id`，`sourcePersonKey` 也都與 `source_people` 一致。`source_people.source_payload` 已保存同一來源內容，移除 claims 內的 `sourcePayload` 與 `sourcePersonKey`，以逐列欄位大小估算可少約 48 MB。

這項處理暫不執行，原因是部分舊 claims 的 payload 是當時抽取快照，而 `source_people` 可能保存較完整或後續更新版本。若要清理，應先建立快照等價性檢查及回復方案。

## 後續

1. 在 rehearsal 套用 migration 與正式 compaction，確認封存列不進正式 runtime 資料，並重跑容量、公開契約與人物頁 smoke test。
2. 15 組例外維持原狀，另做人工審核；司法紀錄不納入自動去重。
3. `claim_json.sourcePayload` 的約 48 MB 潛在縮減維持下一個獨立階段，不與本次封存混做。

## 執行方式

唯讀預覽：

```bash
psql "$DATABASE_URL" -f scripts/person-claims-dedup-preview.sql
```

此檔案沒有 `UPDATE`、`DELETE`、`INSERT`、DDL 或 `VACUUM`。
