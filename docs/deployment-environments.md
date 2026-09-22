# Frontend environment separation

## 依工作範圍選擇檢查

一般開發確認 repo／分支／未提交變更即可開始；本文件的服務、資料庫與發布檢查只在相關工作使用。資料庫、匯入及會寫外部服務的測試，須核對程式解析後的 endpoint、設定覆寫與目標身分；不只看檔名、cwd 或容器健康。目標不明或是未授權正式環境時停止，不載入正式寫入憑證。優先沿用現有 guard／唯讀查詢；同一工作階段且設定未變不重做完整盤點，寫入前仍確認實際目標一致。新工作階段或相關設定變動，只重新確認必要部分。

下面的發布、備份與回復要求適用於正式操作；rehearsal 只用於需要正式形狀的驗收，不是一般開發前置。

## Local development and browser tests

- Store local-only frontend values in `apps/web/.env.local`.
- `VITE_SUPABASE_URL` must use `localhost`, `127.0.0.1`, or `::1`.
- Use the local Supabase public key, a local Turnstile `VITE_TURNSTILE_SITE_KEY`, `VITE_PUBLIC_DATA_PROVIDER=published`, and `VITE_ENABLE_PUBLISHED_PROVIDER=true`.
- Complete server-only participation settings in `.dev.vars` before starting Vite; the frontend guard does not validate these. Follow [local setup and validation](local-supabase-validation.md).
- `npm --prefix apps/web run dev` and `npm --prefix apps/web run test:browser` run the local environment guard first; invalid or legacy provider modes stop instead of silently showing mock data.
- An explicit production environment override causes the local guard to fail.

### Local review API

The Vite `/internal-api/*` review endpoints accept only loopback connections
using a loopback hostname and the actual dev server port. Review the site at
`http://localhost:<port>` or `http://127.0.0.1:<port>`. LAN access and forwarded
hosts are rejected. POST requests require the same Origin and JSON content;
request bodies are limited to 128 KiB.

The review client obtains an in-memory capability through the same-origin
`POST /internal-api/session` handshake. It sends that capability in a header,
refreshing once after a server restart. Tokens are not stored in browser storage,
URLs, environment files, or built assets. Local OS processes and scripts remain
inside the trusted boundary; this is not a remote admin authentication service.

Review database access is restricted to full local Supabase on HTTP port 54321
at a loopback address. Remote and rehearsal targets are rejected before sending
the service key, and database redirects are disabled. The review API is available
only through the development server, not preview or deployed static assets.

## Environment selection and overrides

| Purpose | Site | Database / provider |
|---|---|---|
| Normal development and private review | Vite `dev`, normally loopback 5173 | Full local Supabase API 54321 / DB 54322, `published` |
| Approved production-shape validation | Vite `dev:rehearsal` | Disposable rehearsal API 55321 / DB 55322, `published` |
| Isolated UI tests | Dedicated fixtures, or explicit mock build/preview | No real database, `mock` |
| Production | Worker `public-office-watch`, configured entry `worker/sites-static.js` | Reviewed non-local HTTPS Supabase, `published` |

The repository's production build is Workers + Static Assets via
`apps/web/wrangler.jsonc`, not Pages or Sites. It disables `workers.dev` and preview
URLs; custom-domain routing and Access are remote configuration to verify separately.
Repository files describe the intended deployment, not the live deployed revision.

Frontend checks merge their selected env file with process overrides. The local
participation proxy separately reads `.env.local`, `.dev.vars`, then process env.
Internal review's service key comes from root `.env.local` or process env. An env
file's presence does not prove which database a running process uses. Rehearsal
must be rebuilt and verified as described in [its runbook](production-rehearsal.md).

## 開發分支與批次發布流程

2026-09-12 定案：**功能／修正分支 → 暫時 release 整合分支 → PR → main → 自動部署 → production smoke**。保留現有自動 CD，將發布決策放在 release PR 合併前；不改採「功能逐一進 main，日後才手動發布」。本節是流程的維護來源，其他文件及跨任務筆記只保留入口。

| 分支角色 | 用途與界線 |
|---|---|
| `main` | 正式發布基準，只接受經審核的 release 或 hotfix PR；不從本機直接 push。合併會啟動自動發布流程。 |
| `release/*` | 從最新 `origin/main` 建立的短期整合版本，只納入這批要發布的功能；處理整合衝突、必要整合修正與驗證，不持續開發無關新功能。 |
| `feature/*`、`fix/*` | 各自從最新 `origin/main` 建立，承載單一功能或修正；完成自身測試與 review 後才納入 release。 |
| `hotfix/*` | 從最新 `origin/main` 建立的正式故障修正，可直接 PR 到 main，仍需適用檢查與發布授權。 |

