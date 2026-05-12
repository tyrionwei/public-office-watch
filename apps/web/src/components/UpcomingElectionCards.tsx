import type { UpcomingRace } from '../data/mockHomeData';
import { partyTheme } from '../styles/partyThemes';
import { PixelFrame } from './PixelFrame';

type UpcomingElectionCardsProps = {
  races: UpcomingRace[];
};

const statusLabels: Record<string, string> = {
  upcoming: '即將進行',
  announced: '已公告',
  active: '進行中',
  completed: '已完成',
};

export function UpcomingElectionCards({ races }: UpcomingElectionCardsProps) {
  return (
    <PixelFrame
      title="Upcoming Election Cards"
      action={<span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">party color + text label</span>}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {races.map((race, index) => {
          const theme = partyTheme[race.partyTag];
          return (
            <article
              key={race.id}
              className="pixel-corners relative overflow-hidden border border-line/80 bg-bg/55 p-4 transition hover:-translate-y-0.5 hover:border-white/20"
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: theme.primary }}
                aria-hidden="true"
              />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Card {index + 1}</p>
                  <p className="mt-2 font-display text-lg leading-tight text-white">{race.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{race.region}</p>
                </div>
                <span
                  className="shrink-0 rounded-sm px-2 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: `${theme.primary}26`,
                    color: theme.text,
                    border: `1px solid ${theme.primary}`,
                  }}
                >
                  {race.partyLabel}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3 border-b border-line/40 pb-2">
                  <dt className="text-slate-500">投票日</dt>
                  <dd>{race.date}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-line/40 pb-2">
                  <dt className="text-slate-500">狀態</dt>
                  <dd>{statusLabels[race.status] ?? race.status}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">識別標籤</dt>
                  <dd>{race.partyLabel}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </PixelFrame>
  );
}
