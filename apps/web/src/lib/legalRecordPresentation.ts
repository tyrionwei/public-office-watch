/** A presentation contract, not an approval or authorization mechanism.
 * The intake/review workflow must select this person's orders from THIS court's
 * main disposition before creating judgmentDisposition; never copy the full case.
 */
export type LegalPersonContext = { personId: string | null; sourceUrl: string | null };
export type DispositionResult = 'guilty' | 'acquitted' | 'mixed' | 'unknown';

type DispositionAction = 'revised' | 'dismissed' | null;
export type LegalJudgmentBasis = {
  sourceUrl: string;
  caseNumber: string;
  judgmentDate: string;
  text: string;
};
type ReviewedDisposition = {
  text: string;
  result: DispositionResult;
  requiresReview: boolean;
  action: DispositionAction;
  basis: LegalJudgmentBasis | null;
};

const acquittalStages = [
  'acquitted_final', 'criminal_acquittal_final',
  'acquitted_non_final', 'criminal_acquittal_non_final',
];
const verdicts = new Set<string>(['guilty', 'acquitted', 'mixed', 'unknown']);
const horizontalSpace = /[\t \u3000]/gu;
const sectionNumber = /^(?:[壹貳參肆伍陸柒捌玖拾一二三四五六七八九十\d]+[、.．:：)）])/u;

function compactHeading(line: string) {
  return line.replace(horizontalSpace, '').replace(sectionNumber, '');
}
function isReasonHeading(line: string) {
  return /^(?:事實(?:及理由|與理由|理由|摘要)?|(?:簡要)?犯罪事實|(?:判決)?理由(?:要旨|摘要)?)(?:如下)?(?:[:：]|$)/u.test(compactHeading(line));
}
function isDocumentFooter(line: string) {
  return /^(?:附表|附件|中華民國)/u.test(compactHeading(line));
}

/** Isolate the court's main-disposition section for PRIVATE intake/review.
 * This returns the entire section, potentially containing multiple people; it
 * does NOT match a person, infer a verdict, or approve anything for publication.
 * Unrecognized/ambiguous section boundaries return null instead of scanning the
 * facts/reasons for a replacement outcome. No OCR or network access is performed.
 */
export function extractJudgmentMainText(documentText: string): string | null {
  if (!documentText || documentText.length > 1_000_000) return null;
  const lines = documentText.replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n').split('\n');
  const selected: string[] = [];
  let found = false;
  for (const line of lines) {
    const heading = compactHeading(line.trim());
    const main = /^(?:(?:本院)?判決)?主文(?:[:：](.*))?$/u.exec(heading);
    if (!found) {
      // A quoted earlier judgment inside the reasons is not this court's main.
      if (isReasonHeading(line)) return null;
      if (!main) continue;
      found = true;
      // Preserve source spelling and spaces; only discard the heading itself.
      if (main[1]) selected.push(line.slice(line.indexOf('文', line.indexOf('主')) + 1).replace(/^[\t \u3000]*[:：]/u, ''));
      continue;
    }
    if (main) return null; // concatenated decisions / ambiguous multiple headings
    if (isReasonHeading(line) || isDocumentFooter(line)) break;
    // Flattened or malformed headings are not safe boundaries to guess around.
    if (/(?:事\s*實\s*[及與]\s*理\s*由|犯\s*罪\s*事\s*實)/u.test(line)) return null;
    selected.push(line);
  }
  const text = selected.join('\n').trim();
  return found && text ? text : null;
}

