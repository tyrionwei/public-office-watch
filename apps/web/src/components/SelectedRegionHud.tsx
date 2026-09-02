import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { translateRaceCategory } from '../data/electionI18n';
import { getRaceCategoryByType } from '../data/electionLabels';
import type { RaceCategoryKey } from '../data/electionLabels';
import { getRegionHighlightBackground, getRegionHighlightImageSources } from '../data/regionHighlights';
import type { UpcomingRace } from '../data/mockHomeData';
import { regionPath } from '../routes/routePaths';
import type { StageRegionNode, StageRegionSummary } from '../types/stageMap';
import { PixelFrame } from './PixelFrame';

type SelectedRegionHudProps = {
  races: UpcomingRace[];
  regionNode: StageRegionNode | undefined;
  regionSummary: StageRegionSummary | undefined;
};


export function SelectedRegionHud({ races, regionNode, regionSummary }: SelectedRegionHudProps) {
  const { t } = useI18n();
  const categoryCounts = new Map<RaceCategoryKey, { key: RaceCategoryKey; label: string; count: number; order: number }>();

  for (const race of races) {
    const category = getRaceCategoryByType(race.raceType);
    const current = categoryCounts.get(category.key);
    categoryCounts.set(category.key, {
      key: category.key,
      label: translateRaceCategory(category.key, t),
      count: (current?.count ?? 0) + 1,
      order: category.order,
    });
  }

  const electionCategories = Array.from(categoryCounts.values()).sort((left, right) => left.order - right.order);
  const highlightBackground = getRegionHighlightBackground(regionNode?.id, regionNode?.publicRegionId, regionNode?.stageLabel);
  const highlightImage = highlightBackground ? getRegionHighlightImageSources(highlightBackground.image) : null;

  if (!regionSummary || !regionNode) {
    return null;
  }

  return (
    <PixelFrame
      title={t('regionHud.title')}
      className="[background:var(--theme-panel-gradient)]"
    >
      <div className="space-y-3 text-sm text-slate-300">
        <div
          className="theme-dark-surface relative flex min-h-[380px] flex-col overflow-hidden rounded-sm border border-accent/25 bg-slate-950 bg-cover bg-center p-6"
          data-region-highlight={highlightBackground?.regionId ?? regionNode.id}
          data-region-highlight-feature={highlightBackground?.feature ?? undefined}
          style={!highlightImage ? {
            backgroundImage: 'linear-gradient(180deg,rgba(12,93,161,0.94),rgba(10,68,122,0.86) 48%,rgba(9,27,57,0.96))',
          } : undefined}
        >
          {highlightImage ? (
            <img
              src={highlightImage.src}
              srcSet={highlightImage.srcSet}
              sizes="(min-width: 1280px) 36vw, (min-width: 768px) 70vw, 100vw"
              alt=""
              aria-hidden="true"
              {...({ fetchpriority: 'high' } as const)}
              loading="eager"
              decoding="async"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: highlightBackground?.focalPoint ?? 'center' }}
            />
          ) : null}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,12,24,0.18),rgba(5,12,24,0.58))]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_36%,rgba(125,211,252,0.28),transparent_34%),linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:auto,100%_18px]" />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 bg-[linear-gradient(180deg,transparent,rgba(5,12,24,0.9))]" />
          <div className="relative flex flex-1 flex-col">
            <p className="text-[11px] uppercase tracking-[0.22em] text-accent">{t('regionHud.currentCounty')}</p>
            <p className="mt-3 font-display text-4xl leading-none text-white">{regionSummary.label}</p>

            <div className="mt-auto max-w-full pt-10 sm:max-w-[74%]">
              <div className="grid max-w-[420px] gap-2 text-xs text-slate-100">
              <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
                <span className="font-semibold uppercase tracking-[0.18em] text-accent">{t('regionHud.nearestElection')}</span>
                <span className="font-medium text-white">{regionSummary.nearestElectionName}</span>
              </div>
              <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
                <span className="font-semibold uppercase tracking-[0.18em] text-accent">{t('regionHud.voteDate')}</span>
                <span className="font-display text-base text-signal">{regionSummary.nearestElectionDate}</span>
              </div>
              <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
                <span className="font-semibold uppercase tracking-[0.18em] text-accent">{t('regionHud.publicItems')}</span>
                <span className="text-white">{t('regionHud.upcomingRaceCount', { count: regionSummary.upcomingRaceCount })}</span>
              </div>
              </div>

              {electionCategories.length > 0 ? (
                <div className="mt-4 flex max-w-[430px] flex-wrap gap-2">
                {electionCategories.map((category, index) => (
                  <span
                    key={category.key}
                    className="inline-flex items-center gap-2 rounded-sm border border-white/15 bg-bg/55 px-2.5 py-1.5 text-xs text-slate-100"
                  >
                    <span
                      className="h-3 w-3 border border-slate-950"
                      style={{ backgroundColor: ['#f4d35e', '#7dd3fc', '#86efac'][index % 3] }}
                      aria-hidden="true"
                    />
                    {t('regionHud.categoryCount', { label: category.label, count: category.count })}
                  </span>
                ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="relative pt-4">
            {regionNode.id ? (
              <Link
                to={regionPath(regionNode.id)}
                className="pixel-corners inline-flex min-w-[220px] justify-center border border-yellow-200/70 bg-signal px-5 py-3 font-display text-sm uppercase tracking-[0.16em] text-slate-950 shadow-[0_4px_0_rgba(120,75,12,0.8)] transition hover:translate-y-0.5 hover:shadow-[0_2px_0_rgba(120,75,12,0.8)] focus:outline-none focus:ring-2 focus:ring-signal/40"
              >
                {t('regionHud.viewCounty')}
              </Link>
            ) : null}
          </div>
        </div>

      </div>
    </PixelFrame>
  );
}
