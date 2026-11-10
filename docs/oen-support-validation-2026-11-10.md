# OEN support integration validation — 2026-11-10

## Scope and release status

Prepared on isolated branch `codex/feature/oen-support-20261110`, based on verified remote main `0a84937237dd0265f7dfb55a5dc2f9b11570f6b3`. This official-site change has not been pushed, merged, or deployed. Existing unrelated working-tree changes were not incorporated.

- Added one-time TWD OEN support immediately above USDT on `/support`.
- Exact destination: https://pow4vote.oen.tw/payment-url/3Lv6wrTAQPc8sq5qvmgtZr5MjHZ
- Displays NT$100–2,000, credit card and convenience-store payment code. The checkout page determines final available amounts/methods.
- Uses a standard external link, explicit real-payment/new-tab notice, `noopener noreferrer`, and no card-data collection on POW.
- Retains USDT addresses, QR/copy functionality, validation and optional message submissions unchanged. Adds only a width constraint to prevent the existing network selector overflowing 320px screens.
- Updates Traditional Chinese and English Support/About wording. Makes no promise about emailed receipts, settlement or charitable tax receipts.
- No payment SDK, iframe, new API, database/migration change or CSP expansion.

## Passed checks

- Final lint and TypeScript/Vite production build (mock data; no production credentials).
- 10 OEN browser tests: 320, 390, 430 and 1440px; both languages; light/dark contrast; visible inset keyboard focus; >=44px CTA; exact link and order; existing USDT/message controls; repeated new-tab open/close; no opener/referrer; no automatic checkout request or payment POST; Back/Forward and reload.
- OEN tests apply the existing production CSP. Outbound checkout requests are intercepted with an inert local test response; no actual payment is attempted.
- 12 existing isolated USDT browser tests, rerun after the selector-width adjustment.
- Additional repeat of all 10 OEN browser tests with an existing Windows Chinese font loaded only in the local QA browser. Chinese mobile/desktop and light-theme screenshots visually reviewed; no font copied into app assets or published.
- Web contracts: 586 passed, 7 explicitly skipped, 0 failed.
- Four Python image-geometry/crop suites: 21 tests passed.
- Public-data and published-exposure boundary checks pass. Existing warning: SelectedRegionHud imports mock data directly.
- Independent read-only review completed. Focus clipping and stale About copy were corrected before final validation.
- `git diff --check` passes.

## Aggregate-check limitation

`npm run check` stops in the root script suite: 558 passed, 1 failed, 0 skipped (559 total).

The unchanged baseline fixture at `scripts/install-local-review-rpc.test.mjs:77` copies `auto-review-person-claims.mjs` and `lib/local-review-target.mjs`, but omits the CLI's existing `lib/official-profile-policy.mjs` import. Node therefore reports ERR_MODULE_NOT_FOUND before the test reaches its expected loopback-only guard. Both relevant files match HEAD and are outside this change. This is not reported as an all-green aggregate run. Remaining independent checks were executed separately as listed above.

The live legacy-public-view retirement check was explicitly skipped because no Supabase environment was supplied. No live DB write test, real payment, receipt delivery, settlement, physical iOS/Android/PWA test, remote CI, or official production smoke was performed.

## Reproduction

After normal dependency setup, run:

- `npm --prefix apps/web run lint`
- `VITE_PUBLIC_DATA_PROVIDER=mock npm --prefix apps/web run build`
- `npm --prefix apps/web run test:browser:ci -- --project=support`
- `npm --prefix apps/web run test:state-safety -- cryptoSupport.pw.ts`
- `npm --prefix apps/web run test:read-contracts`
- `npm run check` (known baseline fixture failure above)

On this WSL host, connection attempts to unused standard preview port 4173 timed out before Playwright could start its webServer. The local run used an already-started mock preview on 127.0.0.1:4189 and a temporary config overriding only baseURL/webServer/outputDir. The committed test suite remains integrated into the existing CI configuration.

## Publication

Await explicit approval before any official GitHub push/merge/deployment. Main participates in automatic production deployment, so merging is a release action. The separately maintained owner-only mobile trial is a different release surface and does not imply official-site publication.
