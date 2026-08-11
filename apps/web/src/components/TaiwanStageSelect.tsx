import { lazy, Suspense } from 'react';
import { useI18n } from '../i18n';
import type { StageRegionNode } from '../types/stageMap';

type TaiwanStageSelectProps = {
  regions: StageRegionNode[];
  selectedRegionId: string | null;
  onSelectRegion: (regionId: string | null) => void;
  hideQuickSelect?: boolean;
};

type CompactCountyQuickSelectProps = {
  regions: StageRegionNode[];
  selectedRegionId: string | null;
  onSelectRegion: (regionId: string | null) => void;
};

const LazyTaiwanCountyMap = lazy(() => import('./TaiwanCountyMap').then((module) => ({ default: module.TaiwanCountyMap })));

export function CompactCountyQuickSelect({
  regions,
  selectedRegionId,
  onSelectRegion,
}: CompactCountyQuickSelectProps) {
  const { t } = useI18n();
  const topLevelRegions = regions.filter((region) => region.level === 'county_city');

  return (
    <div className="pixel-corners border border-line/70 bg-panelAlt/35 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-display text-[11px] uppercase tracking-[0.22em] text-accent">{t('stage.quickSelect')}</p>
        <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{t('stage.backupList')}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {topLevelRegions.map((region) => {
          const selected = selectedRegionId === region.id;
          return (
            <button
              key={region.id}
              type="button"
              onClick={() => onSelectRegion(region.id)}
              aria-current={selected ? 'true' : undefined}
              className={[
                'pixel-corners inline-flex items-center gap-2 border px-3 py-1.5 text-left transition focus:outline-none focus:ring-2 focus:ring-accent/35',
                selected
                  ? 'border-accent bg-accent/14 text-white shadow-[0_0_18px_rgba(103,232,249,0.14)]'
                  : 'border-line bg-panelAlt/70 text-slate-200 hover:border-accent/55',
              ].join(' ')}
            >
              <span className="font-display text-[11px] uppercase tracking-[0.14em]">{region.label}</span>
              <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{region.stageLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TaiwanStageSelect({
  regions,
  selectedRegionId,
  onSelectRegion,
  hideQuickSelect = false,
}: TaiwanStageSelectProps) {
  const { t } = useI18n();
  const topLevelRegions = regions.filter((region) => region.level === 'county_city');
  return (
    <div className="h-full min-w-0 space-y-4">
        <div className="pixel-corners min-w-0 border border-line/70 bg-[linear-gradient(180deg,rgba(7,22,45,0.96),rgba(8,27,52,0.94)_55%,rgba(7,18,38,0.96))] p-3 sm:p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-sm uppercase tracking-[0.24em] text-slate-200">{t('stage.countyGuide')}</p>
            </div>
            <span className="rounded-sm border border-signal/30 bg-signal/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-signal">
              {t('stage.countyLevel')}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onSelectRegion(null)}
            aria-pressed={selectedRegionId === null}
            className={[
              'pixel-corners mb-4 flex w-full items-center justify-between border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-accent/35',
              selectedRegionId === null
                ? 'border-signal bg-signal/12 text-white shadow-[0_0_20px_rgba(250,204,21,0.1)]'
                : 'border-line/70 bg-panelAlt/45 text-slate-300 hover:border-signal/60 hover:text-white',
            ].join(' ')}
          >
            <span>
              <span className="block font-display text-sm uppercase tracking-[0.2em]">{t('stage.nationalOverview')}</span>
              <span className="mt-1 block text-xs text-slate-400">{t('stage.nationalOverviewHint')}</span>
            </span>
            <span className="font-display text-2xl text-signal">TW</span>
          </button>

          <Suspense fallback={<div className="pixel-corners mx-auto aspect-[9/10] w-full max-w-[720px] border border-line/70 bg-panelAlt/35" />}>
            <LazyTaiwanCountyMap
              regions={topLevelRegions}
              selectedRegionId={selectedRegionId ?? ''}
              onSelectRegion={onSelectRegion}
            />
          </Suspense>

          {!hideQuickSelect ? (
            <div className="mt-5">
              <CompactCountyQuickSelect
                regions={regions}
                selectedRegionId={selectedRegionId}
                onSelectRegion={onSelectRegion}
              />
            </div>
          ) : null}
        </div>
    </div>
  );
}
