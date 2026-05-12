# PR Workflow

## 分支命名

每次資料更新使用：

- `data-update/YYYY-MM-DD`

## PR 標題

- `Data update YYYY-MM-DD`

## PR 內容要求

1. 本次掃描來源
2. 新增候選關係數量
3. 更新候選資料數量
4. 被拒絕或忽略資料數量
5. 高風險項目數量
6. 是否包含任何敏感資料風險
7. 對應 `report.md` 路徑

## 審核重點

- 是否僅使用公開資料
- 是否保留來源與證據
- 是否誤把推論當事實
- 是否含敏感個資
- 是否有同名同姓風險
- 是否誤設為 `verified` 或 `is_public = true`

## 合併前確認

- `changes.json` 格式正確
- `sources.json` 完整
- `rejected.json` 有記錄不可匯入資料
- `report.md` 已清楚標示風險與待人工確認事項
