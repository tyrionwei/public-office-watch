# Frontend environment separation

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
