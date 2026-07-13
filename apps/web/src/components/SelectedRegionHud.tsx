import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { getRegionHighlightBackground } from '../data/regionHighlights';
import { regionPath } from '../routes/routePaths';
import type { StageRegionNode, StageRegionSummary } from '../types/stageMap';
import { PixelFrame } from './PixelFrame';

type SelectedRegionHudRegion = {
  tone: string;
};

type SelectedRegionHudProps = {
  region: SelectedRegionHudRegion | undefined;
  regionNode: StageRegionNode | undefined;
  regionSummary: StageRegionSummary | undefined;
};


export function SelectedRegionHud({ region, regionNode, regionSummary }: SelectedRegionHudProps) {
  const { t } = useI18n();
  const electionItemLabels = [t('regionHud.chiefElection'), t('regionHud.representativeElection'), t('regionHud.basicOffice')];
  const highlightBackground = getRegionHighlightBackground(regionNode?.id, regionNode?.publicRegionId, regionNode?.stageLabel);
  const heroBackgroundImage = highlightBackground
    ? `linear-gradient(180deg,rgba(5,12,24,0.18),rgba(5,12,24,0.58)),url(${highlightBackground.image})`
    : 'linear-gradient(180deg,rgba(12,93,161,0.94),rgba(10,68,122,0.86) 48%,rgba(9,27,57,0.96))';

  if (!regionSummary || !regionNode) {
    return null;
  }

  return (
    <PixelFrame
      title={t('regionHud.title')}
      className="bg-[linear-gradient(180deg,rgba(6,46,91,0.95),rgba(9,37,74,0.92)_55%,rgba(10,19,39,0.95))]"
    >
      <div className="space-y-3 text-sm text-slate-300">
        <div
          className="relative min-h-[298px] overflow-hidden rounded-sm border border-accent/25 bg-slate-950 bg-cover bg-center p-5"
          data-region-highlight={highlightBackground?.regionId ?? regionNode.id}
          data-region-highlight-feature={highlightBackground?.feature ?? undefined}
          style={{
            backgroundImage: heroBackgroundImage,
            backgroundPosition: highlightBackground?.focalPoint ?? 'center',
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_36%,rgba(125,211,252,0.28),transparent_34%),linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:auto,100%_18px]" />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 bg-[linear-gradient(180deg,transparent,rgba(5,12,24,0.9))]" />
          <div className="relative max-w-full sm:max-w-[74%]">
            <p className="text-[11px] uppercase tracking-[0.22em] text-accent">{t('regionHud.currentCounty')}</p>
            <p className="mt-3 font-display text-3xl leading-none text-white">{regionSummary.label}</p>
            <p className="mt-2 text-lg font-semibold uppercase tracking-[0.14em] text-slate-100">
              {regionNode.stageLabel}
            </p>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-200">{region?.tone ?? t('regionHud.defaultTone')}</p>

            <div className="mt-5 grid max-w-[420px] gap-2 text-xs text-slate-100">
              <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
                <span className="uppercase tracking-[0.18em] text-slate-400">{t('regionHud.nearestElection')}</span>
                <span className="font-medium text-white">{regionSummary.nearestElectionName}</span>
              </div>
              <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
                <span className="uppercase tracking-[0.18em] text-slate-400">{t('regionHud.voteDate')}</span>
                <span className="font-display text-base text-signal">{regionSummary.nearestElectionDate}</span>
              </div>
              <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
                <span className="uppercase tracking-[0.18em] text-slate-400">{t('regionHud.publicItems')}</span>
                <span className="text-white">{t('regionHud.upcomingRaceCount', { count: regionSummary.upcomingRaceCount })}</span>
              </div>
            </div>

            <div className="mt-4 flex max-w-[430px] flex-wrap gap-2">
              {electionItemLabels.map((label, index) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-sm border border-white/15 bg-bg/45 px-2.5 py-1.5 text-xs text-slate-100"
                >
                  <span
                    className="h-3 w-3 border border-slate-950"
                    style={{ backgroundColor: ['#f4d35e', '#7dd3fc', '#86efac'][index] }}
                    aria-hidden="true"
                  />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mt-6">
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