表內是角色名稱。Codex 新分支預設保留 `codex/` 前綴，例如 `codex/feature/<topic>`、`codex/release/<date>`；使用者指定名稱時依指定名稱。既有分支不必為命名而重建。 沿用既有功能／UIUX 分支時先核對未提交與未合併工作，不為每次小修改自動 fetch／merge。需要建立新功能分支或準備整合發布時，才更新遠端資訊並確認 `origin/main` 基準；同步後處理衝突並驗證。多項工作同時進行時使用各自 worktree，避免把同一份 dirty 工作目錄誤當成互相隔離的分支。有功能依賴時明列並一起評估整合順序，不偷偷帶入未納入本批的功能。

### 一般發布

1. 在功能分支完成實作、適用測試與功能 review。可先推送備份或供 review，不強制每個功能都另開一份 PR 到 release。
2. 確認發布清單與依賴，從最新 `origin/main` 建立 release，再整合選定功能。未完成、未核准發布或僅供 local 使用的工作不因「已 commit」就自動列入；`/internal/data-progress` 目前維持 local 專用，正式版是否提供及呈現方式另定。
3. 執行整合 review 與適用的 lint、typecheck、unit／contract、瀏覽器、安全界線、migration drift 和建置。明列通過、失敗、未執行及不適用；單一功能測試通過不代表整批通過。
4. 有 migration 時，依既有環境規則完成演練、相容性與恢復方案；獲准的正式 migration 另行套用，再進入發布 PR／CI／合併。需要 Worker-first 等特殊順序時，另訂明確的分階段方案，不跳過 drift gate。
5. 推送 release，開一份 **release → main** 的發布 PR，記錄本批內容、依賴、測試、migration 與回復限制。核對目前 PR head 的 CI／review；main 或整合內容改變後重新同步並驗證。合併前確認授權包含正式發布，不把 commit、push 或開 PR 的要求擴大成 merge／部署授權。
6. 合併後追蹤該 merge commit 的 `Web CI` → `Production Release` → migration drift → Cloudflare build／Wrangler dry-run → deploy → production smoke。確認實際 Worker version、流量及來源 SHA，才記為發布成功。
7. 成功部署且 smoke 通過後，將 release tag 指向**實際部署的 commit**，例如 `vYYYY.MM.DD`；同日多版使用不重複尾碼，不覆寫既有 tag。保留 PR、commit、CI、部署版本與驗收紀錄。
8. 清理本批已合併且已發布的 feature／fix／release 分支及不用的 worktree。刪除前逐一確認沒有未合併 commit、dirty 檔案、開啟中的 PR 或進行中的工作；保留未發布及 local-only 工作，不為「只剩 main」刪掉其他成果。

功能 review 檢查單一變更；release review 檢查多個變更放在一起後的行為，以及整批上線條件。

### Hotfix 與實際部署狀態

緊急修正走 **hotfix → PR → main → 自動部署 → smoke**，不必另繞 release。成功後，進行中的 release 必須同步 main 中的 hotfix，並重做受影響驗證；不要改寫他人已使用的分支歷史。

`main = production` 是工作流程的目標，不是免驗證的事實。排隊、部署失敗、smoke 失敗、跳過過期版本或 rollback 都可能造成差異；此時分開記錄 main SHA 與實際 Worker version。CI 綠燈、PR 已 merge 或已有 tag 都不能單獨證明已上線。沿用下方 smoke 失敗處置；現有流程沒有自動 rollback。

目前程式碼確認：`web-ci.yml` 在 PR 與 main push 執行，**單純 push feature 不會自動取得 Web CI**；需要遠端檢查時可開適當 PR，或另行規劃觸發範圍。`production-release.yml` 已保留 main push 的成功 Web CI 後自動發布及手動備援入口，且只檢查 migration drift、不自動套用 migration。本次只記錄流程，未變更 GitHub Actions、遠端 main 保護／ruleset、tag 自動化或刪分支設定；發布時須核對遠端 main「只接受 PR」限制確實生效。

### 現任公職更新與延後版本範圍

2026-09-21 決定：取消先前延後版本中「依任期日期自動切換現任公職」的功能。現任資料於交接或人事異動時，由維護者核對官方名冊與生效資料後批次更新，不因系統日期到期自動升任或卸任。

`codex/hold/office-release-2026-09-13` 保留作歷史參考；後續整合不得直接帶回其中的 `candidate_holds_office`、`office_is_current` 日期推算及相關現任切換邏輯。政見投票開放時間由 `20260921120000_platform_votes_after_inauguration.sql` 獨立處理；本機驗證不等於正式發布。此次決定不變更既有當選紀錄，也不代表已更新任何人物的現任資料。

## Production Cloudflare Worker releases