function isHttpsSource(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

function actionComparisonText(text: string) {
  // Only join the exact forward action when 駁回 ends that disposition clause.
  // A line such as `被告甲上訴\n駁回被告乙之上訴` must remain two clauses.
  return text.replace(
    /上[\t \u3000\r\n]*訴[\t \u3000\r\n]*駁[\t \u3000\r\n]*回(?=[\t \u3000]*(?:[。；;,，]|$))/gu,
    '上訴駁回',
  );
}

function hasDismissal(text: string) {
  return /(?:駁回[^。；\n]*上訴|上訴[^。；\n]*駁回)/u.test(text);
}

function dispositionClauses(text: string) {
  const clauses: string[] = [];
  let current = '';
  const parenthesisStack: string[] = [];
  for (const character of text) {
    if (character === '（') parenthesisStack.push('）');
    else if (character === '(') parenthesisStack.push(')');
    else if (character === '）' || character === ')') {
      if (parenthesisStack.pop() !== character) return [];
    }
    current += character;
    if (parenthesisStack.length === 0 && /[。；;,，\n]/u.test(character)) {
      clauses.push(current.slice(0, -1));
      current = '';
    }
  }
  if (parenthesisStack.length) return [];
  if (current) clauses.push(current);
  return clauses;
}

function hasScopedDismissal(text: string, personScopeQuote: string) {
  return dispositionClauses(actionComparisonText(text))
    .some(clause => clause.includes(personScopeQuote) && hasDismissal(clause));
}

function personDisposition(json: Record<string, unknown>, context?: LegalPersonContext): ReviewedDisposition | null {
  const raw = json.judgmentDisposition;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !context?.personId || !context.sourceUrl) return null;
  const value = raw as Record<string, unknown>;
  if (![1, 2].includes(value.version as number) || value.section !== '主文' || value.reviewStatus !== 'reviewed'
    || value.personId !== context.personId || !isHttpsSource(value.sourceUrl) || value.sourceUrl !== context.sourceUrl
    || typeof value.text !== 'string' || !value.text.trim() || value.text.length > 12_000
    || typeof value.result !== 'string' || !verdicts.has(value.result)) return null;
  if (value.version === 2 && (!record(value.upheldJudgment) || !boundedText(value.caseNumber)
    || !validDate(value.judgmentDate) || !boundedText(value.personScopeQuote))) return null;
  const text = value.text.trim();
  // This field contains ONLY the already selected person's verbatim main text.
  // A full document or reasons accidentally placed here is invalid, not a cue
  // to automatically assign all defendants' orders to the current person.
  if (text.split(/\r?\n/u).some(line => /^(?:(?:本院)?判決)?主文(?:[:：]|$)/u.test(compactHeading(line.trim()))
    || isReasonHeading(line) || isDocumentFooter(line))
    || /事\s*實\s*[及與]\s*理\s*由|犯\s*罪\s*事\s*實/u.test(text)) return null;
  const unsafe = /附表|附件|發回|先前|曾被|主張|辯稱|抗辯|求刑|求處|起訴意旨|公訴意旨/u.test(text)
    || /(?:一審|二審|原審|前審|原判決)[^。；\n]*(?:判處|判刑|有期徒刑|無期徒刑|死刑|拘役)/u.test(text)
    || /免訴|不受理/u.test(text);
  // Court layouts can split the action itself across lines. Normalize only
  // whitespace inside these exact phrases for comparison; keep sentence and
  // person boundaries, and preserve the verbatim text used for display/audit.
  const actionText = actionComparisonText(text);
  const detectedAction: DispositionAction = unsafe ? null
    : /(?:撤銷(?:其一審判決|原判)|原判決[^。\n]*撤銷)/u.test(actionText) ? 'revised'
      : hasDismissal(actionText) ? 'dismissed' : null;
  const action = value.version === 2 && detectedAction === 'dismissed'
    ? hasScopedDismissal(text, value.personScopeQuote as string) ? detectedAction : null
    : detectedAction;
  const appealOnly = action === 'dismissed' && !/無罪|有罪|犯[^。；\n]+罪/u.test(actionText);
  // Version 2 is ONLY the explicitly reviewed, entire-person appeal relationship.
  // Never accept a version-2 root result in place of its independently cited basis.
  if (value.version === 2) {
    const basis = !unsafe && appealOnly ? reviewedUpheldJudgment(value, context, json) : null;
    return { text, action, basis: basis?.basis ?? null,
      result: basis?.result ?? 'unknown', requiresReview: !basis };
  }
  const requiresReview = unsafe || appealOnly;
  return { text, action, basis: null,
    result: requiresReview ? 'unknown' : value.result as DispositionResult, requiresReview };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
function boundedText(value: unknown, max = 200): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && value.length <= max;
}
const compactReference = (value: string) => value.replace(/[\s\u3000]/gu, '');

