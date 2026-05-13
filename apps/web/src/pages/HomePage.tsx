import { useMemo, useState } from 'react';
import { AppShell, AppShellBgmToggle } from '../components/AppShell';
import { DataPrinciplesPanel } from '../components/DataPrinciplesPanel';
import { SearchCommand } from '../components/SearchCommand';
import { SelectedRegionHud } from '../components/SelectedRegionHud';
import { TaiwanStageSelect } from '../components/TaiwanStageSelect';
import { UpcomingElectionCards } from '../components/UpcomingElectionCards';
import { publicDataProvider } from '../lib/publicData';

export function HomePage() {
  const [selectedRegionId, setSelectedRegionId] = useState(publicDataProvider.getStageRegions()[0]?.id ?? '');
  const [bgmEnabled, setBgmEnabled] = useState(false);

  const homeData = publicDataProvider.getHomePageData();

  const selectedRegionNode = useMemo(
    () => publicDataProvider.getStageRegion(selectedRegionId) ?? homeData.stageRegions[0],
    [homeData.stageRegions, selectedRegionId],
  );

  const selectedRegionSummary = useMemo(
    () => publicDataProvider.getRegionSummary(selectedRegionId) ?? homeData.stageRegionSummaries[0],
    [homeData.stageRegionSummaries, selectedRegionId],
  );

  const selectedRegion = useMemo(
    () => publicDataProvider.getRegionCardByStageRegionId(selectedRegionId) ?? homeData.regions[0],
    [homeData.regions, selectedRegionId],
  );

  return (
    <AppShell
      ticker={homeData.ticker}
      headerRight={<AppShellBgmToggle enabled={bgmEnabled} onToggle={() => setBgmEnabled((value) => !value)} />}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="space-y-6">
          <TaiwanStageSelect
            regions={homeData.stageRegions}
            selectedRegionId={selectedRegionId}
            onSelectRegion={setSelectedRegionId}
          />
        </section>

        <section className="space-y-6">
          <SelectedRegionHud
            region={selectedRegion}
            regionNode={selectedRegionNode}
            regionSummary={selectedRegionSummary}
          />
          <SearchCommand selectedRegionLabel={selectedRegionSummary?.label ?? selectedRegionNode?.label ?? '未指定區域'} />
          <DataPrinciplesPanel principles={homeData.dataPrinciples} />
        </section>
      </div>

      <section className="mt-6">
        <UpcomingElectionCards
          races={homeData.upcomingRaces}
          selectedRegionId={selectedRegionId}
          selectedRegionLabel={selectedRegionSummary?.label ?? selectedRegionNode?.label ?? '未指定區域'}
          selectedPublicRegionId={selectedRegionNode?.publicRegionId ?? null}
        />
      </section>
    </AppShell>
  );
}
