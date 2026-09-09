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
