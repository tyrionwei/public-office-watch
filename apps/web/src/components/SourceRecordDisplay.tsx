import { useRef, useState } from 'react';
import { filterSourceDisplay, parseSourceDisplay, sourceHttpUrl, type SourceDisplayRecord } from '../lib/sourceRecordDisplay';

export function SourceRecordDisplay() {
  const [rows, setRows] = useState<SourceDisplayRecord[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [missing, setMissing] = useState(false);
  const [page, setPage] = useState(0);
  const loadSequence = useRef(0);
  const selected = filterSourceDisplay(rows, query, missing);
  const count = rows.reduce((n,r) => n + r.references.length, 0);
  const button = 'border border-line px-3 py-2 disabled:opacity-40';
  return <section aria-label="既存來源去重檢視" className="space-y-4 text-slate-200">
    <h2 className="text-2xl text-white">既存來源去重檢視</h2>
    <p>只整理顯示；不合併人物或事實，不核准、不匯入。原審核與各來源引用全部保留。內容雜湊不是正式 claim ID。</p>
    <p>選取本機 normalized-content-groups.json。檔案只在此瀏覽器記憶體讀取，不上傳、不保存到瀏覽器儲存空間。</p>
    <label className="block">開啟本機來源索引<input className="block" type="file" accept=".json,application/json" onChange={async event => {
      const sequence = ++loadSequence.current; const file = event.target.files?.[0];
      setRows([]); setError(''); setPage(0);
      if (!file) return;
      try { if (file.size > 32 * 1024 * 1024) throw new Error('檔案超過 32 MB。');
        const parsed = parseSourceDisplay(await file.text()); if (sequence === loadSequence.current) setRows(parsed);
      } catch (reason) { if (sequence === loadSequence.current) setError(reason instanceof Error ? reason.message : '無法讀取索引'); }
    }}/></label>
    {error && <p role="alert">{error}</p>}
    <p role="status">{rows.length} 筆顯示紀錄／{count} 個原始引用；篩選 {selected.length} 筆</p>
    <label className="block">搜尋來源、人物或內容<input className="ml-2 bg-slate-900 p-2" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label>
    <label className="block"><input type="checkbox" checked={missing} onChange={e=>{setMissing(e.target.checked);setPage(0);}}/> 僅顯示人物 ID 缺漏</label>
    <div className="flex gap-3"><button className={button} disabled={!page} onClick={()=>setPage(p=>p-1)}>上一頁</button><span>第 {page+1}／{Math.max(1,Math.ceil(selected.length/20))} 頁</span><button className={button} disabled={(page+1)*20>=selected.length} onClick={()=>setPage(p=>p+1)}>下一頁</button></div>
    {selected.slice(page*20,(page+1)*20).map(row => <article key={row.id} className="break-words border border-line p-4">
      <h3>{String(row.claim.personName || '身分待對應')} · {String(row.claim.claimType)}</h3>
      <p>人物 ID：{String(row.claim.personId || '未知')} · 原審核：{String(row.claim.reviewStatus || '未知')}（不是本次批准）</p>
      <p className="whitespace-pre-wrap">{String(row.claim.claimValue)}</p>
      <p>來源：{String(row.claim.sourceName || '未知')} {sourceHttpUrl(row.claim.sourceUrl) && <a className="text-accent underline" target="_blank" rel="noreferrer" href={sourceHttpUrl(row.claim.sourceUrl)!}>原始出處連結</a>}</p>
      <details><summary>原始引用與審核（{row.references.length}）</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(row.references,null,2)}</pre></details>
      <details><summary>完整原紀錄與識別</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(row,null,2)}</pre></details>
    </article>)}
  </section>;
}