/** Review data must bind BOTH court records, dates, person and exact current quote.
 * This is a consistency check, not an automated legal finding. Partial appeals,
 * resentencing, remands, unknown scope and chained references remain unsupported.
 */
function reviewedUpheldJudgment(value: Record<string, unknown>, context: LegalPersonContext,
  json: Record<string, unknown>): { basis: LegalJudgmentBasis; result: DispositionResult } | null {
  const link = record(value.upheldJudgment);
  const prior = record(link?.prior);
  if (!link || !prior || value.result !== 'unknown'
    || !boundedText(value.caseNumber) || !validDate(value.judgmentDate)
    || value.judgmentDate !== json.judgmentDate
    || !boundedText(value.personScopeQuote) || typeof value.text !== 'string'
    || !value.text.includes(value.personScopeQuote)
    || /之刑|刑部分|量刑|沒收|撤銷/u.test(value.personScopeQuote)
    || /撤銷|發回|改判|改處|有期徒刑|無期徒刑|死刑|拘役|罰金|褫奪公權/u.test(value.text)
    || link.reviewStatus !== 'reviewed' || link.relation !== 'appeal_dismissed'
    || link.scope !== 'entire_person_disposition' || link.personId !== context.personId
    || link.currentCaseNumber !== value.caseNumber || link.currentSourceUrl !== context.sourceUrl
    || link.currentDispositionText !== value.text || link.personScopeQuote !== value.personScopeQuote
    || link.evidenceSourceUrl !== context.sourceUrl || !boundedText(link.evidenceText, 4000)
    || !boundedText(prior.caseNumber) || link.priorCaseNumber !== prior.caseNumber
    || !compactReference(link.evidenceText).includes(compactReference(prior.caseNumber))
    || !validDate(prior.judgmentDate) || prior.judgmentDate >= value.judgmentDate
    || prior.personId !== context.personId || prior.version !== 1 || prior.upheldJudgment !== undefined
    || !isHttpsSource(prior.sourceUrl) || prior.sourceUrl === context.sourceUrl
    || !['court_judgment', 'court_published_main_text'].includes(prior.sourceKind as string)) return null;
  // Calling version 1 only prevents recursive / circular provenance chains.
  const selected = personDisposition({ judgmentDisposition: prior }, {
    personId: context.personId, sourceUrl: prior.sourceUrl,
  });
  if (!selected || selected.requiresReview || selected.action || selected.result === 'unknown') return null;
  return { basis: { sourceUrl: prior.sourceUrl, caseNumber: prior.caseNumber,
    judgmentDate: prior.judgmentDate, text: selected.text }, result: selected.result };

}

/** Extract display excerpts from reviewed person-scoped 主文 only.
 * Legacy narratives remain readable, but are never treated as a current verdict.
 * No review/publication flags or input records are changed here.
 */
