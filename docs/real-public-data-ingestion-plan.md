# Real Public Data Ingestion Plan

## 目標

- 這份文件原本記錄第一批低風險真實公開資料的導入順序。
- 目前專案已超過第一批範圍；最新同步行為以 `docs/real-public-data-sync.md` 為準。
- production provider 仍未啟用；production enable 必須走獨立 PR 與 readiness checklist。
- 人物關係、法律紀錄、家族關係與其他敏感資料仍不得從未審核資料直接公開。

## 目前已落地範圍

- `public_regions` 與地圖 / 區域基礎資料。
- `public_elections`、`public_races`、`public_candidates` 的官方選舉資料切片。
- 立法院現任委員與 2022 地方公職資料。
- 政黨名冊、政黨年度政治獻金摘要、公司層級政治獻金彙總。
- `source_people`、`person_identity_matches`、`person_claims` 的人物 identity / claim 分層。
- `public_person_claims`、`public_person_identity_sources`、`public_person_party_affiliations` 等保守 public views。

## 原始第一批資料範圍

以下是早期建議順序，保留作為階段脈絡，不代表目前唯一範圍：

1. `public_regions`：縣市 / 鄉鎮市區
2. map source metadata：來源、授權、轉換紀錄
3. `public_elections`：選舉名稱、日期、類型、狀態
4. `public_races`：選舉項目 / 區域
5. `public_candidates`：只限官方候選人公開資料，且需來源與審核
6. person / company / relation / polling 資料延後

## 來源

- 內政部 / 國土測繪中心行政區圖資
- 中央選舉委員會選舉資料庫
- 政府資料開放平台中選會資料集
- 中選會選舉公報網站

## 審核流程

- 真實資料不得直接寫死在 frontend mock data。
- 應走 Importer / staging / promote，或目前 Node/Supabase real-data sync 的 dry-run / write 流程。
- `raw_source_records` 只供後端 / 審核流程使用。
- 前端只能讀 public views。
- `pending` / `rejected` 不公開。
- 每筆資料要有 source / reviewed status / updatedAt。
- review 先保持 local-only；production 不啟用 internal review route / API。

## Public repo 原則

- 不 commit raw dump。
- 不 commit 未審核資料。
- 不 commit service key。
- 不 commit DB connection string。
- 若需要 sample，只能放極小、明確標示 fixture 的資料，不包含敏感關係推論。