`supabase/migrations` remains the CLI-tracked release history. The local review
RPC is installed separately from `supabase/local-migrations` using the
[local-only installer](review-workflow.md#自動審核的資料庫前置與恢復); it is not a
website prerequisite, seed, or second migration ledger. Do not copy it into a
production release or record it as applied remotely to bypass drift checks.
The birth-date display setting migration remains in the release history because
the public frontend and update-admin Edge Function depend on it.

- Production values are stored in the GitHub `production` environment. Do not copy them into `.env.local` or commit them.
- Variables: `VITE_SUPABASE_URL`, `VITE_TURNSTILE_SITE_KEY`, and `SUPABASE_PROJECT_REF`.
- Secrets: `VITE_SUPABASE_ANON_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID`.
- Frontend credentials must use the public anon key, never a service-role key.
- A successful `Web CI` push run on `main` automatically starts `Production Release` for that exact commit. A manual `main` dispatch remains available as a fallback.
- Automatic releases reuse the completed CI checks; manual fallback releases rerun read contracts and lint. Both paths check production migration drift, build and validate the Worker bundle, deploy it, then run the production browser and SEO smoke suite.
- Before deployment, the release workflow confirms its commit is still the tip of `main`; stale queued releases are skipped instead of overwriting a newer deployment.
- The release workflow does not apply migrations. Review and apply pending migrations separately before starting it; any remaining drift blocks deployment.
- The Worker build uses `VITE_PUBLIC_DATA_PROVIDER=published`, `VITE_ENABLE_PUBLISHED_PROVIDER=true`, and `npm --prefix apps/web run build:cloudflare`.

## Historical participation transitions

The migrations `20260827094616_use_server_issued_anonymous_participant.sql` and
`20260827102924_require_participation_write_proxy.sql` changed participant identity
and required the write proxy. Their original coordinated migration/Worker release
was a one-time transition, not a step to replay for every release. Do not reverse
old participant hashes into identities; preserve the documented statistical
limitation when validating an environment that still needs this transition.

The proof-v2 transition introduced dual signatures in the Worker, followed by
`20260830184447_harden_participation_proxy_proofs.sql`, which requires body-bound
v2 proof and consumes each request ID once. In an environment still on the old
proof, the compatible dual-signature Worker must be live before that migration.
This section does not assert any environment's current migration status.

The ordinary release workflow checks **all pending migrations before deploy**.
Therefore, a checkout already containing the unapplied v2 migration cannot use
that workflow to perform the Worker-first transition: drift blocks it. Prepare a
separately reviewed staged rollout, for example a compatible Worker release before
introducing the requiring migration into the release checkout, then apply the
migration and verify participation. Do not remove or bypass the drift gate, fake
migration history, or apply the requiring migration before the compatible Worker.

## Production smoke

Set `PLAYWRIGHT_BASE_URL` to the deployed HTTPS URL and provide the same public production Supabase environment used for the build. Then run:

```bash
npm --prefix apps/web run test:browser:production
```

The production smoke suite does not start a local server. It verifies critical
routes, real People and election data, search, the configured Supabase origin,
CSP/HSTS response headers, the homepage RPC latency threshold, and the absence of
Supabase request failures. Before a release, smoke against the existing live site
only validates that existing version. The workflow's post-deploy smoke validates
the newly deployed site; failure marks the run failed after deployment has already
happened. There is no automatic rollback step. Stop further releases, inspect the
failure, and use the separately authorized recovery procedure for the affected
Worker/database compatibility state.

GitHub production-environment approval rules and actual deployment results must
be checked remotely when releasing. A green Web CI or current local `main` does
not establish which Worker version is live.

### Feedback administration (`/internal/feedback-admin`)

Feedback administration uses the database of the current website environment. Local
and hosted environments remain isolated: no production feedback connection, summary
bridge, production credential, or status synchronization is added to local
`review-queue` or `data-progress`. `feedbackEnvironmentMatches()` rejects a local
browser configured with a hosted database, and a hosted browser configured with a
loopback database, before creating the feedback authentication client.

The page reuses the administrator Magic Link session. The `feedback-admin` Edge
Function verifies the bearer token through `auth.getUser()` and requires the
server-owned `app_metadata.chat_admin === true`; its service-only
`public.admin_feedback()` RPC checks the administrator against `auth.users` again.
The function is configured with `verify_jwt = false` because authentication is
performed inside the handler, as with `update-admin`. No management RPC is granted
to `anon` or `authenticated` and feedback history has RLS enabled with no public
read policy. The API has no people, Claims, merge, or publication action.

Release prerequisites, to be completed in the release workflow before frontend
publication:

1. Rehearse `20260912112359_feedback_admin_workflow.sql` against the production
   baseline. The checked-in rollback test is `tests/sql/feedback-admin.sql`.
2. After production migration authorization, apply that migration, then deploy
   the `feedback-admin` Edge Function to the same Supabase project as the website.
   The web deployment does not automatically deploy this function or apply SQL.
3. Verify the Auth redirect allowlist includes the exact production
   `/internal/feedback-admin` URL, and the administrator account has the existing
   `chat_admin` permission. Local callbacks remain local; do not add local callback
   URLs to production to work around environment isolation.
4. Test signed-out/ordinary users (401/403), administrative paging, save conflicts,
   resubmissions, immutable history and public feedback-count compatibility before
   merging the frontend release PR. After deployment, smoke the actual deployed SHA.

The four persistent sections represent pending, accepted/high, accepted/normal and
rejected decisions. Accepted items have independent pending/in-progress/completed
work status; completed items stay editable and sort after unfinished items.
Legacy `verified` and `published` feedback migrate to accepted/normal/pending:
neither legacy label proves that the reported data was fixed or published.
`review_status` remains a compatibility projection so rejected requests stay
excluded from existing public supplement counts. Management changes do not reset
the public submission timestamp.

Each save checks `revision` under a row lock and records before/after snapshots with
the verified administrator UUID in the same transaction. The client retains the
same request ID when retrying an uncertain save; mismatched reuse is rejected.
History is append-only. A changed submission adds a content version and reopens
pending while retaining previous notes and history; identical submissions only
record their count/time and do not reset the decision or priority. Administration
never overwrites user text or evidence. Baseline histories capture only the state
available at migration time, not earlier unknown edits.

Feature validation: the SQL test runs inside a rollback-only local transaction;
`feedbackAdminEndpoint.test.mjs` covers authorization and error boundaries;
`feedbackEnvironment.test.ts` covers environment separation; `feedbackAdmin.pw.ts`
uses synthetic services to exercise the real UI at phone and desktop widths.
These tests do not substitute for the authorized migration rehearsal, Edge Function
deployment, real Magic Link/SMTP verification, CI, or production smoke.

Development verification on 2026-09-12:

- Passed: frontend build, scoped ESLint, feedback endpoint authorization/error tests,
  local/hosted environment guard tests, internal-route SEO tests, rollback-only SQL
  tests (including real upsert and independent paging), and 3 synthetic browser
  tests covering 390px/1280px layouts and signed-out access.
- Fixed during verification: ambiguous SQL alias, synthetic auth fixture syntax,
  and textarea labels that prevented reliable reopening/editing. Reruns passed.
  The initial sandbox browser launch could not bind a loopback port; the authorized
  local test rerun passed. Existing Vite configuration/chunk-size warnings remain.
- Not run: real Magic Link delivery, a served Edge Function against a persistent
  test database, production baseline rehearsal/application, remote CI or production
  deployment/smoke. No production data or credentials were accessed for this feature.

Local runtime follow-up on 2026-09-12: the feedback branch website is served at
`http://127.0.0.1:5181`. Migration `20260912112359` was applied transactionally to
`supabase_db_public-office-watch`, recorded in its local migration ledger, and the
PostgREST schema cache was reloaded. `supabase functions serve` now runs from this
worktree. Verified: the running feedback endpoint rejects unauthenticated requests
with HTTP 401 / `FEEDBACK_AUTH`; the database dashboard RPC returns all four groups
for the existing local administrator. This is not an authenticated browser
end-to-end result; verification with the user's normal signed-in browser is pending.
No production changes were made.


### PR #51 review corrections (2026-09-13)

The release branch retires `/internal-api/review-person-feedback` with HTTP 410;
feedback writes must use the authenticated, revisioned `feedback-admin` workflow.
Conflict resolution compares the original, edited and latest management fields.
Untouched fields adopt the latest value, while overlapping edits require an explicit
choice. Decision, priority and work progress resolve together to remain valid.
All detail, save, conflict and history requests discard responses after a session
change; the editor also requires ready administrator access.

Validation on the integrated release: script tests 475 passed; frontend read
contracts 415 passed and 7 environment-dependent integration tests skipped;
feedback browser scenarios 7 passed (390px, 1280px, conflict merge, delayed detail,
save, conflict detail and history responses after sign-out). Lint, build and
static exposure checks passed. The legacy DB contract check skipped without DB
environment variables; that is not a database pass.

Follow-up: repeated `SIGNED_IN`, `TOKEN_REFRESHED` or `USER_UPDATED` events for the
same user and JWT `session_id` revalidate access without clearing the editor.
The session key is only a UI lifecycle identifier, never authorization. A new
user/session, sign-out, malformed session, or server 401/403 still clears state
and invalidates pending responses. The updated feedback browser suite passed all
9 cases, including refocus/token renewal draft retention and account/new-session
changes with delayed responses; lint and production build also passed.


Release scope update (2026-09-13): office-term and platform-voting changes are deferred by owner decision. The complete candidate is preserved on `codex/hold/office-release-2026-09-13`; current release does not apply its migrations or office data packages. See `docs/releases/2026-09-13.md` for the reduced release scope.
