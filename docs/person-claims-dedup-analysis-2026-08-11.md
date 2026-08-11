# Person claims 重複與容量盤點（2026-08-11）

## 結論

`person_claims` 的大部分重複外觀不是可直接刪除的重複資料，而是同一人物在不同選舉、任期或來源紀錄中的證據軌跡。正式環境既有瘦身流程只保留頁面實際需要的豐富 claims，因此不應為了本機容量直接刪除完整歷史 claims。

本輪採用以下安全界線：

- 本機完整資料庫保留歷史來源與審核軌跡。
- 正式 runtime claims 只包含 `education`、`experience`、`platform`、`family_relation`、`legal_case`、`office`。
- 第一批只考慮收斂「同一 canonical 人物、同欄位、同值、同來源名稱、同來源網址」的學歷與經歷公開 claims。
- 司法、現任職務及多來源網址資料不自動處理。
- 第二階段已在 local Supabase 封存 928 條學經歷重複公開 claims。
- 人工確認後，第三階段另封存 16 條家族關係與 1 條政見重複；兩組不同官方網址的學歷證據刻意保留。
- Local 只封存、不刪除；rehearsal 才執行實體瘦身，正式環境未動。

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

另有 15 個語意群組需要人工判斷。完成 928 條自動封存後，這些群組留下 19 條語意重複：

- 2 組學歷來自同一來源名稱但不同頁面網址。
- 12 組為家族關係。
- 1 組為政見。

人工檢查後的處理方式：

- 張溫德與祝惠美的 2 組學歷雖然文字相同，但各自連到兩個不同的縣市政府官方頁面，因此保留全部 4 條證據。
- 12 組 Wikidata 家族關係具有相同 canonical 人物、關係類型、親屬 QID、文字與來源網址，差異只來自重複匯入或較舊的比對資訊；保留資訊較完整的一條，封存 16 條。
- 張斯綱的政見具有相同 canonical 人物、文字、來源與來源網址，封存 1 條重複列。

## Local 第二階段結果

`202608110001_archive_duplicate_public_profile_claims.sql` 已套用 local Supabase：

- 928 條學歷／經歷 claims 改為 `archived + private + is_public = false`。
- 每個 canonical 人物、欄位、文字、來源名稱與來源網址仍至少保留一條公開 claim。
- 公開學歷與經歷由 42,342 列降為 41,414 列，公開事實與來源網址集合仍為原本的 41,414 組。
- 同 canonical 人物、文字、來源名稱與來源網址的學經歷重複已歸零。
- 108 項前端讀取契約、public view 契約與資料邊界檢查通過。
- 既有 local migration ledger 落後，CLI 會先嘗試重跑舊 migration；本輪因此直接執行已通過回滾演練的 SQL，未改寫既有 migration 紀錄。

## Rehearsal 結果

Migration 與 `scripts/production-compaction-phase-2.sql` 已依序套用 rehearsal：

- Compaction 預覽只列出 928 筆 `person_claims`，其他資料表與外鍵影響均為 0。
- `person_claims` 實際刪除 928 筆，剩餘 42,214 筆全部符合正式 runtime 保留規則。
- Rehearsal 資料庫由 343 MB 降至 334 MB，名目 500 MiB 額度餘裕約由 157 MB 增至 166 MB。
- `person_claims` 實體大小由 75 MB 降至 67 MB。
- Published rehearsal smoke test 通過：17 個核准關係可讀，內部 release、promote 與 identity 資料維持封鎖。

## 人工例外階段結果

`202608110002_archive_duplicate_family_and_platform_claims.sql` 已依序完成 local 與 rehearsal 回滾演練及套用：

- Local 精確封存 17 條：16 條家族關係、1 條政見。
- 封存前後的公開家族／政見事實與來源投影完全相同。
- 同 canonical 人物、關係欄位與來源網址的家族／政見精確重複已歸零。
- 只剩 2 組刻意保留的多官方網址學歷資料。
- Rehearsal compaction 預覽只有 17 筆 `person_claims`，其他資料表與外鍵影響均為 0。
- Rehearsal 實際刪除 17 筆，剩餘 42,197 筆 claims；資料庫仍為 334 MB，`person_claims` 仍約 67 MB。
- 108 項讀取契約、public view 契約、資料邊界檢查與 published rehearsal smoke test 全部通過。

## JSON 重複內容

82,296 條 claims 的 `claim_json` 含有 `sourcePayload`，而且全部都有有效的 `source_person_id`，`sourcePersonKey` 也都與 `source_people` 一致。`source_people.source_payload` 已保存同一來源內容，移除 claims 內的 `sourcePayload` 與 `sourcePersonKey`，以逐列欄位大小估算可少約 48 MB。

這項處理暫不執行，原因是部分舊 claims 的 payload 是當時抽取快照，而 `source_people` 可能保存較完整或後續更新版本。若要清理，應先建立快照等價性檢查及回復方案。

## 後續

1. 正式部署前對正式快照重跑唯讀預覽與備份驗證；依序確認第一階段精確命中 928 筆、人工例外階段精確命中 17 筆後，才套用 migration 與 compaction。
2. 兩組多官方網址學歷證據維持公開；司法紀錄仍不納入自動去重。
3. `claim_json.sourcePayload` 的約 48 MB 潛在縮減維持下一個獨立階段，不與本次封存混做。

## 執行方式

唯讀預覽：

```bash
psql "$DATABASE_URL" -f scripts/person-claims-dedup-preview.sql
```

此檔案沒有 `UPDATE`、`DELETE`、`INSERT`、DDL 或 `VACUUM`。
