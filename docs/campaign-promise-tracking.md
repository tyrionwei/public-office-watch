# Campaign promise tracking

## Scope

Campaign platforms belong to a specific candidacy, not directly to a person. The canonical path is:

```text
person -> candidate -> race -> election
```

This keeps the same person's promises from different years, offices, districts, or parties separate.

The first implementation phase uses `person_claims.candidate_id` and retains the complete source text in the existing `platform` claim. Historical backfills are limited to elected candidates and the CEC bulletin for that exact election. A row is publishable only when the candidate has a unique stable identifier, the person and race match the bulletin, and both `is_elected` and `election_result = 'elected'` are present.

A platform without an exact `candidate_id` stays local with `review_status = 'pending'`, `visibility = 'review_only'`, and `is_public = false`. It must not appear in the standalone public person profile. A current council or officeholder profile may be retained as a separate current-agenda lead, but it is not historical election-platform evidence unless an exact CEC bulletin confirms the candidacy.

On the person page, election-scoped platforms appear inside the matching candidacy record. Unscoped claims are excluded from both the public person profile and race comparison until reviewed. The race comparison uses the same candidate-scoped claim.

Every official-bulletin backfill retains:

- the CEC source URL;
- the preserved local PDF filename and SHA-256;
- the source page and extraction method;
- the exact candidate, race, and election identifiers;
- the complete reviewed platform text.

The 2022 elected-executive source batch covers all 226 elected county/city mayors, township/city mayors, and indigenous district chiefs. The collection and staging commands are:

```text
npm run fetch:cec-elected-platforms
npm run extract:cec-elected-platform-review
npm run stage:cec-elected-platform-review:local
```

The fetch step accepts only the verified 2022 CEC archive layout and stores the official URL, local PDF, and SHA-256. The extractor uses the PDF text layer, reviewed table geometry, or a source-hash-bound manual crop, but every OCR result remains private and non-canonical. The staging step rejects non-local Supabase hosts and creates private pending claims only; a reviewer must visually transcribe and approve text before publication. Local candidate records that have been merged to canonical people keep their exact candidate ID and use the current local canonical `person_id`.

The elected-representative extension uses the current `https://bulletin.cec.gov.tw/` archive and requires an explicit scope:

```text
node scripts/fetch-cec-elected-representative-platforms.mjs --scope 2022-councilor --download
node scripts/fetch-cec-elected-representative-platforms.mjs --scope 2024-legislator --download
```

It targets elected 2022 council candidates and elected 2024 regional or indigenous legislative candidates that do not already have a verified or pending candidate-scoped platform claim. Party-list legislators are outside this pass because the local CEC candidacy model does not represent them as individual district candidacies.

Bulletin selection first matches election year, office, jurisdiction, and district. It then confirms the candidate name from the PDF text layer when available. A unique official district bulletin whose text layer cannot expose the name is retained at lower confidence for private visual review. Multiple possible bulletin volumes remain unresolved and do not create a claim until a reviewer selects the correct volume.

The shared extractor accepts these reports through explicit paths. Entries with OCR crops are marked `pending_manual_transcription`; entries whose source is known but whose platform area cannot be located are marked `pending_manual_localization`. Both remain `review_status = 'pending'`, `visibility = 'private'`, and `is_public = false`:

```text
node scripts/extract-cec-elected-platform-review.mjs --input <review.json> --output <platform-review.json> --crop-dir <crops> --layout-dir <layouts>
node scripts/stage-cec-elected-platform-review.mjs --input <platform-review.json> --output <staging.json> --apply-local
```

An OCR crop is only a navigation aid, not proof that the platform is complete. Before approval, the reviewer must compare it with the candidate's complete block in the official bulletin page. A crop that omits a column, category, continuation, or the beginning or end of a line stays private until the complete text is transcribed.

The first five visually verified public records are 蔡文益、李明哲、蕭淑芬、林慧如、陳建名. The other 221 records are local private transcription work. The preserved file named `cec-2022-dongshi-mayor.pdf` is actually the Chiayi County Dongshi Township bulletin, not the Yunlin County Dongshi Township bulletin, so it must not be used for 張健福.

Unsuccessful candidates are intentionally outside this historical phase. Current or future candidate platforms already collected by a separate reviewed candidate workflow are not deleted by this rule.

## Planned promise records

The next data phase should split a reviewed platform into individually traceable promises. Each promise should retain:

- exact `candidate_id` and therefore its race and election;
- original wording and source URL;
- a short neutral title;
- topic classification;
- promise type, such as action, legislation, budget, construction, or outcome;
- measurable target and target date when the source supplies them;
- review status and the person who approved the interpretation.

Splitting text may be machine-assisted, but publication requires review because one sentence can contain several commitments and some political statements are not measurable promises.

## Fulfilment assessments

Assessments are versioned evidence records rather than edits to the original promise. Recommended public statuses are:

- `not_started`
- `in_progress`
- `partially_completed`
- `substantially_completed`
- `completed`
- `not_fulfilled`
- `not_assessable`

Every public assessment must include a dated source and a neutral explanation. A change of government policy, budget passage, construction start, or announced plan is evidence of progress, but is not automatically evidence of completion.

## Completion rate

Do not publish a single percentage until the assessed coverage is also available. When there is enough reviewed evidence, display both:

```text
Estimated completion: 62%
Assessed coverage: 13 of 20 promises
```

The percentage should be the average reviewed progress of assessable promises only. `not_assessable` promises stay in the total platform count but are excluded from the percentage denominator. The UI must label the result as an evidence-based estimate, not an objective score of political performance.

The first public version should prefer status counts over a percentage. Add the percentage only after the review workflow has produced stable and repeatable assessments across more than one officeholder.

## 就職滿一年開放投票（2026-09-21）

個人須已當選且政見內容已審核、完成條目整理；不分區政黨另須取得席次。開放日為經核對的就職日起一年，以 Asia/Taipei 民用日期判斷。`platform_voting_inaugurations` 僅存投票所需日期，不切換現任公職，也不重建人物名冊。

本批一次性納入已有公開政見的 2024 正副總統（2024-05-20）、立委（2024-02-01）、2022 地方改選（2022-12-25），以及原已支援的 2020 不分區政黨（2020-02-01）。日期來源存於 migration 與日程列；嘉義市 2022 重行選舉依內政部明示同日就職。未來新增候選人、補選、遞補或重行公告須另行核對個別日期，不自動套入正常改選日期。翁有義重行公告案的就職日尚未確認，不納入本批。

缺少就職日期仍展示已公開政見，但不開放投票；不退回採用公告日。既有當選公告欄位保留原義。總統與副總統共用票路由及既有投票內容保持不變；人物配對使用既有 canonical map，不要求合併前後 UUID 逐字相同。

驗證入口：`tests/sql/platform-inauguration-voting.sql` 為本機回滾交易驗證，不能在正式庫執行；另有 `platformFulfillmentVoteState.spec.ts` 檢查畫面與投票狀態。
