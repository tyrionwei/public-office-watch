import { useCallback, useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { LocalOfficeSummaryPanel } from '../components/LocalOfficeSummaryPanel';
import { PollComparisonPanel } from '../components/PollComparisonPanel';
import { RegionIssueConcernPanel } from '../components/RegionIssueConcernPanel';
import { SelectedRegionHud } from '../components/SelectedRegionHud';
import { TaiwanStageSelect } from '../components/TaiwanStageSelect';
import { UpcomingElectionCards } from '../components/UpcomingElectionCards';
import { useI18n } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import type { StageRegionNode } from '../types/stageMap';

function getDefaultStageRegionId(regions: StageRegionNode[]) {
  const taipeiRegion = regions.find((region) => {
    const label = region.label.replace('台', '臺');
    return region.stageLabel === '63000' || label.includes('臺北市') || region.id.toLowerCase().includes('taipei');
  });

  return taipeiRegion?.id ?? regions.find((region) => region.level === 'county_city')?.id ?? regions[0]?.id ?? '';
}

function getSelectedStageRegionId(regions: StageRegionNode[], requestedRegionId: string | null) {
  if (requestedRegionId && regions.some((region) => region.id === requestedRegionId)) {
    return requestedRegionId;
  }

  return getDefaultStageRegionId(regions);
}

export function HomePage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const homeData = publicDataProvider.getHomePageData();
  const selectedRegionId = getSelectedStageRegionId(homeData.stageRegions, searchParams.get('region'));
  const [relatedRaces, setRelatedRaces] = useState(() => publicDataProvider
    .getRelatedRacesByRegionId(selectedRegionId)
    .filter((race) => race.status !== 'completed'));
  const [, startTransition] = useTransition();

  const pollComparison = publicDataProvider.getPollComparisonByElectionId(homeData.upcomingRaces[0]?.electionId ?? '');

  useEffect(() => {
    let active = true;
    setRelatedRaces(publicDataProvider
      .getRelatedRacesByRegionId(selectedRegionId)
      .filter((race) => race.status !== 'completed'));

    void publicDataProvider.loadRelatedRacesByRegionId(selectedRegionId)
      .then((races) => {
        if (active) {
          setRelatedRaces(races.filter((race) => race.status !== 'completed'));
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [selectedRegionId]);

  const selectedRegionNode = publicDataProvider.getStageRegion(selectedRegionId) ?? homeData.stageRegions[0];

  const selectedRegionSummary = publicDataProvider.getRegionSummary(selectedRegionId) ?? homeData.stageRegionSummaries[0];


  const handleSelectRegion = useCallback((regionId: string) => {
    if (regionId === selectedRegionId && searchParams.get('region') === regionId) {
      return;
    }

    startTransition(() => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('region', regionId);
      setSearchParams(nextParams);
    });
  }, [searchParams, selectedRegionId, setSearchParams, startTransition]);

  return (
    <AppShell ticker={homeData.ticker}>
      <div className="grid gap-3 xl:grid-cols-[minmax(460px,1.08fr)_minmax(360px,0.78fr)_minmax(340px,0.72fr)]">
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
            races={relatedRaces}
            regionNode={selectedRegionNode}
            regionSummary={selectedRegionSummary}
          />
          {pollComparison ? <PollComparisonPanel comparison={pollComparison} /> : null}
          <UpcomingElectionCards
            races={relatedRaces}
            selectedRegionId={selectedRegionId}
            selectedRegionLabel={selectedRegionSummary?.label ?? selectedRegionNode?.label ?? t('home.unspecifiedRegion')}
            selectedPublicRegionId={selectedRegionNode?.publicRegionId ?? null}
            compact
          />
          <RegionIssueConcernPanel
            regionId={selectedRegionNode?.publicRegionId ?? null}
            regionLabel={selectedRegionSummary?.label ?? selectedRegionNode?.label ?? t('home.unspecifiedRegion')}
          />
        </section>

        <section className="min-w-0">
          <LocalOfficeSummaryPanel regionId={selectedRegionId} />
        </section>
      </div>
    </AppShell>
  );
}
