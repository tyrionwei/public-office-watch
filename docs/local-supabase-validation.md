# Local Supabase Validation

## 目的

分開驗證離線程式、mock 介面、完整本機公開資料，以及隔離資料庫的寫入／權限。一般開發使用 full-local；正式形狀驗收使用 [rehearsal](production-rehearsal.md)，兩者不可互換。正式 Supabase 不作本機測試目標。

## 前置條件

Node.js、Python／影像相依與兩份 lockfile 的安裝方式集中在 [CONTRIBUTING.md](../CONTRIBUTING.md#本機開發)。資料庫驗收另需可用的 Docker daemon。先確認目前 branch、既有變更與服務；不要為重跑測試清除研究資料、dist 或舊報告。

新開發環境可用根目錄已安裝的 CLI 啟動：

```bash
npx supabase start
```

已有 full-local 服務時先核對其 project、port 與健康狀態，不要重建或 reset。`start`／`status` 可能顯示本機密鑰，只在受控終端讀取需要的欄位，不複製完整輸出到 PR、報告或聊天。`supabase/migrations` 是唯一由 Supabase CLI 追蹤的 migration 歷史來源。`supabase/local-migrations` 只保存明確的本機研究工具安裝 SQL，不自動重播、不寫第二套 ledger，也不納入正式推送；目前僅有自動審核 RPC，安裝／唯讀檢查見[審核流程](review-workflow.md#自動審核的資料庫前置與恢復)。

## 建立前端本機設定

```bash
cp apps/web/.env.example apps/web/.env.local
```

不要覆寫既有 `.env.local`。填入本機 Supabase 的 URL 與 public key，以及本機 Turnstile 測試 site key：

```text
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local public key>
VITE_TURNSTILE_SITE_KEY=<local test site key>
VITE_PUBLIC_DATA_PROVIDER=published
VITE_ENABLE_PUBLISHED_PROVIDER=true
```

Turnstile 的測試 site key 與配對 server secret 依 [Cloudflare 官方測試文件](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)；測試值只供本機使用，不沿用正式 widget／secret。測試 token 仍需由 server 驗證，單有 site key 不等於互動已可用。

Vite 參與代理在啟動時就要求以下 **server-only** 欄位。將它們放進被忽略的 `apps/web/.dev.vars`；不要加 `VITE_` 前綴：

```text
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<local public key>
TURNSTILE_SECRET_KEY=<paired local test secret>
PARTICIPATION_CLEARANCE_KEY=<local-only random secret>
PARTICIPATION_PROXY_HMAC_KEY=<local-only shared proof secret>
PARTICIPATION_IP_HMAC_KEY=<local-only random secret>
```

代理讀取順序為 `.env.local`、`.dev.vars`、process environment，後者覆蓋前者；不要從正式環境繼承同名變數。匿名寫入驗收還需本機 Auth CAPTCHA 配置，及本機 Vault 的 `participation_proxy_hmac_key` 與代理同值。這些是本機 DB 設定變更，依已授權測試範圍準備；只回報是否一致，不輸出 secret。

內部審核另需 `SUPABASE_URL` 與 `SUPABASE_SERVICE_ROLE_KEY`，由根目錄 `.env.local` 或 process environment 提供給 Vite 管理 middleware。它們不能放進瀏覽器 `VITE_*` 變數；本機審核 API 的 loopback、session capability 與 54321 限制見 [環境文件](deployment-environments.md#local-review-api)。

設定完成後：

```bash
npm --prefix apps/web run check:local-test-env
npm --prefix apps/web run dev
```

guard 只檢查前端設定，不驗 server secrets、服務健康或資料內容。full-local 可用需要三類實證：

1. Vite 在預期 loopback URL 回應。
2. API `http://127.0.0.1:54321/auth/v1/health` 成功，且 Docker gateway 的實際 runtime port mapping 包含 54321。
3. 瀏覽器或 anon `published` 查詢讀到可辨識的真實本機公開資料；不能只看到 mock、空殼或空陣列就判定成功。

## 驗證矩陣

| 類別 | 入口與用途 | 限度／副作用 |
|---|---|---|
| 根目錄程式測試 | `npm run test:script-suite`：Node script/lib tests + 四套 Python 影像測試 | 不是 OCR 外部引擎或來源網站整合；測試清單擴增時重新核對 I/O |
| 投開票所工具 | `npm run test:polling-places`：兩個 Node tests、PDF layout Python tests、py_compile | 不證明實際 PDF／ODS 全部來源品質；py_compile 寫入本機 cache |
| web 單元／契約 | `npm --prefix apps/web run test:read-contracts` | 多為替身測試；三個 local DB E2E 檔預設 skip，見下方 |
| 來源碼邊界 | web `check:data-boundary`、`check:published-exposure` | 靜態檢查，不是 DB ACL 實測 |
| mock 瀏覽器 | web `test:browser:ci`、`test:pwa`、`test:state-safety` | CI sharing/mobile 與 state-safety 使用 mock／隔離 I/O；PWA 須明確 mock build。不能證明 full-local 或正式資料。可能重建 dist、開 loopback server、寫報告 |
| 本機真資料頁面 | web `test:browser` 或明確人工流程 | 先過 local guard，再確認實際 DB origin；依 spec 分別審查互動／寫入副作用 |
| legacy views 退役 | web `check:public-view-contracts` | 有 URL／public key 時檢查 legacy public views 回 42501；缺值 exit 0 並印 skip。不檢驗所有 published 欄位／RPC |
| DB 權限與寫入 | web `smoke:public-views` 及 opt-in local E2E | **需要已核准隔離 DB**。smoke 會呼叫 `published.promote` 驗拒絕，不能當纯 GET；權限錯誤時可能寫入 |
| 正式形狀 | `rehearsal:rebuild` + 已核對的公開查詢／權限／UI checks | 重建可拋棄 rehearsal；是 schema snapshot，不是 migration 全史回放 |
| 正式發布 | [Production Release](../.github/workflows/production-release.yml) | 正式 drift、Worker build/dry run、main SHA gate、deploy 後 smoke；另有發布授權界線 |

`npm run check` 串接 script-suite、web read-contracts、lint、build、兩個來源碼邊界與 legacy retirement。它沒有跑上述所有列；在 `.env.local` 存在時，build 可含本機設定，不能把它稱作已通過 production environment guard 的正式 bundle。build 也有 Sites 相容 hook 的 `dist/.openai` 寫入，需保存既有產物時應用隔離 build。

## 依修改範圍選擇驗證

先讀將執行的 script、設定與測試內容，再確認其子程序、檔案輸出、網路及資料庫目標；下表是選擇順序，不是可略過此步的指令白名單。重用既有工具及鎖檔；只有版本號成功，不能證明功能可用。

| 修改範圍 | 最小相關驗證 | 何時擴大 |
| --- | --- | --- |
| 文件、操作指引 | 核對相對連結、npm script／workflow 與實作；審閱修改前後差異，執行 `git diff --check` | 指引新增有副作用的操作時，先完成環境及授權檢查，再做隔離實測；純文件不必重建網站 |
| 純函式、來源解析或 importer 決策 | 對應現有單元測試，加上能重現缺陷的成功／失敗／重試 fixture | 改變共用契約時擴至 script-suite；涉及 DB 更新時另驗冪等、部分失敗、人工決策競爭與前後狀態 |
| 介面互動、篩選、分頁、分享 | web 相關契約、lint／build 及相應 browser 流程；包含 0／1／多筆、API 錯誤、快速切換與重新開啟 | 資料依賴使用 full-local 另驗；原生分享、安裝與完整讀屏需真裝置，不能以 mock 通過代替 |
| 公開 provider、views／RPC、權限 | 來源碼邊界檢查，加隔離 DB 中適當角色的允許／拒絕與狀態驗證 | RLS、grants、Auth 或寫入代理變更擴至相關 opt-in E2E；不能只跑 regex 或 `smoke:public-views` 就宣稱全邊界安全 |
| Worker、SEO、PWA 或發布設定 | 對應契約、Worker build／dry run 及有界 browser／HTTP 驗證，明確標示 build mode | PWA 更新需兩版及既有開啟頁；SEO 需 HTML 回應與 SPA 導覽；正式 smoke 依發布流程另執行 |

遇到錯誤先判斷層次：命令啟動前的 sandbox 錯誤、PATH／runtime 不符、目標環境／憑證不一致、測試框架前置條件失敗，以及產品本身未符合預期。預期被拒絕的安全探針必須核對拒絕原因和無副作用，不能只看非零退出碼。首次失敗與修正測試框架後的結果分別保存；不要將前者刪去，或把後者誤報成產品已修復。

### PWA 雙版本補驗

既有 `test:pwa` 不能單獨證明舊客戶端會收到每種更新。需要驗更新策略時，使用隔離 mock 產物與可控制的同一個 loopback origin；不要替換使用者現有 dist 或正式資產：

1. 保存兩版來源／產物 manifest，分別記錄 service worker、manifest、offline 頁及預快取圖示的 bytes hash。測試案例需含「預快取資源改變、service worker bytes 相同」及策略預期的版本變更。
2. 由第一版開頁並等待 service worker 實際控制，確認基線；保留這個 context 與已開啟頁。
3. 在**相同 origin**切換第二版測試資源，依產品的更新策略觸發更新；記錄 update 請求、worker 狀態與資源版本，再開新 context 比較。只驗新 context 不足以發現舊 cache 殘留。
4. 對舊頁、新頁分別驗離線深路由與回線恢復，確認設定保留。另以一個資源下載失敗驗證不會啟用半套快取。結果依實際版本記錄，既有缺陷重現不能稱為更新通過。
5. 結束後關閉測試 contexts 與自己建立的 server，確認程序／連線已停止；只處理測試 origin 的狀態，保留證據，不清使用者瀏覽器資料。真 iOS／Android 安裝及生命週期另記未驗。

## 隔離 DB 與 migration

三類資料庫基線回答不同問題，報告要寫明實際使用哪一種：

| 基線 | 可以支持的結論 | 不支持的結論 |
| --- | --- | --- |
| 本機 schema snapshot ＋合成 fixture | 當前 schema／角色／特定資料條件的契約 | 過去每個 migration 都能由空庫執行；正式資料的全量正確性 |
| 經授權的正式備份還原 ＋指定後續 migration | 該備份版本、資料與後續變更的相容性 | 尚未取得的正式新資料；被跳過的歷史順序；不同平台服務版本完全一致 |
| 空庫依歷史順序回放 | 實際成功區段的建立順序、SQL 與資料前置條件 | 首次阻擋之後尚未跑的版本；正式服務目前一定正常 |

備份還原與 schema replay 必須使用可拋棄、明確隔離的 project／ports／volume；先記錄來源版本及檔案 hash，再確認 restore 錯誤與約束驗證結果。不得忽略失效 FK、移除權限保護或補造人物讓還原顯示成功。含真實資料的備份、row diff 與還原日誌維持私人，不放公開 fixture。

- `chatLocalE2e.test.ts` 需 `RUN_LOCAL_CHAT_E2E=1`；`participationLocalE2e.test.ts`、`platformFulfillmentLocalE2e.test.ts` 需 `RUN_LOCAL_PARTICIPATION_E2E=1`。未啟用時的 skip 不是通過。
- 這些測試包含建立使用者、RPC、CLI 或資料寫入，且目前有本機 project／port 假設。不要只改環境 URL 就直接跑；先核對每個 REST、CLI、Docker 及 DB 目標都落在核准的隔離 project／ports／volume，並準備清理驗證。
- migration、RLS、grants 變更須另驗角色讀寫與拒絕後狀態。`migration list --local` 的版本集合相同，不代表 SQL 內容相同或空庫可以依序 replay。
- 歷史資料修補若引用先前匯入的人物，須先確認精確 UUID 與預期姓名；人物不存在或不吻合時不補造人物、不改用同名配對。來源快照可保留，但不得新增錯誤的身分／claim／政黨關聯，也不得以衝突 key 改綁其他人的紀錄。測試需包含缺人物、姓名不符、正確人物、重複執行及 key 已屬於其他人的情境。
- 經審查修正歷史 migration 時，保留修改前後的 SQL hash；有產生程式者須同步修正，保留原來源 payload。修改檔案不會讓已套用該版本的資料庫自動重跑，不以改寫 history 或重設既有 DB 代替驗證。空庫重播逐檔保留交易邊界，避免 `ON COMMIT DROP` 暫存表被逐句 autocommit 提早刪除；首次錯誤立即停止並區分工具錯誤與資料前置條件。
- 正式 Supabase 寫入、migration 套用、部署、push、commit 各依明確授權執行；本機啟動或 read-only 診斷不包含這些動作。

## 結果回報

分開記錄「通過」「失敗」「skip」「未執行」，並附程式版本、環境、provider、命令與 artifact 路徑。只回報必要錯誤摘要、migration 版本及非敏感計數；不貼 keys、完整連線字串、私人待審內容。CI green、HTTP 200、mock 畫面、migration 版本數或空查詢各自只能支持其實際驗證範圍。

結束時核對來源檔案差異、既有資料與產物是否保留，以及自己建立的 server／容器／測試資料是否完成已授權清理。以程序或容器 ID 確認歸屬，停止後驗證連線或程序已消失；不要全域終止 Node、Docker 或 WSL。既有服務、研究 DB、正式資料及待追查證據的處置另行決定。
