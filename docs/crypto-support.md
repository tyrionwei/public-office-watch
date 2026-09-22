# USDT 支持留言

前台位置：`/support`。既有 `/internal/feedback-admin` 登入後可讀取「支持留言」，沿用 `chat_admin` 管理權限。支持留言預設私密，沒有付款核對狀態、公開流程或金額統計；提交時間僅為系統收到留言的時間。

## 收款設定

唯一設定來源為 `apps/web/src/config/cryptoSupport.ts` 的 `supportNetworks`，前台與 Worker 共用。依站方本次指示，已填入 Ethereum、Base、BNB Smart Chain、Arbitrum One、OP Mainnet、Polygon PoS、Solana、TRON 的公開收款地址；六條 EVM 網路使用站方指定的同一地址。使用者其後明確要求「直接啟用」，目前八鏈均為 `enabled: true`，供本機預覽；`tokenNote` 如實標記代幣合約版本與小額收轉款尚未驗證。這不代表測試已完成或取得正式部署授權。必須由站方逐條確認完整收款地址、實際接收的 USDT 代幣版本並完成小額收款及轉出測試後，核對已填入的 `address` 並補上具體 `tokenNote`（包含實際 token contract／Solana mint 或可識別的代幣版本），維護對應的啟用設定。`networkId` 保持穩定。設定變更須重新建置並部署前台與 Worker，不支援 URL、localStorage 或使用者輸入覆寫。

