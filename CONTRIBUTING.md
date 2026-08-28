# Contributing to Public Office Watch

感謝你協助改善 Public Office Watch（公職資料觀測站）。本專案同時處理程式碼與政治、公職、選舉等公開資料；兩者都接受貢獻，但資料變更需要比一般介面修改更嚴格的來源與身分確認。

## 開始之前

- 小型錯字、文件與明確 bug 可直接提交 Pull Request。
- 功能變更、資料模型調整或大量資料匯入，請先開 Issue 說明目標、來源與影響範圍。
- 請勿提交私密資料、API 金鑰、服務角色金鑰、未公開個資或無法合法公開的原始檔。
- 安全問題請依 [SECURITY.md](SECURITY.md) 私下回報，不要建立公開 Issue。

## 本機開發

需求：Node.js 22（或 Node.js 20.19 以上）、npm、Docker 與 Supabase CLI。

```bash
npm install
npm --prefix apps/web install
npx supabase start
cp apps/web/.env.example apps/web/.env.local
npm --prefix apps/web run check:local-test-env
npm --prefix apps/web run dev
```

一般開發與測試只能使用本機 Vite 與本機 Supabase。不要把正式 Supabase URL、金鑰或資料庫憑證複製到 `.env.local`，也不要讓瀏覽器端取得 service role key。

## 程式碼與介面變更

- 只修改與 Issue 或 PR 目標直接相關的內容，避免夾帶無關重構。
- 維持既有 TypeScript、React、Tailwind 與 i18n 寫法；公開介面新增文案時同步繁體中文與英文。
- 任何新公開資料查詢都必須經過 `published` schema 或既有受限 RPC，不得讓前端直接讀取內部審核表。
- 新增或修改互動功能時，應涵蓋鍵盤操作、可辨識標籤、窄版寬度與錯誤狀態。

## 公開資料變更

- 優先使用政府機關、選舉公報、官方公告或可交叉驗證的公開來源。
- 在 PR 說明中列出來源名稱、URL、資料日期，以及如何確認人物、選舉或政黨身分。
- 同名不代表同一人；合併人物資料時需提供官方識別碼、選舉年份、選區、號次或其他足以交叉確認的證據。
- 不得因 AI、自動抓取或單一搜尋結果就把待查線索標成已驗證資料。
- 學經歷與政見可做空白、編號、換行及條目切分，但不得改寫原意；不確定的切分應保留原文並標記待審。
- 政治獻金只接受符合本站公開邊界的摘要與彙總，不提交個人捐贈明細。

## 驗證

提交前至少執行：

```bash
npm run check
```

若變更涉及特定功能，請再執行對應測試；涉及 migration 時，先在本機 Supabase 套用並執行資料庫 lint。PR 說明需列出實際執行的命令與結果，未執行的檢查也應說明原因。

## Pull Request checklist

- 變更範圍與 Issue／目的清楚。
- 沒有提交密鑰、私密資料或本機產物。
- 公開資料附可查核來源，敏感內容保留人工審核邊界。
- 繁中與英文介面文案已同步。
- 相關 lint、build、測試與 migration 檢查已通過。
- 文件、資料說明或更新紀錄已在需要時同步。

提交貢獻即表示你同意程式碼依本專案的 [ISC License](LICENSE) 發布；第三方資料仍受原始來源的授權、使用條款與適用法規約束。
