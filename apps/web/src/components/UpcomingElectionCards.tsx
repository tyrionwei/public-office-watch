import { Link } from 'react-router-dom';
import { electionPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import { PixelFrame } from './PixelFrame';

type UpcomingElectionCardRace = {
  id: string;
  title: string;
  region: string;
  regionId: string;
  date: string;
  status: string;
  partyTag: keyof typeof partyTheme;
  partyLabel: string;
  electionId?: string;
};

type UpcomingElectionCardsProps = {
  races: UpcomingElectionCardRace[];
  selectedRegionId: string;
  selectedRegionLabel: string;
  selectedPublicRegionId: string | null;
  compact?: boolean;
};

const statusLabels: Record<string, string> = {
  upcoming: '即將進行',
  announced: '已公告',
  active: '進行中',
  completed: '已完成',
};

export function UpcomingElectionCards({
  races,
  selectedRegionId,
  selectedRegionLabel,
  selectedPublicRegionId,
  compact = false,
}: UpcomingElectionCardsProps) {
  const normalizedPublicRegionId = selectedPublicRegionId?.replace('region-', '') ?? null;

  return (
    <PixelFrame
      title={compact ? '即將到來的選舉' : '熱門選舉項目'}
      action={
        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
          目前選取區域：{selectedRegionLabel}
        </span>
      }
    >
      <div className={compact ? 'grid gap-3' : 'grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'}>
        {races.map((race, index) => {
          const theme = partyTheme[race.partyTag];
          const isRelated = race.regionId === normalizedPublicRegionId || race.regionId === selectedRegionId;

          if (compact) {
            return (
              <article
                key={race.id}
                className={[
                  'pixel-corners relative overflow-hidden border bg-bg/55 p-3 transition hover:border-white/20',
                  isRelated ? 'border-accent shadow-[0_0_18px_rgba(103,232,249,0.12)]' : 'border-line/80',
                ].join(' ')}
              >
                <div
                  className="pointer-events-none absolute inset-y-3 left-0 w-1"
                  style={{ backgroundColor: theme.primary }}
                  aria-hidden="true"
                />
                <div className="flex gap-3 pl-2">
                  <div
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-sm border bg-bg/70 font-display text-lg"
                    style={{ borderColor: theme.primary, color: theme.text }}
                    aria-hidden="true"
                  >
                    ▣
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-sm leading-tight text-white">{race.title}</p>
                        <p className="mt-1 text-xs text-slate-400">{race.region}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-signal">{race.date}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-500">{statusLabels[race.status] ?? race.status}</span>
                      {race.electionId ? (
                        <Link
                          to={electionPath(race.electionId)}
                          className="rounded-sm border border-accent/45 bg-accent/8 px-2 py-1 text-[11px] text-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                        >
                          查看選舉項目
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          }

          return (
            <article
              key={race.id}
              className={[
                'pixel-corners relative overflow-hidden border bg-bg/55 transition hover:-translate-y-0.5 hover:border-white/20',
                'p-4 xl:max-h-[240px] xl:overflow-auto',
                isRelated ? 'border-accent shadow-[0_0_24px_rgba(103,232,249,0.12)]' : 'border-line/80',
              ].join(' ')}
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: theme.primary }}
                aria-hidden="true"
              />

              <div className="flex items-start justify-between gap-3">
                <div
                  className="grid h-14 w-14 shrink-0 grid-cols-4 gap-0.5 rounded-sm border p-1"
                  style={{ borderColor: theme.primary, backgroundColor: `${theme.primary}20` }}
                  aria-hidden="true"
                >
                  {Array.from({ length: 16 }).map((_, pixel) => (
                    <span
                      key={pixel}
                      style={{ backgroundColor: [1, 2, 4, 5, 6, 9, 10, 13].includes(pixel) ? theme.primary : 'rgba(255,255,255,0.06)' }}
                    />
                  ))}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Card {index + 1}</p>
                  <p className="mt-1 font-display text-base leading-tight text-white">{race.title}</p>
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
                <div className="flex items-center justify-between gap-3 border-b border-line/40 pb-2">
                  <dt className="text-slate-500">區域關聯</dt>
                  <dd>{isRelated ? '目前選取區域相關' : '示範卡片'}</dd>
                </div>
                <div className="pt-1">
                  {race.electionId ? (
                    <Link
                      to={electionPath(race.electionId)}
                      className="inline-flex rounded-sm border border-accent/60 bg-accent/10 px-3 py-2 font-display text-xs uppercase tracking-[0.22em] text-accent focus:outline-none focus:ring-2 focus:ring-accent/35"
                    >
                      查看選舉資訊
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="rounded-sm border border-accent/30 bg-accent/8 px-3 py-2 font-display text-xs uppercase tracking-[0.22em] text-accent/60"
                    >
                      查看選舉資訊
                    </button>
                  )}
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </PixelFrame>
  );
}
