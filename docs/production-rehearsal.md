# 正式環境本機模擬

這套流程會從目前完整的本機 Supabase 建立一個可拋棄的「正式環境形狀」資料庫，用來量測核准公開資料、`published` 發布層與索引的實際容量。它不會連接 linked project，也不會更動正式 Supabase。

## 隔離範圍

- 完整本機 Supabase：API `54321`、資料庫 `54322`。
- 正式環境模擬：API `55321`、資料庫 `55322`。
- 模擬 project id 固定為 `public-office-watch-rehearsal`。
- 產物放在被 Git 忽略的 `tmp/production-rehearsal/`。
- 網站測試設定寫入被 Git 忽略的 `apps/web/.env.rehearsal.local`。

停止或重建時只允許移除 `public-office-watch-rehearsal` 的本機 volume，不會重設完整本機資料庫。

## 第一版資料白名單

模擬庫保留：

- 人物、選舉、選區、候選人與 canonical merge graph。
- 政黨、公司、政治獻金摘要及已核准的公司關係。
- 已核准公開的人物生日、學歷、經歷、政見、家族、案件與 office claims；生日保留完整原文，顯示粒度另由全站偏好決定。
- 已核准的黨籍／黨職資料與人物媒體。
- 公開區域議題定義、聊天室功能設定及全站生日顯示偏好（`site_display_settings`）。
- `published` 實體快照、Materialized Views、索引與公開讀取權限。

模擬庫不帶入：

- 原始抓取 payload、來源頁面與研究快照。
- 待審核或被拒絕的 claims。
- 身分配對建議與審核佇列。
- 候選狀態歷史及資料同步執行紀錄。
- 本機聊天室訊息、IP 安全紀錄、管理操作與使用者回報。
- 生日顯示設定的管理操作紀錄（`site_display_setting_actions`）；只複製公開偏好，不帶入操作者。

## 驗收限度

這是完整本機資料庫的 **schema snapshot + 核准公開子集**，不是對空庫依序重播 `supabase/migrations` 全部歷史。重建成功、容量合格或版本數一致，都不能證明完整 migration replay 或 SQL 內容無漂移。全史回放需另外核准唯一隔離 project／ports／volume，保留逐步執行與失敗證據。

full-local 若另裝了 `supabase/local-migrations` 的本地審查 RPC，結構快照可能包含該函式；這不代表正式發布需要安裝它，也不代表已套用正式 migration。該目錄不加入本流程的 migration 重播或 ledger；本機安裝入口固定 full-local，不能用它指向 rehearsal。相關用途與授權見[審核流程](review-workflow.md#自動審核的資料庫前置與恢復)。

重建與停止會刪除 rehearsal 自己的工作內容或可拋棄 volume，執行前先確認目標和服務占用。DB 寫入／拒絕 probe 必須核對測試本身是否硬編碼 full-local ports；不能因網站使用 `dev:rehearsal` 就假定所有 CLI 與 SQL 也轉到 rehearsal。詳見 [驗證矩陣](local-supabase-validation.md#驗證矩陣)。

## 使用方式

完整本機 Supabase 必須先保持啟動。

每次重建都會先清除被 Git 忽略的 rehearsal 工作目錄裡殘留的 migrations，只留下啟動用的 `published` bootstrap；實際 schema 會從完整本機資料庫重新匯出，避免從空庫誤重播依賴歷史種子資料的 migration。

```bash
npm run rehearsal:rebuild
```

完成後會輸出容量、發布列數與最大的資料表／索引。預設容量目標是 350 MiB；可用 `REHEARSAL_BUDGET_MIB` 暫時調整報告門檻。

網站要改讀模擬庫時：

```bash
npm --prefix apps/web run dev:rehearsal
```

停止並刪除模擬庫的可拋棄 volume：

```bash
npm run rehearsal:stop
```

每次正式發布前都應從空模擬庫執行 `rehearsal:rebuild`，再執行公開讀取、RLS、搜尋與主要頁面 smoke tests。容量合格不代表資料正確，資料核准狀態仍以完整本機資料庫為準。
