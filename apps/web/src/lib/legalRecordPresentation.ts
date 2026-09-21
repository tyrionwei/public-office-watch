/** Extract display excerpts only; never change review status or infer finality. */
export function legalRecordPresentation(text: string | null, json: Record<string, unknown>) {
  const original = text?.trim() ?? '';
  const stage = typeof json.caseStage === 'string' ? json.caseStage : '';
  const criminal = json.recordType === 'criminal' && stage.startsWith('criminal_judgment');
  // A narrative combining overturned sentences or several historical outcomes needs
  // its full context. Do not turn its earlier sentence into a current conviction.
  const complex = /發回|先前|曾被/.test(original) || /(?:有期徒刑|拘役|判刑)[\s\S]*撤銷/.test(original);
  const clauses = original.split(/[，；;。\n]/u).map(s => s.trim()).filter(Boolean);
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
  if (criminal && !complex) {
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
  if (criminal && !complex) {
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
    notes: clauses.filter(clause => /無罪|不成立|不構成|不另為/.test(clause)),
    action: /撤銷(?:其一審判決|原判)/.test(original) ? 'revised' : /駁回.*上訴/.test(original) ? 'dismissed' : null,
    penalties: [...new Set(penalties)],
    // Keep context visible whenever reliable compact excerpts cannot be produced.
    showNarrative: complex || !matched.length || !penalties.length,
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
  const acquittals = ['acquitted_final', 'criminal_acquittal_final', 'acquitted_non_final', 'criminal_acquittal_non_final'];
  const final = ['criminal_judgment_final', 'historical_criminal_judgment_final', 'acquitted_final', 'criminal_acquittal_final'];
  const nonFinal = ['criminal_judgment_non_final', 'criminal_judgment_first_instance', 'criminal_judgment_appellate_non_final', 'acquitted_non_final', 'criminal_acquittal_non_final'];
  if (json.recordType && json.recordType !== 'criminal') return { status, result: 'notApplicable' as LegalJudgmentResult };
  if (stage === 'indicted' || stage === 'criminal_indicted') return { status: 'indicted' as LegalCaseStatus, result: 'notJudged' as LegalJudgmentResult };
  if (stage === 'deferred_prosecution' || stage === 'criminal_deferred_prosecution') return { status: 'deferred' as LegalCaseStatus, result: 'notJudged' as LegalJudgmentResult };
  if (final.includes(stage)) status = 'final';
  else if (nonFinal.includes(stage)) status = 'nonFinal';
  else if (stage === 'criminal_judgment') status = 'finalityUnknown';
  if (acquittals.includes(stage)) result = 'acquitted';
  else if (status !== 'other' && presentation.penalties.length > 0) {
    result = presentation.notes.some(note => /無罪|不成立|不構成/.test(note)) ? 'mixed' : 'guilty';
  }
  return { status, result };
}
