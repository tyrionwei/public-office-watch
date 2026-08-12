# Public repository threat model

Status: baseline for pre-production review, 2026-08-12.

## Security premise

Treat the repository, build output, migration history, route names, RPC names,
table/view names, client-side limits, and admin UI flow as fully known to an
attacker. None of them is an authentication factor.

The browser-facing Supabase publishable/anonymous key is expected to be visible.
Its safety depends on explicit database grants, RLS, server-side checks, and a
small reviewed API surface. Privileged keys and passwords must never appear in the
repository, browser bundle, issue tracker, Actions output, preview artifacts, or
client-visible environment variables.

## Assets to protect

- unpublished, rejected, quarantined, and internal-review records;
- user identity, moderation state, feedback details, and non-public metadata;
- integrity of published election, office-holder, legal, and company data;
- Supabase service-role keys, database passwords, GitHub tokens, and Cloudflare
  credentials;
- administrator sessions, magic links, and privileged maintenance functions; and
- availability and predictable cost of chat, feedback, Realtime, search, and
  import/synchronization jobs.

## Expected attacker capabilities

Assume an unauthenticated attacker can:

- clone every branch and inspect the complete Git history;
- enumerate browser routes and call Supabase APIs directly without visiting the
  Cloudflare-hosted site;
- alter JavaScript, headers, identifiers, timestamps, and request order;
- create many anonymous sessions, replay calls, distribute traffic across IPs,
  and ignore every client-side cooldown;
- inspect source maps, preview builds, browser storage, network requests, error
  messages, and public Actions logs;
- submit malicious text and URLs that will later be viewed by users or admins;
- study exact rate limits and stay just below them; and
- propose or compromise dependency, workflow, migration, and synchronization
  changes that would execute after merge.

## Required security invariants

1. Anonymous users can read only the reviewed `published` surfaces and can invoke
   only explicitly reviewed compatibility/write functions.
2. Every write is authorized and constrained on the server. Browser checks are
   usability features only.
3. Every privileged request revalidates the authenticated user and authorization;
   knowing an `/internal/*` route or changing local storage grants no privilege.
4. `SECURITY DEFINER` functions have an explicit safe `search_path`, narrow
   execute grants, and internal authorization where required.
5. Cloudflare controls are defense in depth. Direct Supabase endpoints retain
   equivalent abuse protection because they bypass the Pages-domain WAF.
6. Untrusted content is rendered as text or sanitized with an allowlist. External
   URLs use reviewed protocols and do not become executable markup.
7. Workflows receive only the minimum token permissions. Production secrets are
   available only to reviewed jobs and steps, never to pull-request code.
8. Logs and artifacts omit secrets, full connection strings, magic links, session
   tokens, and unnecessary personal data.
9. A leaked privileged credential is rotated and invalidated; deleting it from the
   latest commit is not sufficient because Git history is public.
10. Security tests verify denial paths as well as successful public behavior.

## Trust boundaries

### Browser to Cloudflare Pages

Cloudflare supplies TLS, browser response headers, Access for internal pages, WAF,
and site-level rate controls. It cannot protect requests sent directly from the
browser or attacker to Supabase.

### Browser to Supabase

This is an internet-facing API boundary. Grants, RLS, RPC authorization, server-side
rate limits, Auth settings, Realtime publication, and storage policies must hold
without Cloudflare. Do not trust forwarded client-IP headers unless they were set
by a controlled proxy and the direct path is closed or safely handled.

### GitHub Actions to production

The weekly synchronization job can receive a service-role key. A malicious change
merged into executable repository code could attempt to exfiltrate it. Protect
`.github/`, `scripts/`, lockfiles, and Supabase migrations with branch rules,
CODEOWNERS review, a production environment approval, and pinned third-party
actions before production credentials are attached.

## Abuse cases to retest before launch

- Direct calls to retired `public` views and RPCs with the public key are denied.
- Modified user IDs, moderation roles, message ownership, and timestamps do not
  bypass server authorization.
- Anonymous account creation, chat, feedback, and region participation cannot be
  automated at an unacceptable rate or cost.
- HTML/script payloads and unsafe URL schemes remain inert in public and admin UI.
- Realtime does not reveal rows that normal reads would deny.
- Error responses do not reveal SQL text, internal identifiers, stack traces, or
  secrets.
- Preview deployments and `/internal/*` cannot be indexed or used as an alternate
  unprotected production entry point.
- A pull request from a fork cannot read production secrets or obtain write-capable
  repository permissions.

The executable launch gate is maintained in
[`prelaunch-security-checklist.md`](prelaunch-security-checklist.md).
