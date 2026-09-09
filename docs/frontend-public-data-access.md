# Frontend Public Data Access

## Current provider

Production and normal local development use the reviewed `published` provider.
`mockPublicDataProvider` remains only as a safe fallback and test fixture when the
published provider is not configured.

Pages and components must read public entity data through `publicDataProvider`.
Direct entity queries belong in the published adapter layer, not in page components.

## Local configuration

```bash
cp apps/web/.env.example apps/web/.env.local
```

Normal development requires local Supabase, the `published` provider/enable flag,
a local public key and Turnstile site key, plus server-only participation proxy
settings. Use the single [local setup guide](local-supabase-validation.md#建立前端本機設定)
instead of copying a partial env list. Frontend `VITE_*` values must never contain
service-role credentials, database passwords or production values for local work.

The factory can select mock when explicitly requested or when published is not
configured/enabled. Normal `dev` and `test:browser` guard against that accidental
configuration; isolated build/fixture paths can intentionally use mock. A configured
published provider's initialization failure is surfaced by the app, not replaced
with private data or silently retried as mock.

## Public boundary

For public entity data, the browser may query only the reviewed `published` schema objects used by
`apps/web/src/lib/publishedReadAdapter.ts`. The authoritative allowlist and
shape checks are the adapter, migrations and these commands:

```bash
npm --prefix apps/web run check:data-boundary
npm --prefix apps/web run check:published-exposure
npm --prefix apps/web run check:public-view-contracts
npm --prefix apps/web run test:read-contracts
```

`check:data-boundary` and `check:published-exposure` inspect source code.
`test:read-contracts` primarily exercises substitutes and skips opt-in DB E2E
unless explicitly enabled. `check:public-view-contracts` is a live **legacy view
retirement** check when configured; absent URL/key produces a successful exit with
an explicit skip message. None alone proves all published RPCs, permissions and
real data shapes. See the [validation matrix](local-supabase-validation.md#驗證矩陣).

Do not duplicate a static table list in this document; it becomes stale whenever a
reviewed public view is added.

The browser must never read raw sources, staging tables, review queues, unpublished
claims, identity candidates, private monitoring artifacts or service-only objects.
Legacy `public_*` views and RPCs are not a rollback path.

The global birth-date display preference is separate runtime configuration.
`src/lib/publicDisplaySettings.ts` reads only `birth_date_year_only`, `revision`
and `updated_at` from the singleton `public.site_display_settings` row. Browser
roles have SELECT only; the authenticated administrator's Edge Function is the
write boundary. Its audit table is not browser-readable. This setting formats
the website's birth-date field and does not redact source claims or public data
APIs. Unknown/failed preference reads display only a recognizable year; visible
person pages refresh every minute and on focus. The entity-adapter exposure
checker does not cover this table; its role/transaction checks are in
`scripts/public-display-settings-local-integration.sql`.

## Identity and saved preferences

`PlatformFulfillmentList` owns results, errors and interaction state for one
claim or party-result identity. Switching identity remounts that state; responses
from the previous instance must not refresh or update the current one. Within
one identity, vote changes and withdrawals run one at a time through the result
refresh. A failed initial load shows an error and retry action, never another
identity's policies or voting controls.

The voting-area editor can save only after the selected district's village
directory has loaded. Failed directory loads preserve the saved preference and
offer a page reload. If a saved village is absent from a successfully loaded
directory, the user must select a replacement or explicitly choose no village.
Changing county or district explicitly clears the old village and neighborhood.

`VotingRegionProvider.confirmPreference` and `clearPreference` return whether
browser storage succeeded. Callers must keep the editor/draft and show a retry
message on failure. The provider changes the shared preference only after a
successful storage write; polling-place results continue using the saved
neighborhood until a retry succeeds.

Global search keeps its results open while keyboard focus moves within the
search widget. Escape closes the results and returns focus to the input; leaving
the widget closes them. A failed search shows an error and retries the same query,
while a successful empty search keeps its distinct no-results message. Responses
from earlier queries must not replace the current result or error state.

People pagination recovers to the first page, preserving filters, only after a
confirmed out-of-range response (`416` / `PGRST103`) or a successful empty page
whose total proves it is out of range. The URL is replaced so Back does not return
to that stale page. Other API failures remain errors with a retry for the
requested page; a late response must not reset a newer selection.

Run `npm --prefix apps/web run test:state-safety` for the isolated browser
regressions. It loads the real React components and official region directories
with controlled I/O substitutes and no database access. Its temporary Vite
server binds only to loopback, and the tests block external requests. This does
not replace full-local data or production validation.

## Production boundary

- Production must use `VITE_PUBLIC_DATA_PROVIDER=published` and the explicit enable flag.
- Only publishable／anon credentials may be exposed to the browser.
- The DEV-only review queue/data-progress routes and Vite `/internal-api/*` are unavailable in public builds. Chat/update administration routes remain in the app; a blanket `/internal/*` DEV-only assumption is incorrect.
- Administrative routes require their existing Supabase authorization and
  Cloudflare Access defense in depth; check actual Access policy at release time rather than treating this requirement as proof of configured protection.
- Successful reads with no records use an empty state; failed reads show an
  error and recovery action. Neither may fall back to unpublished data.
