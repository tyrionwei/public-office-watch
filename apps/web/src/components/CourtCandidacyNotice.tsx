
/** The source link supplies the case-specific end condition; never infer a date. */
export function CourtCandidacyNotice({ english }: { english: boolean }) {
  return <p className="text-amber-200">{english
    ? 'Temporary relief, not a final qualification judgment. Its duration and conditions are stated in the linked court source; previous decisions remain in this timeline.'
    : '此為暫時處分，不代表資格已獲終局確定；適用期間及條件依下方法院來源，原資格審定歷史仍保留。'}</p>;
}
