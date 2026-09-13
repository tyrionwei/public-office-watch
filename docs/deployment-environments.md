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


### PR #51 review corrections (2026-09-13)

The release branch retires `/internal-api/review-person-feedback` with HTTP 410;
feedback writes must use the authenticated, revisioned `feedback-admin` workflow.
Conflict resolution compares the original, edited and latest management fields.
Untouched fields adopt the latest value, while overlapping edits require an explicit
choice. Decision, priority and work progress resolve together to remain valid.
All detail, save, conflict and history requests discard responses after a session
change; the editor also requires ready administrator access.

The original family cache refresh in `20260913073155` is superseded by
`20260913084244_publish_reviewed_office_terms.sql`: expensive family derivation now
runs locally, while approved terms drive public date comparisons. See the workflow
below for its independent data-release gate.

Validation on the integrated release: script tests 475 passed; frontend read
contracts 415 passed and 7 environment-dependent integration tests skipped;
feedback browser scenarios 7 passed (390px, 1280px, conflict merge, delayed detail,
save, conflict detail and history responses after sign-out). Lint, build and
static exposure checks passed. The legacy DB contract check skipped without DB
environment variables; that is not a database pass.

Historical validation: the old full-local-family computation exceeded 180 seconds
inside `office_status_rows_for`; its bounded one-person regression passed, but did
not establish whole-family capacity. The new workflow removes that operation from
production. Its tests and full local export evidence are recorded below.


Follow-up: repeated `SIGNED_IN`, `TOKEN_REFRESHED` or `USER_UPDATED` events for the
same user and JWT `session_id` revalidate access without clearing the editor.
The session key is only a UI lifecycle identifier, never authorization. A new
user/session, sign-out, malformed session, or server 401/403 still clears state
and invalidates pending responses. The updated feedback browser suite passed all
9 cases, including refocus/token renewal draft retention and account/new-session
changes with delayed responses; lint and production build also passed.


### Reviewed office release workflow

All research and draft generation use full local Supabase on loopback port 54321.
The CLI cannot connect to production. A production baseline is a separately
authorized, read-only export of `office_release_baseline(uuid[])`; do not repoint
local `.env` or internal review APIs. Export only the selected IDs, retaining the
same release ID and office revision across pages. A local baseline is for local
rehearsal only and must not be presented as a production baseline.

```sh
node scripts/office-release.mjs source --family local --output tmp/office-release/source.json
node scripts/office-release.mjs baseline-local --source tmp/office-release/source.json --output tmp/office-release/baseline.json
node scripts/office-release.mjs draft --source tmp/office-release/source.json --baseline tmp/office-release/baseline.json --as-of 2026-09-13 --output tmp/office-release/draft.json
```

Families: `president`, `legislator`, `local`. Each selected person must include all
published elected candidacies, including other families. Invalid or missing terms,
unknown departure dates and missing evidence block that person. The preview contains
before/after office fields; `blocked` explains exclusions. Drafts are private and
are not approvals. Review the actual sources, titles, dates and conflicts, then
create a private review JSON with `draftHash`, `reviewedBy`, `reason` and an explicit
`approvedPersonIds` array (1–500 people). Editing the draft invalidates approval.

```sh
node scripts/office-release.mjs build --draft tmp/office-release/draft.json --review tmp/office-release/review.json --output tmp/office-release/package.json
```

This writes a payload, `.sql` and `.rollback.sql`, without applying anything. After
explicit release authorization, apply only that SQL to the verified target. The
transaction checks the public release, office revision, selected-person fingerprints,
public elected candidacies, evidence and the office-field whitelist; any conflict
aborts the whole package. No `promote()` or private profile refresh is invoked.
A successful package refreshes the directory snapshot atomically. Later reads compare
approved dates in Asia/Taipei, without requiring an annual/full-table cron.

Rollback is limited to the latest office package on the same public baseline and
expected office revision. It restores previous profiles/terms and refreshes the
snapshot, retains history and advances the revision. If another package or general
release intervened, stop and prepare a fresh reviewed correction instead of forcing
an old rollback. A production restore is independently authorized.

