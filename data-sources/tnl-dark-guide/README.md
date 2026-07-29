# The News Lens 六都議員暗公報資料

這個目錄保存 2018、2022 六都議員暗公報的結構化擷取結果，僅供 Public Office Watch 內部研究與尋找可獨立查證的來源。

## 使用限制

- 尚未取得原網站授權，不得直接 Promote 或顯示於公開網站。
- 每項政治家族、涉案紀錄、政治工作或其他敘述都只是研究線索；公開前必須找到官方資料、裁判書或可信的獨立來源。
- 僅保存結構化文字、來源連結和公開頁面網址，不保存完整 HTML 或圖片檔。
- `imageUrl` 只記錄原站公開圖片位址，不代表取得圖片重製權。

## 檔案

- `tnl-dark-guide-2018.json`：2018 六都 748 位議員候選人。
- `tnl-dark-guide-2022.json`：2022 六都 740 位議員候選人。
- `coverage-report.json`：兩屆資料與本機 Supabase 歷史候選人、2026 目前候選人的對照結果。

## 重新產生對照報告

本機 Supabase 啟動後執行：

```bash
node scripts/report-tnl-dark-guide-coverage.mjs
```

資料與報告驗證：

```bash
node scripts/validate-tnl-dark-guide-datasets.mjs
```

2022 網站拒絕一般下載請求，因此本次資料是由正常公開瀏覽器頁面已渲染的 DOM 解析，不使用未公開 API，也不繞過登入或存取控制。日後若重新擷取，應維持相同界線並再次驗證候選人總數。
