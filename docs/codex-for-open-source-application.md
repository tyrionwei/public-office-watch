# Codex for Open Source 申請準備

最後核對：2026-08-28。正式申請表以 [OpenAI Codex for Open Source](https://openai.com/form/codex-for-oss/) 當下內容為準。

這份文件保存可重複核對的申請草稿，不代表 Public Office Watch 已獲 OpenAI 接受、贊助或背書，也不應填入尚未確認的流量或採用數字。

## 申請定位

Public Office Watch 是直接供一般使用者瀏覽的開源 civic-tech 公共資料產品，不是套件或開發者工具。申請時應以正式服務、公共資料覆蓋、可追溯來源、持續維護、外部更正回報及搜尋觸及說明影響力，不需把 stars、forks 或套件下載包裝成主要指標。

## 送出前檢查

- GitHub 個人頁與 repository 維持公開。
- Repository About 填入 description、`https://pow4vote.org` 與相關 topics。
- README、LICENSE、SECURITY、CONTRIBUTING、CI 與正式站連結可直接查閱。
- 送出前更新 Search Console 的實際 impressions、clicks、有曝光頁面與查詢數；數字不大也照實填寫。
- 確認 OpenAI Organization ID，但不要把 ID、API key 或帳務資料提交到 repository。
- 申請人角色選擇 `Primary maintainer`；有其他核心維護者時再依實際情況調整。
- 有需要時勾選 Codex Security 與 API credits；不宣稱尚未取得的資格。

## 建議的 GitHub About

Description:

> Open-source civic data explorer for Taiwan elections, public officials, candidates, platforms, and political finance.

Website:

> https://pow4vote.org

Topics:

> taiwan, elections, open-data, civic-tech, government, react, supabase, cloudflare-workers

個人頁 bio 可在維護者確認後使用：

> Maintainer of Public Office Watch — open-source civic tech and Taiwan election data.

## 表單草稿

### Why does this repository qualify?

> Public Office Watch is an actively maintained open-source civic-tech platform that turns fragmented Taiwan election and public-office records into searchable, source-traceable public data. People use the deployed service directly at pow4vote.org rather than installing it as a library. The project is expanding ahead of Taiwan's 2026 local elections, with ongoing data review, security, CI, and release maintenance.

### How will you use API credits for your project?

> Use Codex and API credits for structured-data import validation, source consistency checks, duplicate identity detection, PR and migration review, test generation, release checks, and maintainer automation. AI output will never publish sensitive political data directly: public changes remain subject to source verification, automated checks, and human approval.

### Anything else we should know?

> Public Office Watch is a public-facing civic-data product, so end-user traffic, indexed pages, correction reports, and public-data coverage are more meaningful adoption signals than package downloads or forks. The production service is live and indexed by Google. Current traffic figures will be added from Search Console immediately before submission.

## 時程

網站資料限制、貢獻指南與 repository 定位完成後，讓 Search Console 再累積約 7 至 14 天。送出前更新真實觸及數字並重新確認三段英文均未超過表單的 500-character 上限；申請採 rolling review，不需要為等待更漂亮的數字而長期延後。
