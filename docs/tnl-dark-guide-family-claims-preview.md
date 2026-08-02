# 暗公報政治家族資料：安全預覽、本機寫入與發布演練

這一階段將已完成外部來源查核、人物身分可唯一對應的政治家族資料整理成安全預覽，補齊具公開職務的親屬人物，產生固定範圍的發布 migration，並在隔離的正式環境模擬資料庫完成演練；尚未接觸正式 Supabase。

## 安全邊界

- 預覽、人物 migration 產生器與寫入都只允許本機 Supabase；若網址不是 `localhost`、`127.0.0.1` 或 `::1`，腳本會拒絕執行。
- 不直接發布暗公報原文；公開內容只保留標準化關係，例如 `父親：林士昌`。
- 外部來源必須直接提到親屬姓名及親屬關係；論壇、網友留言或無法確認的來源不會通過。
- 具官方來源者可列 A；媒體、機構或其他可信來源最高列 B。
- 2018 與 2022 的同一關係會去重，已公開的關係不會重複建立。
- 冠夫姓只在指定出現位置解析，不建立全域姓名猜測規則。
- 顯示保留具體稱謂；李雅芬的 2022 泛稱「祖父」已依獨立來源修正為「外公」。
- 謝維洲與謝長廷的來源涉及已終止收養關係，目前模型無法表達有效期間，因此維持保留、不建立或發布該關係。

## 親屬人物補齊

- 審核名單共 57 位：56 位核准、1 位保留。
- 56 位均有獨立來源可確認公開職務；本機原先沒有唯一同名 canonical person，因此建立 56 位人物。
- 人物來源分級：A 14 位、B 42 位。
- 同時建立 `source_people` 與 `person_identity_matches`，保留來源、研究編號及身分比對證據。
- 周陳秀霞以完整姓名建立人物；`陳秀霞` 只在周奕齊的兩個指定來源位置連到周陳秀霞。
- 人物 migration 可重跑，並會在寫入前檢查同名 canonical identity 與 source key 衝突。

## 關係預覽與本機寫入

- 可研究的政治家族資料：251 筆
- 可安全解析：248 筆
- 去重後的明確關係：194 個
- 既有公開關係：20 個
- 新增已驗證關係：174 個
- 保留人工處理：3 筆
  - 沒有明確親屬姓名：2 筆
  - 關係具時間性、目前模型無法準確呈現：1 筆

174 筆在本機先寫成 `verified`、`review_only`、`is_public = false`，公開前預覽再次確認主要人物與親屬均已公開、關係與來源一致，結果為：

- 可發布：174 筆
- 阻擋：0 筆
- 信心 A：29 筆
- 信心 B：145 筆
- 涉及主要人物：137 位
- 單一人物最多：3 筆家族關係
- 公開前預覽約 90 KB

## 發布 migration 與隔離演練

- `supabase/migrations/202608010035_publish_reviewed_tnl_family_relative_people.sql`
  - 建立或重用 56 位親屬人物，寫入來源與身分比對資料，刷新公開人物快取。
- `supabase/migrations/202608010036_publish_tnl_dark_guide_family_claims.sql`
  - 固定發布 174 筆關係：A 29 筆、B 145 筆。

兩個 migration 在模擬正式資料庫依序執行成功，並各自重跑一次：

- 公開 `person_claims`：174 筆。
- `public_person_claims`：174 筆。
- 親屬人物來源：56 筆，A 14／B 42。
- 特殊案例只出現 `母親：周陳秀霞` 與 `外公：李水樹`；沒有發布謝長廷關係。
- 沒有建立重複人物、來源或關係。

容量演練結果：

- migration 前：348,064,915 bytes。
- 兩個 migration 多次重跑並刷新快取後：349,064,339 bytes。
- 增加 999,424 bytes，約 976 KiB；模擬正式資料庫顯示約 333 MB。
- 仍低於目前 350 MiB 專案警戒線；後續新增大批資料時仍應繼續分批演練。

## 執行方式

```bash
node scripts/build-reviewed-tnl-family-relative-people-migration.mjs
node scripts/report-tnl-dark-guide-family-people.mjs
node scripts/preview-tnl-dark-guide-family-claims.mjs
node scripts/apply-tnl-dark-guide-family-claims.mjs --expected-count 174
node scripts/apply-tnl-dark-guide-family-claims.mjs --apply --expected-count 174
node scripts/preview-publish-tnl-dark-guide-family-claims.mjs --expected-count 174
node scripts/build-tnl-dark-guide-family-release-migration.mjs
```

本機輸出：

- `local-data/tnl-dark-guide-family-claims-preview.json`
- `local-data/tnl-dark-guide-family-release-preview.json`

## 目前邊界

正式 Supabase 尚未套用 `035` 與 `036`。正式公開前仍需確認正式分支與 migration 狀態、先量測容量，套用後再執行公開 API 與人物頁 smoke test。
