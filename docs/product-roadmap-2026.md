# Public Office Watch — 2026 Product Roadmap

Last updated: 2026-09-08
Status: Current priorities confirmed by the maintainer; delivery dates remain open.

## Current direction — 2026-09-08

Next, prioritize exploration of a fuller PWA experience and records of activity in public office. These are planning priorities, not completed features or a commitment to fixed delivery dates.

The delivery statuses below reflect the maintainer's 2026-09-08 update. The PWA foundation was also inspected in the repository: `apps/web/public/site.webmanifest`, `apps/web/public/service-worker.js`, and `apps/web/src/main.tsx`. This documentation update does not independently re-audit production coverage.

| Direction | Current status | Next step / dependency |
|---|---|---|
| PWA | Manifest, service worker, and offline fallback foundations exist | Prioritize installation, update, and offline-state usability assessment; a fallback page is not offline access to the full dataset |
| Mobile My elections | Phase 1 completed and live | Continue UX refinements |
| 2026 candidate registration lifecycle | First stage complete | Add qualification, ballot numbers, and final lists as election authorities publish them |
| Polling places and precise neighborhood mapping | Main flow complete; 15/22 counties and cities live | Verify sources and cover the remaining 7; keep unsupported mappings unavailable |
| Cloudflare Web Analytics | Enabled | Accumulate observed traffic and use it to inform UX work; account for sampling and maintainer/test traffic |
| Search quality / production smoke | Additional hardening complete | Refine search ranking when justified by usage and evidence |
| Candidate comparison 2.0 | Not started; existing basic comparison remains available | Reconsider later |
| Changes since the last visit | Not started | Reconsider after candidate lifecycle updates stabilize |
| Records of activity in public office | Formal PoC not started | Prioritize research and a central/national legislator pilot with source-backed records |
| Pledge fulfilment evidence timeline | Community participation foundations exist; factual tracking is not implemented | Depends on the office-activity data layer; community votes are not proof of fulfilment |
| Candidate questionnaires | On hold | No implementation planned now |
| User-facing AI | Deliberately outside the current plan | Maintain UI/UX-first priorities; Codex-assisted development and review remain separate |
| Political contributions / company relationships | Ongoing | Long-term, source-backed data coverage |
| Judicial synchronization / takedown workflow | Existing records and review foundations | Develop dedicated judicial synchronization, update, and takedown handling; retain human review |
| Local council activity API | Feasibility researched | Revisit after the national legislator pilot |

## Near-term exploration boundaries

### PWA

Improve the experience around the existing foundation. Assess installation, updates, and offline messaging before setting an implementation scope. The current service worker caches a small shell and falls back to an offline notice; do not describe this as full offline election or people data. Any future caching of public records needs a separate design for freshness and stale-data visibility.

### Records of activity in public office

Start by planning a national legislator pilot and identifying reliable activity sources. A formal PoC has not begun. Establish provenance, dates, identity matching, coverage limits, and correction paths before extending to local councils or pledge fulfilment evidence. The feasibility of local council APIs does not mean an integration is complete.

## Continuing commitments

Keep official-source verification, conservative identity matching, private review for sensitive records, bilingual UI, and corrections in scope. Registration comes from election authorities; party announcements and news leads do not establish qualification. A source outage or unparseable neighborhood mapping stays unknown instead of being guessed.

The public summary is maintained in `apps/web/src/pages/AboutPage.tsx` and the Traditional Chinese / English `about.*` entries in `apps/web/src/i18n.tsx`; [README](../README.md) summarizes the same priorities.

## Historical planning baseline — 2026-08-12

The sections below preserve the earlier planning record. Their target dates and statements about implementation or availability describe the August baseline, not current delivery status. The September status table above supersedes that historical delivery list. Historical options are not authorization to introduce new product rules or integrations.

Original implementation inventory:
[`project-inventory-and-backlog-2026-08-12.md`](./project-inventory-and-backlog-2026-08-12.md)

## 1. Product objective

Public Office Watch helps Taiwan voters independently examine candidates
for the 2026 local elections through traceable public information rather
than relying primarily on news narratives.

First-release priorities:

1. Data correctness and traceable sources.
2. Strong desktop and mobile UI/UX.
3. Clear candidate comparison within each election page.
4. Low-friction public participation.
5. Editorial neutrality and transparent correction workflows.

## 2. Core candidate information

Candidate pages should progressively cover:

- Education and work history
- Political experience
- Family relationships relevant to public interest
- Business and political relationships
- Political donations
- Property declarations
- Judicial, criminal and administrative records
- Previous campaign promises and fulfillment
- Sources, update timestamps and correction history

Facts, editorial summaries and inferences must be visually separated.

