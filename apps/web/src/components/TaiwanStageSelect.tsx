import { lazy, Suspense, useEffect, useRef } from 'react';
import { useI18n } from '../i18n';
import { getCurrentCountyRegions } from '../lib/countyRegions';
import { normalizeTaiwanText } from '../lib/taiwanText';
import type { StageRegionNode } from '../types/stageMap';

type TaiwanStageSelectProps = {
  regions: StageRegionNode[];
  selectedRegionId: string | null;
  onSelectRegion: (regionId: string | null) => void;
};

type CompactCountyQuickSelectProps = TaiwanStageSelectProps;

const primaryRegionLabels = new Set([
  '臺北市',
  '新北市',
  '桃園市',
  '臺中市',
  '臺南市',
  '高雄市',
]);

function isPrimaryRegion(region: StageRegionNode) {
  return primaryRegionLabels.has(normalizeTaiwanText(region.label));
}

const LazyTaiwanCountyMap = lazy(() => import('./TaiwanCountyMap').then((module) => ({ default: module.TaiwanCountyMap })));

function RegionButton({
  label,
  selected,
  onClick,
  solidSelected = false,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  solidSelected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        'pixel-corners min-w-fit border px-2.5 py-2 text-left font-display text-[11px] tracking-[0.08em] transition focus:outline-none focus:ring-2 focus:ring-accent/35 sm:w-full sm:min-w-0',
        selected
          ? solidSelected
            ? 'border-signal bg-signal text-[#041126] shadow-[0_0_16px_rgba(250,204,21,0.2)]'
            : 'border-signal bg-signal/15 text-signal shadow-[0_0_16px_rgba(250,204,21,0.14)]'
          : 'border-line/80 bg-bg/80 text-slate-200 hover:border-accent/60 hover:text-white',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

export function CompactCountyQuickSelect({
  regions,
  selectedRegionId,
  onSelectRegion,
}: CompactCountyQuickSelectProps) {
  const { t } = useI18n();
  const topLevelRegions = getCurrentCountyRegions(regions);
  const primaryRegions = topLevelRegions.filter(isPrimaryRegion);
  const additionalRegions = topLevelRegions.filter((region) => !isPrimaryRegion(region));
  const selectedAdditionalRegion = additionalRegions.find((region) => region.id === selectedRegionId);
  const moreCountiesRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      const details = moreCountiesRef.current;
      if (details?.open && event.target instanceof Node && !details.contains(event.target)) {
        details.open = false;
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, []);

  function selectAdditionalRegion(regionId: string) {
    onSelectRegion(regionId);
    if (moreCountiesRef.current) moreCountiesRef.current.open = false;
  }

  return (
    <nav aria-label={t('stage.quickSelect')} className="relative min-w-0">
      <p className="mb-2 hidden font-display text-[10px] uppercase tracking-[0.18em] text-accent sm:block">
        {t('stage.quickSelect')}
      </p>
      <div className="flex gap-1.5 overflow-x-auto pb-1 sm:grid sm:overflow-visible sm:pb-0">
        <RegionButton
          label={t('stage.nationalOverview')}
          selected={selectedRegionId === null}
          onClick={() => onSelectRegion(null)}
        />
        {primaryRegions.map((region) => (
          <RegionButton
            key={region.id}
            label={normalizeTaiwanText(region.label)}
            selected={selectedRegionId === region.id}
            onClick={() => onSelectRegion(region.id)}
          />
        ))}
        {selectedAdditionalRegion ? (
          <RegionButton
            label={normalizeTaiwanText(selectedAdditionalRegion.label)}
            selected
            onClick={() => onSelectRegion(selectedAdditionalRegion.id)}
          />
        ) : null}
        <details ref={moreCountiesRef} className="group relative min-w-fit sm:w-full">
          <summary className="pixel-corners flex cursor-pointer list-none items-center justify-between gap-2 border border-line/80 bg-bg/80 px-2.5 py-2 font-display text-[11px] tracking-[0.08em] text-slate-200 transition hover:border-accent/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/35">
            <span>{t('stage.moreCounties')}</span>
            <span aria-hidden="true" className="transition group-open:rotate-90">›</span>
          </summary>
          <div className="pixel-corners absolute left-0 top-full z-50 mt-2 grid max-h-[min(520px,calc(100vh-10rem))] w-[min(300px,calc(100vw-2rem))] grid-cols-2 gap-1.5 overflow-y-auto border border-line/90 bg-panel/98 p-2 shadow-[0_18px_45px_rgba(0,0,0,0.35)] sm:left-full sm:top-1/2 sm:ml-2 sm:mt-0 sm:-translate-y-1/2">
            {additionalRegions.map((region) => (
              <RegionButton
                key={region.id}
                label={normalizeTaiwanText(region.label)}
                selected={selectedRegionId === region.id}
                onClick={() => selectAdditionalRegion(region.id)}
                solidSelected
              />
            ))}
          </div>
        </details>
      </div>
    </nav>
  );
}

export function TaiwanStageSelect({
  regions,
  selectedRegionId,
  onSelectRegion,
}: TaiwanStageSelectProps) {
  const { t } = useI18n();
  const topLevelRegions = getCurrentCountyRegions(regions);

  return (
    <div className="pixel-corners min-w-0 border border-line/70 p-3 [background:var(--theme-panel-gradient)] sm:p-4 xl:flex xl:h-full xl:flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-display text-sm uppercase tracking-[0.22em] text-slate-200">{t('stage.countyGuide')}</p>
        <span className="rounded-sm border border-signal/30 bg-signal/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-signal">
          {t('map.summary')}
        </span>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-[88px_minmax(0,1fr)] xl:flex-1">
        <CompactCountyQuickSelect
          regions={regions}
          selectedRegionId={selectedRegionId}
          onSelectRegion={onSelectRegion}
        />
        <Suspense fallback={<div className="pixel-corners mx-auto aspect-[9/11] w-full border border-line/70 bg-panelAlt/35 xl:h-full xl:min-h-[620px] xl:aspect-auto" />}>
          <LazyTaiwanCountyMap
            regions={topLevelRegions}
            selectedRegionId={selectedRegionId ?? ''}
            onSelectRegion={onSelectRegion}
          />
        </Suspense>
      </div>
    </div>
  );
}
