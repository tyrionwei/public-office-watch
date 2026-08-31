# Pre-launch security checklist

Status: **deferred launch gate**. Complete and record evidence for every P0 item
before the production custom domain receives traffic. The project owner owns
dashboard/account changes; the developer performing the release owns repository,
migration, and regression checks.

This checklist assumes attackers have read the complete public repository. See the
[`public repository threat model`](public-repository-threat-model.md) and the
[`Cloudflare production checklist`](cloudflare-production-security.md).

## P0 — GitHub and software supply chain

- [ ] **Enable private vulnerability reporting.** Owner, before announcing the
  repository. Verify the Security tab offers “Report a vulnerability” from a
  logged-out/non-maintainer account, then add the staffed contact/SLA to
  `SECURITY.md`.
- [ ] **Enable secret scanning and push protection.** Owner, now. Verify GitHub
  reports no open alerts and blocks a test credential pattern on a temporary
  branch. Public repository scanning includes Git history, but every real alert
  still requires immediate credential rotation.
- [ ] **Review repository and history for secrets.** Developer, before first
  production secret is created. Verify only placeholder `.env.example` files are
  tracked. If a real credential ever appeared, rotate it first; history rewriting
  is cleanup, not remediation.
- [ ] **Protect `main`.** Owner, before adding production secrets. Require pull
  requests, at least one approval, Code Owner review, resolved conversations, and
  passing Web/data checks; block force pushes and branch deletion. Verify a direct
  push and an unreviewed sensitive-path PR are rejected.
- [ ] **Create a GitHub `production` environment.** Owner, before enabling the
  write synchronization job. Move `SUPABASE_SERVICE_ROLE_KEY` and production URL
  to environment secrets, restrict deployment branches to `main`, and require an
  owner review. Then add `environment: production` to the write job and verify a
  dry run never receives the secret. This is deliberately not enabled yet because
  it changes the current scheduled/manual workflow.
- [ ] **Pin third-party Actions to full commit SHAs.** Developer, before attaching
  production secrets. Dependabot may propose updates, but review the upstream
  release and commit before merging. Verify no workflow uses only a floating tag.
- [ ] **Review Dependabot alerts weekly.** Owner/developer. Triage reachable
  production vulnerabilities first; do not auto-merge major or workflow updates.
- [ ] **Enable CodeQL/default setup if available.** Owner, before launch. Verify
  JavaScript/TypeScript Actions analysis passes on `main`; document exclusions if
  generated data makes scanning impractical.

## P0 — Supabase production boundary

- [ ] **Deploy the complete reviewed migration sequence.** Developer, staging
  first. Verify migration history is identical and all security-definer access,
  retired legacy API, and `published` API migrations are present.
- [ ] **Review Data API exposed schemas.** Owner/developer. Expose only required
  schemas. Prefer a dedicated API schema; while compatibility requires `public`,
  prove its anonymous/authenticated grants contain only reviewed functions. Verify
  with catalog queries and anonymous contract tests.
- [ ] **Run Security Advisor and RLS/grant audit.** Developer, after the final
  migration. Zero unexplained findings. Verify every internet-reachable table,
  view, function, Realtime publication, storage bucket, and Edge Function has an
  explicit access decision.
- [ ] **Test direct-origin abuse.** Developer, staging. Call Supabase directly with
  the public key and prove retired views/RPCs fail, admin/maintenance functions
  fail, other users' rows fail, and Realtime reveals no extra records.
- [ ] **Add server-side abuse controls to every public write.** Developer, staging.
  Cover anonymous sign-in, chat, feedback, and region participation with durable
  per-user/device/IP or challenge-based controls. Participation proxy proofs must
  bind the normalized RPC body and consume a single-use request ID; client
  cooldowns do not count.
