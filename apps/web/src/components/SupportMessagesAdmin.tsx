import { supportNetworks } from '../config/cryptoSupport';
import { useEffect, useState } from 'react';
import { FeedbackApiError, feedbackRequest } from '../lib/feedbackAdmin';

type SupportMessages = {
  page: number; page_size: number; total: number;
  items: Array<{ id: string; network_id: string; currency: string; receiving_address: string; reference: string; nickname: string | null; message: string | null; created_at: string }>;
};
export function SupportMessagesAdmin({ onUnauthorized }: { onUnauthorized: (status: number) => void }) {
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<SupportMessages | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false); setResult(null);
    void feedbackRequest<SupportMessages>('support-messages', { page }).then(data => {
      if (!data || !Array.isArray(data.items) || !Number.isSafeInteger(data.total) || !Number.isSafeInteger(data.page) || data.page_size !== 20) throw new Error('Invalid support response');
      if (active) setResult(data);
    }).catch(caught => {
      if (!active) return;
      setError(true);
      if (caught instanceof FeedbackApiError && [401, 403].includes(caught.status)) onUnauthorized(caught.status);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, version, onUnauthorized]);
  const button = 'border border-line px-3 py-2 text-sm disabled:opacity-50';
  return <section aria-labelledby="support-messages-title" className="min-w-0 space-y-4 border border-line bg-panel/60 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="support-messages-title" className="font-display text-xl">支持留言</h2>
      <button className={button} disabled={loading} onClick={() => setVersion(v => v + 1)}>重新讀取支持留言</button>
    </div>
    <p className="text-sm text-slate-400">僅管理者可見。交易參考資料未經付款驗證；筆數僅代表留言筆數。</p>
    {loading ? <p role="status">正在讀取支持留言…</p> : null}
    {error ? <p role="alert">支持留言讀取失敗，請重試。</p> : null}
    {result ? <>
      <p className="text-sm">留言筆數：{result.total}</p>
      {result.items.length === 0 ? <p>尚無支持留言。</p> : result.items.map(item => <article key={item.id} className="min-w-0 space-y-2 border-t border-line pt-3 text-sm">
        <h3 className="font-bold">{item.nickname ?? '匿名'}</h3>
        <p>{supportNetworks.find(network => network.networkId === item.network_id)?.displayName ?? item.network_id} · {item.currency}</p>
        <p>提交時間：{new Date(item.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p>
        <p className="break-all">本站收款地址快照：<span className="select-text font-mono">{item.receiving_address}</span></p>
        <p className="break-all">交易編號或付款錢包地址：<span className="select-text font-mono">{item.reference}</span></p>
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.message ?? '未填寫回饋'}</p>
      </article>)}
      <div className="flex items-center gap-3">
        <button className={button} disabled={loading || result.page <= 1} onClick={() => setPage(result.page - 1)}>上一頁</button>
        <span>第 {result.page} 頁</span>
        <button className={button} disabled={loading || result.page * result.page_size >= result.total} onClick={() => setPage(result.page + 1)}>下一頁</button>
      </div>
    </> : null}
  </section>;
}
