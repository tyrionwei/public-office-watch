import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { buildElectionEvents } from '../data/electionEvents';
import { getElectionStatusLabel } from '../data/electionLabels';
import { publicDataProvider } from '../lib/publicData';
import { electionEventPath } from '../routes/routePaths';

function groupEventsByYear(events: ReturnType<typeof buildElectionEvents>) {
  const groups = new Map<string, typeof events>();

  for (const event of events) {
    const key = event.year ? String(event.year) : '未定年份';
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }

  return Array.from(groups.entries()).sort((left, right) => {
    const leftYear = Number.parseInt(left[0], 10);
    const rightYear = Number.parseInt(right[0], 10);

    if (Number.isFinite(leftYear) && Number.isFinite(rightYear)) return rightYear - leftYear;
    return left[0].localeCompare(right[0], 'zh-TW');
  });
}

export function ElectionsPage() {
  const events = buildElectionEvents(publicDataProvider.getElections(), publicDataProvider.getRaces());
  const eventGroups = groupEventsByYear(events);
  const upcomingEvents = events.filter((event) => ['active', 'upcoming', 'announced'].includes(event.status));
  const totalRaces = events.reduce((total, event) => total + event.races.length, 0);

  return (
    <AppShell>
      <div className="space-y-4">
        <PixelFrame
          title="選舉年份"
          action={<span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{events.length} 個大選事件</span>}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.34fr)]">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.24em] text-accent">ELECTION EVENTS</p>
              <h1 className="mt-2 font-display text-4xl text-white">依年份選擇大選</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                入口改以「大選事件」呈現；同一天且同一政治脈絡的原始選舉會合併，例如總統副總統與立法委員、地方公職與村里長。點進年份事件後，再依左側項目與右側縣市篩選選區。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <HudStatCard label="大選事件" value={<span className="font-display text-xl text-white">{events.length}</span>} />
              <HudStatCard label="選區項目" value={<span className="font-display text-xl text-white">{totalRaces}</span>} />
              <HudStatCard label="即將到來" value={<span className="font-display text-xl text-signal">{upcomingEvents.length}</span>} />
            </div>
          </div>
        </PixelFrame>

        {eventGroups.length > 0 ? (
          eventGroups.map(([year, yearEvents]) => (
            <SectionPanel key={year} title={year} eyebrow="年份">
              <div className="grid gap-3 xl:grid-cols-2">
                {yearEvents.map((event) => (
                  <Link
                    key={event.key}
                    to={electionEventPath(event.key)}
                    className="pixel-corners block border border-line/70 bg-bg/35 p-4 transition hover:border-accent/60 hover:bg-accent/8 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/35"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{event.votingDate ?? '投票日待公告'}</p>
                        <h2 className="mt-2 font-display text-2xl text-white">{event.title}</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-400">原始資料：{event.sourceNameSummary}</p>
                      </div>
                      <span className={['active', 'upcoming', 'announced'].includes(event.status) ? 'pixel-corners border border-signal/55 bg-signal/10 px-2 py-1 text-xs text-signal' : 'pixel-corners border border-line/70 bg-panelAlt/45 px-2 py-1 text-xs text-slate-300'}>
                        {getElectionStatusLabel(event.status)}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">包含項目</p>
                        <p className="mt-1 truncate">{event.categorySummary}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">區域</p>
                        <p className="mt-1 truncate">{event.regionSummary}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">選區</p>
                        <p className="mt-1">{event.races.length} 項</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </SectionPanel>
          ))
        ) : (
          <PixelFrame title="選舉資料載入中">
            <p className="text-sm text-slate-300">目前尚未載入可公開的選舉事件資料。</p>
          </PixelFrame>
        )}
      </div>
    </AppShell>
  );
}
