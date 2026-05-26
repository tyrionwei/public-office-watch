import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { fetchInternalDataProgress, type DataProgressSummary } from '../lib/internalDataProgress';

function isLocalProgressEnabled() {
  return import.meta.env.DEV;
}

function progressPercent(current: number, total: number) {
  return total > 0 ? Math.round((current / total) * 100) : 0;
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const percent = progressPercent(current, total);
  return (
    <div className="mt-3 h-3 border border-line/70 bg-bg/70">
      <div className="h-full bg-signal" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function InternalDataProgressPage() {
  const [summary, setSummary] = useState<DataProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLocalProgressEnabled()) return;

    setLoading(true);
    void fetchInternalDataProgress().then((result) => {
      setSummary(result);
      setLoading(false);
    });
  }, []);

  if (!isLocalProgressEnabled()) {
    return (
      <AppShell>
        <PixelFrame title="Not Found">
          <p className="text-sm text-slate-300">此頁僅在 local development 顯示。</p>
        </PixelFrame>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <PixelFrame title="Internal Data Progress">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-accent">local only / enrichment dashboard</p>
              <h2 className="mt-2 font-display text-3xl text-white">資料補齊進度</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                追蹤人物基本欄位、Wikidata 外部 ID、待審核 claim 與敏感資料缺口。這頁只用於本機開發與資料整理。
              </p>
            </div>
            <a href="/internal/review-queue" className="pixel-corners border border-accent/60 px-4 py-2 text-sm text-accent hover:bg-accent/10">
              前往審核佇列
            </a>
          </div>
        </PixelFrame>

        {loading ? <SectionPanel title="載入中" eyebrow="loading"><p className="text-sm text-slate-400">統計資料讀取中...</p></SectionPanel> : null}
        {summary?.error ? (
          <p className="pixel-corners border border-rose-400/50 bg-rose-500/10 p-4 text-sm text-rose-300">{summary.error}</p>
        ) : null}

        {summary && !loading ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SectionPanel title="人物總數" eyebrow="people">
                <p className="font-display text-4xl text-white">{summary.peopleTotal}</p>
                <p className="mt-2 text-sm text-slate-400">public_people</p>
              </SectionPanel>
              <SectionPanel title="公開 Claims" eyebrow="verified">
                <p className="font-display text-4xl text-signal">{summary.publicClaimTotal}</p>
                <p className="mt-2 text-sm text-slate-400">已公開補充欄位</p>
              </SectionPanel>
              <SectionPanel title="待審核 Claims" eyebrow="pending">
                <p className="font-display text-4xl text-accent">{summary.pendingClaimTotal}</p>
                <p className="mt-2 text-sm text-slate-400">review queue</p>
              </SectionPanel>
              <SectionPanel title="敏感待審" eyebrow="manual">
                <p className="font-display text-4xl text-rose-300">{summary.sensitivePendingTotal}</p>
                <p className="mt-2 text-sm text-slate-400">司法紀錄 / 家族關係</p>
              </SectionPanel>
            </div>

            <SectionPanel title="核心欄位完整度" eyebrow="coverage">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summary.metrics.map((metric) => (
                  <div key={metric.key} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-display text-lg text-white">{metric.label}</h3>
                      <span className="text-sm text-signal">{progressPercent(metric.current, metric.total)}%</span>
                    </div>
                    <ProgressBar current={metric.current} total={metric.total} />
                    <p className="mt-3 text-sm text-slate-400">
                      {metric.current} / {metric.total}，{metric.note}
                    </p>
                  </div>
                ))}
              </div>
            </SectionPanel>

            <div className="grid gap-4 xl:grid-cols-2">
              <SectionPanel title="待審核類型" eyebrow="claim types">
                <div className="space-y-2">
                  {summary.pendingByType.length === 0 ? <p className="text-sm text-slate-400">目前沒有待審核 claim。</p> : null}
                  {summary.pendingByType.map((item) => (
                    <div key={item.type} className="pixel-corners flex items-center justify-between border border-line/70 bg-bg/35 px-3 py-2 text-sm">
                      <span className="text-slate-300">{item.type}</span>
                      <span className="text-accent">{item.count}</span>
                    </div>
                  ))}
                </div>
              </SectionPanel>

              <SectionPanel title="待審核來源" eyebrow="sources">
                <div className="space-y-2">
                  {summary.pendingBySource.length === 0 ? <p className="text-sm text-slate-400">目前沒有待審核來源。</p> : null}
                  {summary.pendingBySource.map((item) => (
                    <div key={item.source} className="pixel-corners flex items-center justify-between border border-line/70 bg-bg/35 px-3 py-2 text-sm">
                      <span className="text-slate-300">{item.source}</span>
                      <span className="text-accent">{item.count}</span>
                    </div>
                  ))}
                </div>
              </SectionPanel>
            </div>

            <SectionPanel title="核心資料缺口" eyebrow="first 25 people">
              <div className="grid gap-2">
                {summary.missingCorePeople.length === 0 ? <p className="text-sm text-slate-400">目前核心欄位都已補齊。</p> : null}
                {summary.missingCorePeople.map((person) => (
                  <a
                    key={person.personId}
                    href={`/people/${person.personId}`}
                    className="pixel-corners flex flex-col gap-2 border border-line/70 bg-bg/35 px-3 py-3 text-sm hover:border-accent/60 md:flex-row md:items-center md:justify-between"
                  >
                    <span className="font-semibold text-white">{person.name}</span>
                    <span className="text-slate-400">缺：{person.missing.join('、')}</span>
                  </a>
                ))}
              </div>
            </SectionPanel>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