## 3. Candidate comparison

Candidate comparison is part of the election or district page rather
than a separate first-release feature.

For elections with many candidates, the implementation may retain
`selectedCandidateIds` and allow users to pin two to four candidates.

## 4. Homepage issue participation

The homepage upcoming-election section includes a city or county issue
concern module focused initially on mayoral and county-magistrate elections.

Behavior:

- The user manually selects a city or county.
- Do not use GPS or claim to know the user's registered voting district.
- A participant may select one to three issues.
- Returning participants see the current results immediately.
- Changing a choice replaces the previous choice instead of adding votes.
- Results are described as voluntary participation statistics, not polling
  or representative public opinion.
- Results should link to candidate records and policy positions related to
  the most selected issues.

## 5. Low-friction participation and abuse prevention

Normal participants should not be required to register or provide a phone
number.

Initial controls:

- Anonymous participant ID
- Secure first-party cookie
- Invisible Turnstile
- One active response per participant and activity
- Delayed public result updates
- IP, ASN, device cookie and behavior signals used only for risk analysis
- SMS OTP requested only for suspicious activity
- Participation states such as accepted, pending, verified and quarantined
- Avoid invasive browser fingerprinting as the sole identity mechanism

The objective is not perfect one-person-one-vote enforcement. The objective
is to prevent casual repeat voting and raise the cost of deliberate abuse.

## 6. Data-gap priority system

Do not create a ranking of which candidate “most needs investigation.”

Each candidate data section may provide:

- `希望補充`: request that a missing data category be prioritized
- `回報問題`: report inaccurate, outdated, broken-source or misleading data

Unverified reports are not publicly displayed.

Suggested review flow:

received → reviewing → verified/rejected → published

Candidate pages may show which data categories users most want completed.
Homepage and election-page summaries may rank data categories, but must not
rank candidates by suspicion or investigation requests.

## 7. Candidate status

Candidate records should distinguish:

- potential
- party_nominee
- registered
- qualified
- officially_announced
- withdrawn_or_disqualified

Do not describe a person as an official candidate before the relevant
election authority has officially established that status.

## 8. Historical target release schedule (2026-08-12)

- July to mid-August: development and closed testing
- Around August 20: public beta
- August 31 to September 4: monitor official candidate registration
- September 5 to September 10: formal launch
- Mid-to-late October: qualification and ballot-number update campaign
- Mid-November: final reconciliation with official lists and election bulletins

## 9. Sponsorship neutrality

Money may increase the resources available to maintain and research the
site, but may not determine:

- Candidate ordering
- Candidate exposure frequency
- Editorial conclusions
- Data ratings
- Public participation weight
- Whether unfavorable information is removed or weakened

Accepted support may include:

- General site operations
- Complete data work for one election
- A data category applied consistently to all comparable candidates
- Visual upgrades covering an entire election or comparable group
- Future professional API or structured-data services

## 10. Improvement suggestions and pixel portraits

After supporting the site, users may optionally leave a non-binding
improvement suggestion.

Suggestions may include prioritizing a particular person's neutral pixel
portrait, but:

- It is not a commissioned purchase.
- Execution and timing are not guaranteed.
- Support amount does not increase suggestion weight.
- It does not change ordering or exposure.
- Portraits follow the same dimensions, animation and visual standards.
- No “sponsored unlock” label is shown beside a political figure.
- Payment and improvement-suggestion records remain logically separate.

## 11. Support availability

Public support is not currently available. The support page should present
the feature as being in preparation and must not collect payment details or
create transactions.

Any future provider or payment method requires a separate review before its
name, amounts, transaction flow or refund terms are published. Once launched,
support should emphasize broad small contributions rather than large individual
payments.

## 12. Transparency reporting

Do not make the historical cumulative support amount a prominent homepage
metric.

Prefer periodic reporting of:

- Monthly supporter count
- Monthly support total
- Support channel totals
- Payment and network fees
- Expense categories
- Remaining operating funds

Do not publish individual names, wallet addresses, individual amounts or
the monetary support associated with a particular political figure or
improvement suggestion.

## 13. Historical priority additions (2026-08-12)

The 2026-08-12 implementation audit adds these items to the delivery list:

1. Keep the Codex App daily and weekly local collection schedules producing review-only artifacts before the 21:30 review.
2. Keep the GitHub workflow manual and dry-run only; production Supabase writes require a separate reviewed process.
3. Reconcile 2026 party nominees with CEC registration, qualification and ballot-number data.
4. Monitor official local-government rosters for replacements and departures.
5. Import historical CEC referendum data, including national cases 1–21,
   the separately numbered 2022 constitutional referendum, and six documented local referendums.
