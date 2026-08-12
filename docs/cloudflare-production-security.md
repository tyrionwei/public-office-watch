# Cloudflare production security checklist

This document records Cloudflare-specific implementation details. The executable
launch gate, owners, timing, and verification evidence are tracked in
[`prelaunch-security-checklist.md`](prelaunch-security-checklist.md). The design
assumes the attacker has read the
[`public repository threat model`](public-repository-threat-model.md).

## Repository controls

- Deploy `apps/web` as a Cloudflare Pages project with output directory `dist`.
- Use `npm run check:production-env && npm run build` as the build command.
- Confirm `dist/_headers` exists after the build.
- Production uses only the reviewed `published` Supabase interface.
- Never place the Supabase service-role key, database password, or server secrets in a `VITE_*` variable.

## Cloudflare dashboard controls

Before the custom domain receives traffic:

- Set SSL/TLS encryption to Full (strict), enable Always Use HTTPS, TLS 1.3, and a minimum TLS version of 1.2.
- Enable HSTS only after every affected hostname works permanently over HTTPS. Start without `includeSubDomains` or preload unless every subdomain is ready.
- Protect Pages preview deployments with Cloudflare Access.
- Redirect the production `*.pages.dev` hostname to the canonical custom domain.
- Protect `/internal/*` with Cloudflare Access. Test magic-link callbacks after enabling it because administrators will pass both Access and Supabase authentication.
- Enable appropriate managed WAF rules and review Security Events before changing actions from log or challenge to block.
- Add a conservative rate-limit or managed challenge for abusive requests to the public site, excluding verified search bots where SEO matters.

## Response headers

`apps/web/public/_headers` currently enforces:

- clickjacking protection;
- MIME sniffing protection;
- restrictive browser feature permissions;
- no-store and no-index behavior for `/internal/*`;
- a compatibility-safe CSP baseline that blocks plugins, framing, and `<base>` injection.

Do not add a strict `default-src`, `connect-src`, or `img-src` policy until staging has the final custom domain and exact Supabase project URL. An incomplete policy would break Supabase HTTPS/WebSocket traffic, magic-link login, or externally hosted public photos.

## Supabase origin limitation

The browser currently connects directly to the Supabase project domain. Cloudflare WAF and rate-limit rules on the Pages domain do not protect those direct Data API, Auth, Realtime, or Edge Function requests.

Before a high-traffic launch, choose one of these controls for write endpoints:

1. Proxy chat, person feedback, and region participation writes through a Cloudflare Worker and validate Turnstile there; or
2. keep direct Supabase calls and add equivalent server-side abuse controls in Supabase Edge Functions.

This is an architecture change, not a dashboard toggle. It changes API URLs, CORS, trusted client IP handling, failure behavior, and monitoring, so it requires staging and dedicated regression tests.

## Supabase production controls

- Deploy all reviewed security migrations before deploying the frontend that depends on them.
- Expose only `public`, `graphql_public`, and `published` in the Data API configuration; browser grants in `public` must remain limited to explicitly reviewed compatibility functions.
- Set exact production redirect URLs for `/internal/chat-admin` and `/internal/update-admin`; do not allow wildcard redirect domains.
- Restrict admin Edge Function CORS to the final production and approved preview origins after those hostnames are known.
- Keep anonymous sign-in enabled only while public chat requires it.
- Rotate any credential that was ever copied into an issue, build log, or client-visible variable.
- Run the Supabase security advisor and anonymous API contract checks after every migration deployment.

## Release verification

- Verify response headers on the custom domain, `*.pages.dev`, preview URLs, and `/internal/*`.
- Verify old public views and RPCs return 401, 403, or 404 with the public key.
- Verify all reviewed `published` reads and writes return the expected responses.
- Test chat, feedback, region issue submission, Supabase magic links, Realtime, external images, canonical URLs, and SEO metadata.
- Run the production Playwright smoke suite against the custom HTTPS domain.
- Confirm Cloudflare Access, WAF, and rate-limit events are visible without blocking normal users.
