export type SourceDisplayRecord = { id: string; claim: Record<string, unknown>; references: Record<string, unknown>[]; [key: string]: unknown };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function parseSourceDisplay(text: string): SourceDisplayRecord[] {
  const data: unknown = JSON.parse(text);
  if (!object(data) || !Array.isArray(data.displayRecords) || data.displayRecords.length > 10000) throw new Error('不是有效的本機來源顯示索引。');
  const ids = new Set<string>();
  for (const row of data.displayRecords) {
    if (!object(row) || typeof row.id !== 'string' || !/^[a-f0-9]{64}$/.test(row.id) || ids.has(row.id)
      || !object(row.claim) || typeof row.claim.claimValue !== 'string' || typeof row.claim.claimType !== 'string'
      || !Array.isArray(row.references) || !row.references.length
      || row.applyAllowed !== false || row.importAllowed !== false || row.publicationApproved !== false
      || row.displayScope !== 'private_source_record_not_person_fact') throw new Error('來源紀錄格式、識別或唯讀限制不符。');
    ids.add(row.id);
    for (const ref of row.references) {
      if (!object(ref) || typeof ref.file !== 'string' || typeof ref.pointer !== 'string'
        || !/^[a-f0-9]{64}$/.test(String(ref.fileSha256)) || ref.originalClaimSha256 !== row.id) throw new Error('來源引用缺漏或與原紀錄不符。');
    }
  }
  return data.displayRecords as SourceDisplayRecord[];
}
export function filterSourceDisplay(rows: SourceDisplayRecord[], query: string, missing: boolean) {
  const needle = query.trim().toLocaleLowerCase();
  return rows.filter(r => (!missing || !r.claim.personId) && (!needle || JSON.stringify(r).toLocaleLowerCase().includes(needle)));
}
export function sourceHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