export function legalRecordPresentation(text: string | null, json: Record<string, unknown>, context?: LegalPersonContext) {
  const original = text?.trim() ?? '';
  const stage = typeof json.caseStage === 'string' ? json.caseStage : '';
  const criminal = json.recordType === 'criminal'
    && (stage.startsWith('criminal_judgment') || stage === 'historical_criminal_judgment_final' || acquittalStages.includes(stage));
  const disposition = criminal ? personDisposition(json, context) : null;
  const dispositionConflict = Boolean(disposition && acquittalStages.includes(stage)
    && ['guilty', 'mixed'].includes(disposition.result));
  const complex = !disposition || disposition.requiresReview || dispositionConflict;
  const reviewedResult: DispositionResult = complex ? 'unknown' : disposition.result;
  const canExtract = !complex && ['guilty', 'mixed'].includes(reviewedResult);
  const clauses = (disposition?.basis?.text ?? disposition?.text ?? '').split(/[，；;。\n]/u).map(s => s.trim()).filter(Boolean);
  const offenses = [
    '利用職務機會詐取財物及不違背職務收受賄賂等罪',
    '非公務機關未於蒐集特定目的必要範圍內利用個人資料罪',
    '對連署人交付賄賂使其為特定被連署人連署罪',
    '預備對於候選人交付賄賂而約其放棄競選罪',
    '對有投票權人預備交付賄賂罪', '公務員洩漏國防以外之秘密文書罪',
    '交付、收受供偽造有價證券之器械、原料罪', '填製不實會計憑證罪',
    '公務員抑留不發職務上應發款項案', '使公務員登載不實案',
    '虛偽遷徙戶籍取得投票權而投票', '圖利及公司法等案',
    '交付財物罪', '交付賄賂案', '預備賄選案', '農會賄選案', '議長賄選案',
    '違法收受政治獻金', '妨害公務等罪', '妨害投票案件', '助理費案',
    '利用職務上機會詐取財物罪', '利用職務機會詐取財物罪', '不違背職務收受賄賂罪',
    '水土保持法非法占用致水土流失未遂罪', '虛偽遷徙戶籍取得投票權而投票罪',
    '散布文字、圖畫誹謗罪', '散播謠言意圖使人不當選罪', '公務員抑留不發職務上應發款項罪',
    '公司法未繳納股款罪', '虛偽記載公開說明書罪', '使公務員登載不實罪',
    '藥事法販賣偽藥罪', '意圖營利聚眾賭博罪', '圖利聚眾賭博罪',
    '對主管事務圖利罪', '違反農會法交付財物罪', '公然侮辱罪', '侮辱公務員罪',
    '加重誹謗罪', '詐欺取財罪', '過失致人於死', '過失傷害罪', '投票受賄罪',
    '操縱股價罪', '偽造文書罪', '妨害公務罪', '妨害自由罪', '妨害名譽罪',
    '恐嚇取財罪', '誹謗罪', '傷害罪', '誣告罪', '偽證罪',
  ].sort((a, b) => b.length - a.length);
  const matched: string[] = [];
  if (canExtract) {
    for (const clause of clauses) {
      if (/無罪|不成立|不構成|被訴|涉嫌|不另為/.test(clause)) continue;
      let remaining = clause;
      for (const offense of offenses) {
        if (remaining.includes(offense)) {
          matched.push(offense);
          remaining = remaining.split(offense).join('');
        }
      }
    }
  }
  // Preserve complete penalty clauses: totals, individual counts, reductions,
  // probation and conversion conditions must not become an invented total.
  const penalties: string[] = [];
  if (canExtract) {
    for (const clause of clauses) {
      if (/本次|本筆|未確認|未核實|待補|最終|後續|不能標示|無罪|不成立|不構成|不另為/.test(clause)) continue;
      const index = clause.search(/(?:應執行|各判|各處|各有期|判處(?!理)|處有期|判刑|減為|有期徒刑|無期徒刑|死刑|拘役|罰金|緩刑|褫奪公權|得易科|得以每日|易科罰金|得易服|易服勞役|向公庫|並於確定後|於判決確定後|沒收)/);
      if (index < 0) {
        if (/折算|追徵|付保護管束/.test(clause)) penalties.push(clause);
        continue;
      }
      let excerpt = clause.slice(index);
      // Do not cut off a separate offense's name when several counts share a card.
      if (matched.filter(offense => clause.includes(offense)).length || /另涉|另犯|部分|各/.test(clause)) {
        const offenseIndex = Math.min(...matched.filter(offense => clause.includes(offense)).map(offense => clause.indexOf(offense)), index);
        excerpt = clause.slice(offenseIndex);
      }
      if (/部分|各|不得|如易|應於|不能沒收|未扣案|扣案物|並沒收|併科/.test(clause)) excerpt = clause;
      penalties.push(excerpt);
    }
  }
  return {
    offenses: [...new Set(matched)],
    // These are source excerpts only; classification never inspects this array.
    notes: complex ? [] : clauses.filter(clause => /無罪|不成立|不構成|不另為/.test(clause)),
    // A verified appeal disposition is useful even without a known verdict.
    action: disposition?.action ?? null,
    hasReviewedMain: Boolean(disposition),
    basis: !complex ? disposition.basis : null,
    reviewedResult,
    dispositionConflict,
    // Keep the person's actual disposition visible, with the original source
    // narrative retained separately in the expandable full-record view.
    narrative: disposition?.text ?? original,
    penalties: [...new Set(penalties)],
    // Keep context visible whenever reliable compact excerpts cannot be produced.
    showNarrative: Boolean(disposition?.basis) || complex || !matched.length || !penalties.length,
    judgmentDate: typeof json.judgmentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(json.judgmentDate) ? json.judgmentDate : null,
  };
}

