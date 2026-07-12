import { useCallback, useEffect, useState, useTransition } from 'react';
import { AppShell } from '../components/AppShell';
import { LocalOfficeSummaryPanel } from '../components/LocalOfficeSummaryPanel';
import { PollComparisonPanel } from '../components/PollComparisonPanel';
import { SelectedRegionHud } from '../components/SelectedRegionHud';
import { TaiwanStageSelect } from '../components/TaiwanStageSelect';
import { UpcomingElectionCards } from '../components/UpcomingElectionCards';
import { publicDataProvider } from '../lib/publicData';
import type { StageRegionNode } from '../types/stageMap';

function getDefaultStageRegionId(regions: StageRegionNode[]) {
  const taipeiRegion = regions.find((region) => {
    const label = region.label.replace('台', '臺');
    return region.stageLabel === '63000' || label.includes('臺北市') || region.id.toLowerCase().includes('taipei');
  });

  return taipeiRegion?.id ?? regions.find((region) => region.level === 'county_city')?.id ?? regions[0]?.id ?? '';
}

export function HomePage() {
  const [selectedRegionId, setSelectedRegionId] = useState(() => getDefaultStageRegionId(publicDataProvider.getStageRegions()));
  const [, startTransition] = useTransition();

  const homeData = publicDataProvider.getHomePageData();
  const pollComparison = publicDataProvider.getPollComparisonByElectionId(homeData.upcomingRaces[0]?.electionId ?? '');
  const relatedRaces = publicDataProvider
    .getRelatedRacesByRegionId(selectedRegionId)
    .filter((race) => race.status !== 'completed');

  useEffect(() => {
    if (selectedRegionId) {
      return;
    }

    setSelectedRegionId(getDefaultStageRegionId(homeData.stageRegions));
  }, [homeData.stageRegions, selectedRegionId]);

  const selectedRegionNode = publicDataProvider.getStageRegion(selectedRegionId) ?? homeData.stageRegions[0];

  const selectedRegionSummary = publicDataProvider.getRegionSummary(selectedRegionId) ?? homeData.stageRegionSummaries[0];

  const selectedRegion = publicDataProvider.getRegionCardByStageRegionId(selectedRegionId) ?? homeData.regions[0];

  const handleSelectRegion = useCallback((regionId: string) => {
    startTransition(() => {
      setSelectedRegionId(regionId);
    });
  }, [startTransition]);

  return (
    <AppShell ticker={homeData.ticker}>
      <div className="grid gap-3 xl:grid-cols-[minmax(460px,1.08fr)_minmax(390px,0.88fr)_minmax(300px,0.62fr)]">
        <section className="min-w-0 space-y-3">
          <div className="min-w-0">
            <TaiwanStageSelect
              regions={homeData.stageRegions}
              selectedRegionId={selectedRegionId}
              onSelectRegion={handleSelectRegion}
              hideQuickSelect
            />
          </div>
        </section>

        <section className="min-w-0 space-y-3">
          <SelectedRegionHud
            region={selectedRegion}
            regionNode={selectedRegionNode}
            regionSummary={selectedRegionSummary}
          />
          {pollComparison ? <PollComparisonPanel comparison={pollComparison} /> : null}
          <UpcomingElectionCards
            races={relatedRaces}
            selectedRegionId={selectedRegionId}
            selectedRegionLabel={selectedRegionSummary?.label ?? selectedRegionNode?.label ?? '未指定區域'}
            selectedPublicRegionId={selectedRegionNode?.publicRegionId ?? null}
            compact
          />
        </section>

        <section className="min-w-0">
          <LocalOfficeSummaryPanel regionId={selectedRegionId} />
        </section>
      </div>
    </AppShell>
  );
}
