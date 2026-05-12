# Review Workflow

## 審核流程

1. 蒐集公開資料
2. 寫入 `raw_source_records`
3. 產生 `relation_candidates`
4. 產出 `report.md`、`changes.json`、`sources.json`、`rejected.json`
5. 建立 `data-update/YYYY-MM-DD` branch
6. 提交 Pull Request
7. 人工審核
8. 審核通過後匯入 staging / 正式表

## 狀態定義

- `pending`
- `verified`
- `rejected`
- `needs_more_evidence`
- `archived`

## 審核重點

- 是否有清楚來源
- 是否有足夠證據文字
- 是否存在同名同姓風險
- 是否涉及敏感個資
- 是否把推論誤寫為事實

## OpenClaw 限制

OpenClaw 不得直接把資料寫成：

- `verified`
- `is_public = true`