export type LegalCaseStatus = 'indicted' | 'deferred' | 'nonFinal' | 'final' | 'finalityUnknown' | 'other';
export type LegalJudgmentResult = 'guilty' | 'acquitted' | 'mixed' | 'notJudged' | 'unknown' | 'notApplicable';

/** Procedural status and verdict are independent; unknown is not non-final. */
export function legalCaseClassification(json: Record<string, unknown>, presentation: ReturnType<typeof legalRecordPresentation>) {
  const stage = typeof json.caseStage === 'string' ? json.caseStage : '';
  let status: LegalCaseStatus = 'other';
  let result: LegalJudgmentResult = 'unknown';
  const final = ['criminal_judgment_final', 'historical_criminal_judgment_final', 'acquitted_final', 'criminal_acquittal_final'];
  const nonFinal = ['criminal_judgment_non_final', 'criminal_judgment_first_instance', 'criminal_judgment_appellate_non_final', 'acquitted_non_final', 'criminal_acquittal_non_final'];
  if (json.recordType && json.recordType !== 'criminal') return { status, result: 'notApplicable' as LegalJudgmentResult };
  if (stage === 'indicted' || stage === 'criminal_indicted') return { status: 'indicted' as LegalCaseStatus, result: 'notJudged' as LegalJudgmentResult };
  if (stage === 'deferred_prosecution' || stage === 'criminal_deferred_prosecution') return { status: 'deferred' as LegalCaseStatus, result: 'notJudged' as LegalJudgmentResult };
  if (final.includes(stage)) status = 'final';
  else if (nonFinal.includes(stage)) status = 'nonFinal';
  else if (stage === 'criminal_judgment') status = 'finalityUnknown';
  if (presentation.dispositionConflict) return { status, result };
  // Specific reviewed legacy acquittal metadata is preserved. Generic case stage,
  // penalty keywords, and a defendant's assertions do not establish a verdict.
  if (acquittalStages.includes(stage)) result = 'acquitted';
  else if (status !== 'other') result = presentation.reviewedResult;

  return { status, result };
}

/** Rendering decisions only; never interpret the source narrative as evidence. */
export function legalRecordDisplay(presentation: ReturnType<typeof legalRecordPresentation>,
  classification: ReturnType<typeof legalCaseClassification>) {
  const datePrefix = /^裁判日期[：:]\s*(\d{4}-\d{2}-\d{2})(?:[。\s]|$)/u.exec(presentation.narrative);
  const isCriminalJudgment = ['nonFinal', 'final', 'finalityUnknown'].includes(classification.status);
  return {
    showOffense: presentation.offenses.length > 0,
    showSentence: presentation.penalties.length > 0,
    showResult: classification.result !== 'unknown' && classification.result !== 'notApplicable',
    showDate: Boolean(presentation.judgmentDate)
      && !(presentation.showNarrative && datePrefix?.[1] === presentation.judgmentDate),
    notice: !isCriminalJudgment ? null
      : !presentation.hasReviewedMain ? 'legacy' as const
        : presentation.reviewedResult === 'unknown' ? 'incomplete' as const : null,
  };
}
