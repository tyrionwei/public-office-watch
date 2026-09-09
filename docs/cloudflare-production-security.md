# Cloudflare production security checklist

This document records Cloudflare-specific implementation details. The executable
launch gate, owners, timing, and verification evidence are tracked in
[`prelaunch-security-checklist.md`](prelaunch-security-checklist.md). The design
assumes the attacker has read the
[`public repository threat model`](public-repository-threat-model.md).

## Repository controls

- The repository's deployment path is Worker `public-office-watch` with Static Assets, configured by `apps/web/wrangler.jsonc`; the asset output is `dist/cloudflare`.
- Use the reviewed [Production Release workflow](../.github/workflows/production-release.yml) and [environment/release runbook](deployment-environments.md). It runs `build:cloudflare`, Wrangler dry run, current-main verification, deploy, then post-deploy smoke.
- Check Worker-generated security headers and the built static-asset `_headers`; a local output file alone does not prove headers served by the deployed version.
- Production uses only the reviewed `published` Supabase interface.
- Never place the Supabase service-role key, database password, or server secrets in a `VITE_*` variable.

## Cloudflare dashboard controls

Verify these controls in the intended account when preparing an authorized release; repository wording is not evidence that a dashboard policy is active:

- Set SSL/TLS encryption to Full (strict), enable Always Use HTTPS, TLS 1.3, and a minimum TLS version of 1.2.
- Enable HSTS only after every affected hostname works permanently over HTTPS. Start without `includeSubDomains` or preload unless every subdomain is ready.
- Keep `workers.dev` and Worker preview URLs disabled as configured, or separately review Access protection before enabling alternate entry points.
- Verify the canonical `pow4vote.org` custom-domain route and DNS in the Cloudflare account.
- Protect `/internal/*` with Cloudflare Access. Test magic-link callbacks after enabling it because administrators will pass both Access and Supabase authentication.
- Enable appropriate managed WAF rules and review Security Events before changing actions from log or challenge to block.
- Add a conservative rate-limit or managed challenge for abusive requests to the public site, excluding verified search bots where SEO matters.

## Response headers

The Worker `addSecurityHeaders` implementation and `apps/web/public/_headers` define:

- clickjacking protection;
- MIME sniffing protection;
- restrictive browser feature permissions;
- no-store and no-index behavior for `/internal/*`;
- a compatibility-safe CSP baseline that blocks plugins, framing, and `<base>` injection.

Review CSP changes against the Worker policy and actual approved origins, including Supabase HTTPS/WebSocket, Turnstile, login callbacks and public images. Verify served headers after deployment; changing a static file alone may not change a Worker-generated response.

## Supabase origin limitation

Public reads connect directly to Supabase. The participation routes under
`/api/participation/*` go through the Worker for challenge/clearance validation,
authorization, rate limits and signed RPC proofs. Direct Supabase API, Auth,
Realtime or Edge Function requests are outside the site's Cloudflare request path
and still need their own database/service authorization controls. Do not infer
that protecting the website domain protects every direct Supabase endpoint.

Worker runtime secrets and frontend build variables are separate. Required
participation runtime names are listed in the README; provision only reviewed
server secrets, and verify Vault proof-key consistency without logging either
value. The historical proof-v2 rollout order and normal migration-drift gate are
explained in [deployment-environments.md](deployment-environments.md#historical-participation-transitions).

## Supabase production controls

### Participation request body limit

The participation Worker and Vite development proxy enforce a 16,384-byte
request body limit during reading. Declared oversized bodies return 413 before
reading; absent or understated `Content-Length` still receives the streamed byte
check. A malformed length or invalid UTF-8/read failure returns 400. JSON must be
an object. The Worker cancels the reader on rejection; the dev proxy stops its
iterator and sends `Connection: close` so a rejected upload is not buffered or
drained. Both use fixed-capacity byte storage, including for many small chunks.

`apps/web/tests/participation-body.test.mjs` exercises both paths without external
services. These are local source guarantees, not confirmation of a deployed
Worker version or dashboard configuration.

### Database configuration

- Deploy all reviewed security migrations before deploying the frontend that depends on them.
- Expose only `public`, `graphql_public`, and `published` in the Data API configuration; browser grants in `public` must remain limited to explicitly reviewed compatibility functions.
- Set exact production redirect URLs for `/internal/chat-admin` and `/internal/update-admin`; do not allow wildcard redirect domains.
- Restrict admin Edge Function CORS to the final production and approved preview origins after those hostnames are known.
- Keep anonymous sign-in enabled only while public chat requires it.
- Rotate any credential that was ever copied into an issue, build log, or client-visible variable.
- Run the Supabase security advisor and anonymous API contract checks after every migration deployment.

## Release verification

- Verify response headers on the canonical custom domain and `/internal/*`; confirm alternate Worker entry points remain disabled or have separately reviewed protection.
- Verify old public views and RPCs return 401, 403, or 404 with the public key.
- Verify all reviewed `published` reads and writes return the expected responses.
- Test chat, feedback, region issue submission, Supabase magic links, Realtime, external images, canonical URLs, and SEO metadata.
- Run the production Playwright smoke suite against the custom HTTPS domain.
- Confirm Cloudflare Access, WAF, and rate-limit events are visible without blocking normal users.
