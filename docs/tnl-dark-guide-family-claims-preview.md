# 暗公報政治家族資料：安全預覽、本機寫入與發布演練

這一階段將已完成外部來源查核、人物身分可唯一對應的政治家族資料整理成安全預覽，寫入本機已驗證區，產生固定範圍的發布 migration，並在隔離的正式環境模擬資料庫完成演練；尚未接觸正式 Supabase。

## 安全邊界

- 預覽與寫入都只允許本機 Supabase；若網址不是 `localhost`、`127.0.0.1` 或 `::1`，腳本會拒絕執行。
- 不建立新人物，不自動處理同名或一對多人物。
- 不直接發布暗公報原文；公開候選內容只使用標準化關係文字，例如 `父親：林士昌`。
- 外部來源必須直接提到親屬姓名及親屬關係，論壇或未信任來源不會通過。
- 通過條件的內容寫成 `verified`、`review_only`、`is_public = false`；正式公開仍是獨立步驟。
- 2018 與 2022 的同一關係會去重，已公開的關係不會重複建立。
- 顯示保留具體稱謂，例如 `小叔`、`姑姑`、`外甥`、`表親`；只將 `爸爸`、`媽媽` 等口語稱呼標準化。

## 來源預覽結果

- 可研究的政治家族資料：251 筆
- 可安全解析：138 筆
- 去重後的明確關係：110 個
- 已公開：12 個
- 可進已驗證區：98 個
- 保留人工處理：113 筆
  - 親屬未找到：77 筆
  - 同名人物不唯一：29 筆
  - 同一敘述同時包含已找到與未找到人物：3 筆
  - 沒有明確親屬姓名：2 筆
  - 尚未支援的遠親描述：2 筆

## 本機寫入結果

- 已驗證但尚未公開：98 筆
- 信心 A（官方來源）：19 筆
- 信心 B（媒體、機構或其他可信來源）：79 筆
- 第二次執行前已存在 98 筆，執行後仍為 98 筆，未產生重複資料。

## 公開前預覽結果

- 可發布：98 筆
- 阻擋：0 筆
- 涉及人物：79 位
- 單一人物最多：3 筆家族關係
- 已比對既有公開關係：104 筆
- 公開前預覽約 52 KB

每一筆預覽都再次確認主要人物與親屬均已公開、關係文字與親屬姓名一致、來源使用 HTTPS，且信心與分數符合人物頁敏感資料門檻。

## 發布 migration 與隔離演練

- 產生 migration：`supabase/migrations/202608010035_publish_tnl_dark_guide_family_claims.sql`
- migration 內固定包含 98 筆關係：A 級 19 筆、B 級 79 筆，共 79 位主要人物。
- migration 會再次檢查人物公開狀態、claim key、來源、安全門檻及既有公開重複資料；任何數量或身分漂移都會中止交易。
- 在一次性正式環境模擬資料庫執行成功，連續執行兩次後仍為 98 筆，沒有建立重複資料。
- 公開 View 可讀取 98 筆；抽樣確認具體親屬稱謂、親屬姓名與來源均正確。
- 公開 API smoke test 通過：公開關係可讀，內部發布、promote 與身分資料仍不可讀。

容量演練結果：

- migration 前資料庫約 333 MiB；執行後約 332 MiB。整體數字受 PostgreSQL 配置與統計波動影響，不解讀為 migration 節省容量。
- `person_claims` 的直接關聯大小增加 24 KiB。
- 距 350 MiB 專案警戒線約 18 MiB，距 500 MiB 免費方案上限約 168 MiB。
- 容量檢查結果為通過，但後續新增大批資料時仍應繼續分批演練。

## 執行方式

```bash
node scripts/preview-tnl-dark-guide-family-claims.mjs
node scripts/apply-tnl-dark-guide-family-claims.mjs --expected-count 98
node scripts/apply-tnl-dark-guide-family-claims.mjs --apply --expected-count 98
node scripts/preview-publish-tnl-dark-guide-family-claims.mjs --expected-count 98
node scripts/build-tnl-dark-guide-family-release-migration.mjs --expected-count 98
```

本機輸出：

- `local-data/tnl-dark-guide-family-claims-preview.json`
- `local-data/tnl-dark-guide-family-release-preview.json`

## 目前邊界與下一步

正式 Supabase 尚未套用這份 migration。下一步是先提交目前版本；需要正式公開時，再於發布前確認正式資料狀態與容量，套用 migration 後執行公開 API 與人物頁 smoke test。