只顯示啟用、非空、基本格式正確的收款設定。格式檢查不證明地址所有權、代幣版本或實際可收款；不得放入代幣合約地址或猜測地址。新增其他網路須經站方確認，不因 EVM 地址共用就自動開放。使用者後續明確新增 Solana，取代最初不加入 Solana 的限制。未新增金流／錢包 SDK；尚未確認各鏈的 USDT、橋接版本或其他同名資產；目前啟用依據是站方的明確指示。QR Code 在瀏覽器本機產生，內容僅為完整地址。Solana 基本格式驗證保留大小寫，要求地址 Base58 解碼為 32 bytes、交易簽章為 64 bytes；不驗證簽章、不查鏈。格式依據：[Solana accounts](https://solana.com/docs/core/accounts) 與 [transaction structure](https://solana.com/docs/core/transactions)。

## 儲存與防濫用

匿名表單 POST `/api/participation/support`，不使用 Supabase anonymous sign-in，不建立帳號。Worker 沿用 same-origin、16 KiB body 上限、HMAC IP 限流（既有每分鐘 12 次 binding），只有 severe bot risk 且沒有既有 clearance 時才要求既有 Turnstile；一般訪客沒有新增驗證步驟。不得依此推斷付款已發生。

Worker 接受 `requestId`、`networkId`、`receivingAddress`（畫面版本核對）、`reference`、選填 `nickname`／`message`，拒絕額外欄位。`receivingAddress` 必須精確等於可信設定，舊頁面地址與更新後 Worker 不符時要求重新整理，不能默默替換地址快照。伺服器以受控設定取得幣種與收款地址快照，簽署含所有儲存欄位的短效 proof；DB 使用既有 Vault `participation_proxy_hmac_key` 驗證。沿用既有金鑰，無新增權限較大的 Worker 憑證。

`crypto_support_messages` 啟用 RLS，撤銷 anon／authenticated／service_role 的直接資料表權限。只有 proof 受控的提交 RPC 可新增，管理 RPC 僅 service_role 可執行且再驗證實際 auth.users 的管理者身分。一般公開人物回饋表及 published RPC 不引用本表。API 不回傳資料列、原始 DB 錯誤或記錄表單內容。TxID／付款地址不是唯一鍵；同 request ID 同內容重送回相同紀錄，不同內容拒絕，新 ID 可再次留言。

## 套用與回復

1. 先在經核准的隔離 DB 套用 `20260920143533_crypto_support_messages.sql`，既有 migration 中的 digest helper、pgcrypto、Vault、Auth 為前置條件。確認 Worker 與 Vault 的 participation proof key 已配對，不輸出密鑰。
2. 隔離 DB 執行 `tests/sql/crypto-support.sql`，使用合成 Vault key 與合成 auth users；測試交易最後 rollback。2026-09-20 僅準備 SQL；2026-09-21 已完成最小隔離 DB 測試及本機研究庫套用，詳見下節。
3. 經發布授權後先套 migration、部署更新的 `feedback-admin` Edge Function，再依既有 release 流程發布前台與 Worker。migration 不變更既有 RPC；舊版前台仍相容。檢查一般回饋、管理登入、支持留言端到端流程後才開放收款設定。
4. 回復可將網路停用並發布前一版 Worker／前台／Edge Function；保留已收到的私密留言與新增資料表。不要用 DROP TABLE 作一般回復或刪除支持者資料。金鑰輪替仍沿用原本 participation 流程。

## 驗證入口

- 單元與伺服器替身：web `test:read-contracts`（包含 cryptoSupport、participationSecurity、feedbackAdminEndpoint）。
- 瀏覽器 fixture：web `test:state-safety -- cryptoSupport.pw.ts feedbackAdmin.pw.ts`，地址皆合成、無 DB／鏈上呼叫；QR 解碼驗證完整地址。
- 靜態檢查：web lint、build、check:data-boundary、check:published-exposure。
- SQL 為權限與冪等驗收入口；2026-09-21 隔離合成資料測試已通過，不代表正式 Auth／Vault 全環境驗收。
- 正式地址、真實小額收轉款、正式 Auth／Edge Function／Worker 整合、真手機掃碼仍須正式開放前另驗。

## 本次交付驗證（2026-09-20）

實作位於獨立 worktree `/tmp/pow-usdt-support`，分支 `codex/feature/usdt-support`，由更新後 `origin/main` 的 `368b381` 建立；本次依使用者指示提交，不含 push／部署。原目錄既有的 CONTRIBUTING 與環境文件修改保留。

- **通過**：完整 web read-contracts 68 個測試檔；另逐檔執行新設定/Worker 8 個案例、client/QR 3 個案例、feedback-admin endpoint 7 個案例及既有 participation 6 個案例，共 24 個；lint、TypeScript/Vite build、公開資料/曝露邊界檢查、Worker dry-run 及 `git diff --check`。QR 測試使用真正產生的 PNG 與 jsQR 解碼，不是比對 QR 的替身標籤。
- **警告**：既有 Vite config 相容性與 large chunk 警告；公開資料邊界的 SelectedRegionHud 直接 mock import 警告。未為本需求夾帶修正。
- **失敗／阻擋**：初次 UI browser fixture 因 sandbox loopback EPERM 及 QR alias 前置問題未成功執行；alias 已修。提權後回饋管理 suite 得到 1 passed、4 timeout、1 interrupted、4 did not run。另在完全空白按鈕頁重現 Chromium rAF 停滯，換完整 Chromium/停用 GPU 仍失敗，停止該問題本輪嘗試。底層原因未明。不能把已準備的 browser cases 宣稱通過。
- **已修復**：首次 build 的 TS6307 缺少共用設定 include；修正 node tsconfig 後 build 通過。
- **未執行**：SQL migration/RLS/冪等與併發實測（依使用者選擇只備 SQL）、新支持頁的完整 browser UI/主題/鍵盤/複製/手機驗收、正式登入與 Edge Function/Worker/DB 端到端、真手機掃碼、小額收款與轉出。正式開放前仍須完成。

私人失敗紀錄：本 worktree `.codex/task-failures.md`。原始 log 保留於 `/tmp/pow-usdt-*.log`，browser traces 保留 `apps/web/test-results`；均不作公開來源追蹤。

### 2026-09-20 後續追加網路（歷史紀錄）

新增六條網路並填入站方提供的三組地址；現有 BSC networkId `bsc` 保留。Solana 已補前後端與同份未套用 migration 的格式驗證及離線 QR 測試。未重試已停止的瀏覽器問題，未執行 SQL 或真實轉帳；正式開放前仍須完成各鏈代幣版本與小額收轉款確認。

八鏈追加驗證：10 個設定／Worker 案例與 3 個 client／QR 案例通過，lint、build、Worker dry-run、diff check 通過。首跑曾有一個測試向量誤把 87 個 `2` 的 Base58 值預期為 64 bytes；實際為 63，已改用正確 64-byte 向量，並新增該 63-byte 值必須拒絕的斷言，重跑通過。此追加不包含 SQL 實測或 browser 重跑；實際地址只驗基本格式。

### 2026-09-20 本機啟用預覽（已取代）

使用者要求背景啟動 5173 並「直接啟用」後，八鏈已明確啟用。代幣版本、收轉款測試與真實後端提交仍未驗證；當時服務是使用示範資料的 Vite build preview，不具留言儲存 API。設定與前台已啟用不等於正式站已發布。

前台依使用者確認改為桌面左右排列、手機上下排列，地址欄禁止拖曳縮放，QR Code 縮小；代幣版本未驗證提示依要求不在頁面顯示，設定備註仍保留。最後介面修改後 build 與 diff check 通過；版型調整另通過 lint 與 QR 解碼測試，未重跑受阻的瀏覽器驗收。


## 2026-09-21 release 整合

已整合至 `codex/release/2026-09-21`，以完整本機研究庫與 Vite dev 啟動，取代前述歷史示範預覽。migration 已在最小隔離 DB 完成合成金鑰／人物的 SQL 回歸，並在研究庫回滾驗證後套用。支持頁單元／契約20項與建置通過；真實管理登入、成功留言端到端與收轉款仍未驗收。詳見 [本批release紀錄](releases/2026-09-21.md)。
