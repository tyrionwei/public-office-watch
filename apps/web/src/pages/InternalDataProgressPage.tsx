import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { fetchInternalDataProgress } from '../lib/internalDataProgress';
import type { DataProgressSummary } from '../lib/dataProgressContract';

const number = (value: number | null) => value === null ? '未知' : value.toLocaleString('zh-TW');
const percent = (part: number | null, total: number | null) => part === null || total === null || total === 0 ? '暫不計算' : `${(100 * part / total).toFixed(1)}%`;
const date = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('zh-TW') : '未知';
const states: Record<string, string> = { missing: '內容缺漏', complete: '首次補查完成', unsearched: '尚未查', incomplete: '部分失敗／等待重試', due: '到期待重查', excluded: '未在候選池', unknown: '狀態未知', pending: '待審核', needs_more_evidence: '待補證', identity: '身分待確認', leads: '未結案線索', publication: '已核准待發布', raw: '原始來源／去重事件' };
const buttonClass = 'rounded border border-line/70 px-3 py-2 text-sm text-slate-200 hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40';

export function InternalDataProgressPage() {
  const [params, setParams] = useSearchParams();
  const [summary, setSummary] = useState<DataProgressSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const queryString = params.toString();
  const lastRefresh = useRef(0);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let active = true;
    setLoading(true); setError(''); setSummary(null);
    const requestParams = new URLSearchParams(queryString);
    if (lastRefresh.current !== refresh) requestParams.set('refresh', '1');
    lastRefresh.current = refresh;
    void fetchInternalDataProgress(requestParams).then(result => {
      if (active) setSummary(result);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : '無法讀取本機進度');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [queryString, refresh]);

  useEffect(() => {
    if (summary && new URLSearchParams(queryString).has('section')) document.getElementById('progress-details')?.scrollIntoView({ block: 'start' });
  }, [summary, queryString]);

  const change = (values: Record<string, string>, reset = true) => {
    const next = new URLSearchParams(params);
    if (reset) next.delete('page');
    if ('year' in values || 'scope' in values) next.delete('region');
    for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); }
    setParams(next);
  };
  const drill = (section: string, state = '', group = '') => change({ section, state, group, q: '' });
  const currentSection = params.get('section') || 'gaps';
  const filter = (key: string, label: string, choices: [string, string][]) => <label className="flex min-w-0 flex-col gap-2 text-xs text-slate-400" key={key}>{label}<select aria-label={label} value={params.get(key) || ''} onChange={event => change({ [key]: event.target.value, state: '', group: '' })} className="min-w-0 rounded border border-line/70 bg-bg p-2 text-sm text-white"><option value="">全部</option>{choices.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>;
  const countButton = (count: number | null, section: string, state = '', group = '') => <button disabled={count === null} onClick={() => drill(section, state, group)} className="text-accent underline decoration-accent/40 underline-offset-4 disabled:text-slate-500 disabled:no-underline">{number(count)}</button>;

  if (!import.meta.env.DEV) return <AppShell><PixelFrame title="Not Found"><p>此頁僅在本機開發環境顯示。</p></PixelFrame></AppShell>;
  return <AppShell><div className="space-y-5">
    <PixelFrame title="Data & Research Progress">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs tracking-widest text-accent">本機限定 · 唯讀總覽</p><h1 className="mt-2 font-display text-3xl text-white">全站資料與研究進度中心</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">看資料還缺多少、人物查到哪裡、線索卡在哪一步，以及排程是否有推進。資料完整度、搜尋覆蓋與審核進度分開呈現。</p></div>
        <button className={buttonClass} onClick={() => setRefresh(value => value + 1)} disabled={loading}>重新讀取</button>
      </div>
      <nav aria-label="進度視角" className="mt-5 flex flex-wrap gap-2">{[['all', '全站／所有年份'], ['current', '現任公職'], ['election', '本屆參選'], ['history', '歷屆資料']].map(([value, label]) => <button key={value} aria-pressed={(params.get('scope') || 'all') === value} onClick={() => change({ scope: value, year: '', result: '', tenure: '', state: '', group: '' })} className={`${buttonClass} ${(params.get('scope') || 'all') === value ? 'border-accent bg-accent/10 text-accent' : ''}`}>{label}</button>)}</nav>
      <p className="mt-3 text-xs leading-5 text-slate-400">人物去重計算；不同屆次的參選紀錄分別計算。不同視角和職務的人數不能直接相加。本屆參選以本年為範圍。</p>
    </PixelFrame>
    {loading && <p role="status" className="p-4 text-slate-300">正在讀取本機資料與執行紀錄…</p>}
    {error && <div role="alert" className="border border-rose-400/50 bg-rose-500/10 p-4 text-rose-200">{error}<button className={`${buttonClass} ml-3`} onClick={() => setRefresh(value => value + 1)}>重試</button></div>}
    {summary && <>
      <SectionPanel title="統計範圍" eyebrow="scope">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {filter('year', '參選年份', summary.options.years.map(y => [y, y]))}
          {filter('office', '人物職務群組', summary.options.offices.map(o => [o, o]))}
          {filter('region', '參選縣市', summary.options.regions.map(r => [r, r]))}
          {filter('tenure', '任職狀態', [['current', '現任'], ['former', '曾任（任期證據未接入）'], ['unknown', '尚無確認任職分類']])}
          {filter('result', '該次參選結果', [['elected', '當選'], ['not_elected', '未當選'], ['pending', '結果待定'], ['unknown', '結果未知']])}
          {filter('inclusion', '搜尋納入狀態', [['included', '已在候選池'], ['outside', '未在候選池／原因待確認']])}
        </div><p className="mt-3 text-xs text-slate-400">快照時間（最多重用 5 分鐘，可重新讀取）：{date(summary.generatedAt)} · {number(summary.people)} 位人物／{number(summary.candidates)} 筆參選紀錄。縣市選項依參選年份保留當屆名稱；所有年份可同時包含新舊縣市。篩選影響資料、研究及已對應人物的待辦；排程固定顯示全站。</p>
      </SectionPanel>
      {summary.errors.length > 0 && <div role="alert" className="rounded border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100"><p>部分資料未接入或讀取失敗；受影響的統計不視為零或完成。</p><details className="mt-2"><summary className="cursor-pointer">查看來源狀態（{summary.errors.length}）</summary><ul className="mt-2 space-y-1">{summary.errors.map(e => <li key={e}>{e}</li>)}</ul></details></div>}
      <SectionPanel title="全站資料缺口" eyebrow="01 / data gaps">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded border border-accent/40 bg-accent/5 p-5"><p className="text-sm text-slate-300">可統計必要項目的缺口率</p><p className="mt-2 font-display text-4xl text-accent">{percent(summary.gap.missing, summary.gap.total)}</p><p className="mt-3 text-sm">{countButton(summary.gap.missing, 'gaps')}／{number(summary.gap.total)} 個必要項目</p><p className="mt-2 text-xs text-slate-400">已接入 2／7 模組的必要項目；尚未收錄部分未納入。</p></div>
          <div className="rounded border border-line/70 p-5"><p className="text-sm text-slate-300">尚未收錄</p><p className="mt-2 font-display text-2xl text-white">分母待確認</p><p className="mt-3 text-sm text-slate-400">預期官方名冊尚未接入；不以已收錄數量當成應收錄總量。</p></div>
          <div className="rounded border border-line/70 p-5"><p className="text-sm text-slate-300">等待來源／適用日期確認</p><p className="mt-2 font-display text-2xl text-white">{number(summary.gap.waiting)} 筆結果</p><p className="mt-3 text-sm text-slate-400">本年及未來選舉結果未納入；不視為完成，也不直接當成缺漏。</p></div>
        </div>
        <p className="my-4 text-sm leading-6 text-slate-400">這是已收錄、且已有必要項目定義的範圍，並非全站已完成比例。版本 {summary.version}；未知分母的模組、尚未收錄對象與補充欄位另行揭露。待審核和待發布不與內容缺漏重複加總。</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="border-b border-line text-slate-400"><tr><th className="p-3">資料模組</th><th className="p-3">缺口／必要項目</th><th className="p-3">缺口率</th><th className="p-3">範圍與限制</th></tr></thead><tbody>{summary.metrics.map(m => <tr key={m.key} className="border-b border-line/40"><th className="p-3 font-normal text-white">{m.label}</th><td className="p-3 whitespace-nowrap">{m.missing === null ? '分母待確認' : <>{countButton(m.missing, 'gaps', 'missing', m.label)}／{number(m.total)}</>}</td><td className="p-3 whitespace-nowrap">{percent(m.missing, m.total)}</td><td className="max-w-md p-3 text-slate-400">{m.note}</td></tr>)}</tbody></table></div>
      </SectionPanel>
      <SectionPanel title="人物研究覆蓋" eyebrow="02 / research">
        <p className="mb-4 text-sm leading-6 text-slate-400">只計家族關係、黨籍異動與司法線索的指定搜尋。三類皆成功才算首次完成；100% 不代表資料完整或沒有相關紀錄。分母為目前篩選人物中，已在保存候選池內的人數。</p>
        <p className="mb-3 text-xs text-slate-400">候選池時間：{date(summary.research.poolAt)} · 搜尋狀態時間：{date(summary.research.stateAt)}。保存的候選池可能落後目前名冊。</p>
        {summary.research.groups.length ? <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b border-line text-slate-400"><tr><th className="p-3">依原搜尋順序</th><th className="p-3">首次完成／納入人數</th><th className="p-3">覆蓋率</th><th className="p-3">尚未查</th><th className="p-3">到期待重查</th><th className="p-3">部分失敗</th></tr></thead><tbody>{summary.research.groups.map(g => <tr key={g.label} className="border-b border-line/40"><th className="p-3 font-normal"><button className="text-white underline underline-offset-4" onClick={() => drill('research', '', g.label)}>{g.label}</button></th><td className="p-3">{countButton(g.complete, 'research', 'complete', g.label)}／{countButton(g.total, 'research', 'included', g.label)}</td><td className="p-3 text-signal">{percent(g.complete, g.total)}</td><td className="p-3">{countButton(g.unsearched, 'research', 'unsearched', g.label)}</td><td className="p-3">{countButton(g.due, 'research', 'due', g.label)}</td><td className="p-3">{countButton(g.incomplete, 'research', 'incomplete', g.label)}</td></tr>)}</tbody></table></div> : <p className="text-slate-400">搜尋候選池或所需篩選資料未接入，暫不計算覆盖率。</p>}
        <p className="mt-4 text-sm">未在保存候選池：{countButton(summary.research.excluded, 'research', 'excluded')} 人；不代表沒有資料缺口。</p>
        <details className="mt-4 rounded border border-line/70 p-3 text-sm text-slate-300"><summary className="cursor-pointer">搜尋範圍與既有規則</summary><p className="mt-3 leading-6">每日 25 人。同層級先近期選舉，再現任、再次參選與歷史候選人。基層依現任、曾當選、多次參選未當選、僅一次參選未當選排序；現任較高職務者依現職分類。暫時排除 2026 首次參選者、縣市副首長與局處首長；逐人排除原因未完整接入時標示待確認。</p><p className="mt-2 leading-6">三類皆成功後，最低冷卻 30 天；有補查與到期監測時約半數名額留給到期監測。生日、性別、學經歷、外部 ID 及歷屆政見另由其他資料流程處理。</p></details>
      </SectionPanel>
      <SectionPanel title="線索與審核積壓" eyebrow="03 / review backlog">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{summary.backlog.map(b => <div key={b.key} className="rounded border border-line/70 bg-bg/30 p-4"><h3 className="text-sm text-slate-300">{b.label}</h3><p className="mt-2 font-display text-3xl">{countButton(b.count, 'backlog', b.key)}</p><p className="mt-3 text-xs leading-5 text-slate-400">{b.note}</p></div>)}</div>
        <p className="mt-4 text-sm text-slate-400">來源紀錄、線索、待審主張與人物是不同統計單位，不提供混加的總件數。敏感線索維持私人待審。</p>
      </SectionPanel>
      <SectionPanel title="排程與執行紀錄" eyebrow="04 / scheduled runs">
        <div className="grid gap-4 xl:grid-cols-3">{summary.schedules.map(s => <article key={s.label} className="rounded border border-line/70 p-4"><h3 className="font-display text-xl text-white">{s.label}</h3><p className="mt-2 text-sm text-accent">{s.status}</p><p className="mt-3 text-xs leading-5 text-slate-400">{s.configured}</p><dl className="mt-4 space-y-2 text-sm"><div><dt className="text-slate-400">最近保存摘要</dt><dd>{date(s.observedAt)}</dd></div><div><dt className="text-slate-400">此摘要可確認的完整成功時間</dt><dd>{date(s.completeAt)}</dd></div><div><dt className="text-slate-400">成功步驟／摘要步驟</dt><dd>{number(s.passed)}／{number(s.total)}</dd></div></dl><details className="mt-4 text-sm"><summary className="cursor-pointer">步驟與產物處理狀態</summary><ul className="mt-2 space-y-2">{s.steps.map((step, i) => <li key={i} className="break-words">{step.label} · {step.status}</li>)}</ul><p className="mt-3 text-xs leading-5 text-slate-400">{s.review}</p><p className="mt-2 break-all text-xs text-slate-500">{s.source}</p></details></article>)}</div>
        <p className="mt-4 text-sm text-slate-400">排程設定與執行證據分開；沒有即時執行紀錄時，不宣稱正在執行。舊摘要不代表今天取得新資料。</p>
      </SectionPanel>
      <div id="progress-details" className="scroll-mt-8"><SectionPanel title="篩選明細與下一步" eyebrow="details">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-400">明細類型<select aria-label="明細類型" value={currentSection} onChange={e => drill(e.target.value)} className="ml-2 rounded border border-line bg-bg p-2 text-sm"><option value="gaps">內容缺口</option><option value="research">人物研究</option><option value="backlog">線索與審核</option></select></label>
          <label className="text-xs text-slate-400">狀態<select aria-label="明細狀態" value={params.get('state') || ''} onChange={e => change({ state: e.target.value })} className="ml-2 rounded border border-line bg-bg p-2 text-sm"><option value="">全部</option>{Object.entries(states).filter(([key]) => currentSection === 'research' ? ['complete', 'unsearched', 'incomplete', 'due', 'excluded', 'unknown'].includes(key) : currentSection === 'backlog' ? ['pending', 'needs_more_evidence', 'identity', 'leads'].includes(key) : key === 'missing').map(([key, label]) => <option key={key} value={key}>{label}</option>)}{params.get('state') === 'included' && <option value="included">已納入搜尋</option>}</select></label>
          <form className="flex gap-2" key={params.get('q') || ''} onSubmit={e => { e.preventDefault(); change({ q: String(new FormData(e.currentTarget).get('q') || '') }); }}><input aria-label="搜尋明細" name="q" defaultValue={params.get('q') || ''} placeholder="人物、原因或來源" className="min-w-0 rounded border border-line bg-bg p-2 text-sm"/><button className={buttonClass}>搜尋</button></form>
          {params.get('group') && <button className={buttonClass} onClick={() => change({ group: '' })}>清除群組：{params.get('group')}</button>}
        </div>
        <p className="my-4 text-sm text-slate-400">{summary.details.total.toLocaleString()} 筆 · 第 {summary.details.page}／{summary.details.pages} 頁。{summary.errors.length ? '資料來源不完整，空白不代表沒有待辦。' : '未知或未接入的模組不包含在此清單。'}</p>
        <div className="space-y-3">{summary.details.rows.map(row => <article key={row.id} className="rounded border border-line/70 bg-bg/30 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-white">{row.personId ? <Link className="underline underline-offset-4" to={`/people/${encodeURIComponent(row.personId)}`}>{row.label}</Link> : row.label}</h3><span className="text-xs text-accent">{states[row.state] || row.state}</span></div><p className="mt-2 text-sm leading-6 text-slate-300">{row.reason}</p><p className="mt-2 break-words text-xs text-slate-400">來源：{row.source || '未知'} {row.sourceUrl && <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="text-accent underline">開啟來源</a>} · 紀錄時間：{date(row.date)}{row.date && Number.isFinite(Date.parse(row.date)) && `（距今 ${Math.max(0, Math.floor((Date.parse(summary.generatedAt) - Date.parse(row.date)) / 86400000))} 天）`}</p><p className="mt-2 text-sm text-slate-300">下一步：{row.next}</p>{row.section === 'backlog' && <Link className="mt-3 inline-block text-sm text-accent underline" to={`/internal/review-queue?${new URLSearchParams({ ...(row.reviewStatus ? { reviewStatus: row.reviewStatus } : {}), ...(row.claimType ? { claimType: row.claimType } : {}), ...(row.reviewStatus ? { personName: row.label } : {}), returnTo: `/internal/data-progress?${params}` })}`}>前往審核佇列</Link>}</article>)}</div>
        {!summary.details.rows.length && <p className="rounded border border-line/70 p-5 text-sm text-slate-400">目前可讀資料中，沒有符合此篩選的明細。未接入或未知不等於已完成。</p>}
        <div className="mt-4 flex items-center justify-between"><button className={buttonClass} disabled={summary.details.page <= 1} onClick={() => change({ page: String(summary.details.page - 1) }, false)}>上一頁</button><Link to={`/internal/review-queue?${new URLSearchParams({ returnTo: `/internal/data-progress?${params}` })}`} className="text-sm text-accent underline">開啟審核佇列</Link><button className={buttonClass} disabled={summary.details.page >= summary.details.pages} onClick={() => change({ page: String(summary.details.page + 1) }, false)}>下一頁</button></div>
      </SectionPanel></div>
    </>}
  </div></AppShell>;
}