- [ ] **Constrain Auth.** Owner/developer. Use exact Site URL and redirect allowlist;
  require at least 12 characters plus lower/upper-case letters, digits, and symbols;
  enable secure password changes and leaked-password protection in the production
  Auth dashboard; and review anonymous sign-in and email rate limits. Enable TOTP,
  enroll every non-anonymous administrator, and prove sensitive admin sessions have
  reached AAL2. Anonymous participants do not have passwords and are not expected
  to enroll an MFA factor. Also enable CAPTCHA/Turnstile where compatible and test
  magic-link replay/expiry and both internal admin callbacks.
- [ ] **Constrain Edge Function CORS.** Developer, after final hostnames exist.
  Allow only the production origin and explicitly approved previews; verify an
  arbitrary origin cannot read authenticated responses.
- [ ] **Create backup and incident procedures.** Owner. Verify a restore rehearsal,
  credential rotation steps, audit-log access, and a contact who can disable public
  writes without taking public reads offline.

## P0 — Cloudflare production

- [ ] **Use a separate production Pages project and least-privilege API token.**
  Owner. The token must be scoped to the required account/project only and stored
  as a deployment secret, never a `VITE_*` variable.
- [ ] **Configure HTTPS safely.** Owner. Use Full (strict), Always Use HTTPS, TLS
  1.3, and minimum TLS 1.2. Add HSTS only after every affected hostname is verified;
  do not preload or include subdomains prematurely.
- [ ] **Lock alternate entry points.** Owner. Redirect production `*.pages.dev` to
  the canonical domain and protect preview deployments with Cloudflare Access.
  Verify previews cannot be indexed or used to bypass production controls.
- [ ] **Protect `/internal/*` with Access.** Owner/developer, staging first. Require
  the intended administrator identity in addition to Supabase authorization. Test
  both chat/update admin magic-link callbacks; Access is defense in depth, not the
  authorization source.
- [ ] **Enable managed WAF and conservative rate controls.** Owner. Start in log or
  managed-challenge mode, review events, then block only demonstrated abuse. Verify
  public search, accessibility tools, and legitimate crawlers still work.
- [ ] **Decide the direct-Supabase strategy.** Owner/developer. Either proxy public
  writes through a Worker with Turnstile and controlled client-IP propagation, or
  implement equivalent controls in Supabase. This architecture choice requires a
  staging release because it changes URLs, CORS, failure modes, and monitoring.
- [ ] **Finalize CSP after domains are known.** Developer. Add exact `connect-src`,
  `img-src`, and other directives in report-only mode first. Verify Supabase
  HTTPS/WebSocket, magic links, external public images, and analytics before
  enforcement.

## P0 — Release evidence

- [ ] Run the full repository test suite and production build from a clean checkout.
- [ ] Run anonymous/authenticated/admin negative tests against staging and save only
  sanitized results.
- [ ] Run browser smoke tests against the custom HTTPS domain, `*.pages.dev`, an
  approved preview, and `/internal/*`.
- [ ] Verify response headers, canonical URLs, robots behavior, source-map policy,
  CSP reports, Cloudflare security events, Supabase logs, and alert delivery.
- [ ] Confirm no secret or unexpected private/public record exists in the browser
  bundle, build artifacts, logs, Git history, or anonymous API response.
- [ ] Record release date, commit SHA, migration version, Cloudflare configuration
  export/screenshots, reviewer, rollback owner, and incident contact.

## P1 — First 72 hours and recurring work

- [ ] Watch Cloudflare events, Supabase Auth/API/Realtime/Function logs, error rates,
  write volume, anonymous signups, and cost alarms during the first 72 hours.
- [ ] Review GitHub secret/dependency/code-scanning alerts and failed workflows
  weekly.
- [ ] Review Data API grants, RLS, RPC execute permissions, exposed schemas, and
  Realtime publications after every migration.
- [ ] Re-run direct-origin abuse and admin authorization tests after every auth,
  chat, moderation, feedback, or proxy change.
- [ ] Rotate privileged credentials on staff/device/provider change and immediately
  after suspected exposure; rehearse backup restore and incident response quarterly.