Before production release: rehearse the schema and first office package against the
approved production baseline, verify expiry, early departure, person/directory/home
consistency, voting dates, read permissions, refresh costs and rollback. Audit first
package coverage: unmanaged people still use the legacy office presentation; do not
claim migration complete until existing supported current offices have approved terms
or an explicitly reviewed unresolved outcome. This change includes no automatic
approval of local public-report repairs and no production data package.

Validation entrypoints: `node --test scripts/office-release.test.mjs`; SQL regressions
`tests/sql/reviewed-office-release.sql` and `scripts/sql/annual-office-refresh-regression.sql`.
Run the SQL only in a local/rehearsal rollback transaction after the release schema.
The former also tests denied browser mutations, baseline rejection, no non-office
profile changes, known expiry, public projections and versioned rollback.


Local evidence (2026-09-13): the complete local-family export finished with 16,347
people. The draft has 14,146 eligible and 2,201 blocked people; these are source
readiness counts, not approvals. Missing/unknown term dates and an unresolved
presidential ticket role account for exclusions. The original nine CLI tests passed. The
installed-schema transaction regression and fixed-date calendar regression passed.
A rollback-only 500-person real-shaped package took 2.738 seconds to apply (including
directory refresh), 37.630 ms to read anonymous current-office counts, and 307.156 ms
to restore. This is full-local evidence, not a production-baseline capacity result.
No office package was retained; production schema/data and release rehearsal remain
unchanged/unexecuted. Local schema is installed for development on port 54321, and
the release website continues at port 5173.

For a shared `president` race, race type alone cannot distinguish president from
vice president. The source must include `office_role` and a reviewed
`role_source_url`; otherwise the person is blocked. Do not infer an older ticket's
role from a person's current title. Legislative leadership and other appointments
also need their own term evidence before replacing those current-office labels.

The nationwide presidency panel uses the same approved terms. When a known term
ends and no unique approved successor exists, it shows `unknown` / 資料待更新,
not the old holder or an assertion of vacancy. Other institutional appointments
remain on their separate workflow. Existing candidacy presentation is retained
until a reviewed future winner reaches inauguration.

Broader validation: 483 script tests and 21 Python cases passed after rerunning
outside the sandbox's local-listener restriction; the final ninth office unit case
also passed. The first sandbox run failed two existing suites (local listener /
mock process restrictions), not the office logic. Web read contracts, lint, build,
data-boundary and published-exposure checks passed; the existing direct mock import
and large bundle warnings remain. No production or production-baseline rehearsal
was performed.


Review follow-up: migration `20260913104427_fix_reviewed_office_candidacy_and_dependencies.sql`
adds live published candidacy composition and rebinds the candidate views to the
approved-term function OIDs. The release now includes this additional migration.
Regenerate the target baseline and draft: a `candidacyContextVersion: 1` baseline
is required, and old drafts cannot be built into new packages. Live candidacy
context is preview input only; it is not copied into the office payload.

Two cross-flow SQL attempts joined candidate views to a temporary fixture and
timed out at 60 seconds in the legacy source helper for unrelated rows. The
final regression uses literal person and candidate filters, retains the real
view/function implementation, and passes under service_role. This is not a
passed unrestricted legacy-view capacity test.

The final cross-flow transaction regression passed: no remaining view dependencies
on either source-copy OID, approved early departure through both candidate views,
current candidacy ahead of expired terms, withdrawal/loss updates without another
office package, and returning winner status before/on inauguration. All test data
rolled back. Ten office CLI tests passed. The migration is installed only in full
local Supabase; no production schema/data was changed.

An initial live-context capacity run read current-office totals in 11.059 seconds:
the per-person context rebuilt public race display/canonical facets. The final
query uses published candidate IDs, indexed core date/status lookups and the same
public election/race/region visibility guards, without reading private candidate
facts. The 500-person rollback run now applies in 2.100 seconds, reads totals in
116.379 ms and restores in 267.419 ms. The CLI baseline also returned the new
versioned candidacy context. These measurements are local, not production capacity.
