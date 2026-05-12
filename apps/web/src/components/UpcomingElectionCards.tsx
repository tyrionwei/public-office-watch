import type { UpcomingRace } from '../data/mockHomeData';
import { partyTheme } from '../styles/partyThemes';
import { PixelFrame } from './PixelFrame';

type UpcomingElectionCardsProps = {
  races: UpcomingRace[];
};

export function UpcomingElectionCards({ races }: UpcomingElectionCardsProps) {
  return (
    <PixelFrame title="Upcoming Election Cards">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {races.map((race) => {
          const theme = partyTheme[race.partyTag];
          return (
            <article key={race.id} className="rounded-sm border border-line bg-bg/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg text-white">{race.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{race.region}</p>
                </div>
                <span
                  className="rounded-sm px-2 py-1 text-xs font-semibold"
                  style={{ backgroundColor: `${theme.primary}30`, color: theme.text, border: `1px solid ${theme.primary}` }}
                >
                  {race.partyLabel}
                </span>
              </div>
              <dl className="mt-4 space-y-2 text-sm text-slate-300">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Date</dt>
                  <dd>{race.date}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Status</dt>
                  <dd>{race.status}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </PixelFrame>
  );
}
