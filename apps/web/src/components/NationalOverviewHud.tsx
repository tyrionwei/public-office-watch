import { useI18n } from '../i18n';
import type { UpcomingRace } from '../lib/publicDataProvider';
import { PixelFrame } from './PixelFrame';

type NationalOverviewHudProps = {
  races: UpcomingRace[];
};

export function NationalOverviewHud({ races }: NationalOverviewHudProps) {
  const { t } = useI18n();
  const nearestRace = races
    .filter((race) => Boolean(race.date))
    .sort((left, right) => left.date.localeCompare(right.date))[0] ?? null;

  return (
    <PixelFrame
      title={t('national.title')}
      className="bg-[linear-gradient(145deg,rgba(10,35,65,0.98),rgba(8,19,39,0.95)_58%,rgba(16,31,54,0.96))]"
    >
      <div data-national-overview className="relative overflow-hidden p-1">
        <div className="pointer-events-none absolute right-1 top-0 font-display text-7xl leading-none text-accent/10">TW</div>
        <p className="text-xs uppercase tracking-[0.24em] text-accent">{t('national.currentScope')}</p>
        <h1 className="mt-2 font-display text-3xl text-white">{t('national.taiwan')}</h1>
        <p className="mt-2 max-w-lg text-sm leading-6 text-slate-300">{t('national.description')}</p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="pixel-corners border border-line/70 bg-bg/40 p-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t('national.upcomingNational')}</p>
            <p className="mt-2 font-display text-3xl text-signal">{races.length}</p>
          </div>
          <div className="pixel-corners border border-line/70 bg-bg/40 p-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t('national.nearestElection')}</p>
            <p className="mt-2 line-clamp-2 font-display text-lg text-white">
              {nearestRace?.title ?? t('national.noAnnouncedElection')}
            </p>
          </div>
        </div>

        <p className="mt-4 border-t border-line/60 pt-3 text-xs leading-5 text-slate-400">
          {t('national.selectCountyHint')}
        </p>
      </div>
    </PixelFrame>
  );
}
