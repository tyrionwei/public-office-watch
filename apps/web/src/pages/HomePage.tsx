import { useMemo, useState } from 'react';
import { AppShell, AppShellBgmToggle } from '../components/AppShell';
import { DataPrinciplesPanel } from '../components/DataPrinciplesPanel';
import { SearchCommand } from '../components/SearchCommand';
import { SelectedRegionHud } from '../components/SelectedRegionHud';
import { TaiwanStageSelect } from '../components/TaiwanStageSelect';
import { UpcomingElectionCards } from '../components/UpcomingElectionCards';
import {
  dataPrinciples,
  nextEvent,
  regions,
  stageRegionNodes,
  stageRegionSummaries,
  upcomingRaces,
} from '../data/mockHomeData';

export function HomePage() {
  const [selectedRegionId, setSelectedRegionId] = useState(stageRegionNodes[0]?.id ?? '');
  const [bgmEnabled, setBgmEnabled] = useState(false);

  const selectedRegionNode = useMemo(
    () => stageRegionNodes.find((region) => region.id === selectedRegionId) ?? stageRegionNodes[0],
    [selectedRegionId],
  );

  const selectedRegionSummary = useMemo(
    () => stageRegionSummaries.find((summary) => summary.regionId === selectedRegionId) ?? stageRegionSummaries[0],
    [selectedRegionId],
  );

  const selectedRegion = useMemo(() => {
    const baseRegionId = selectedRegionNode?.publicRegionId
      ? regions.find((region) => region.id === selectedRegionNode.publicRegionId?.replace('region-', ''))?.id ??
        selectedRegionNode.publicRegionId.replace('region-', '')
      : selectedRegionSummary?.regionId;

    return regions.find((region) => region.id === baseRegionId) ?? regions[0];
  }, [selectedRegionNode, selectedRegionSummary]);

  return (
    <AppShell
      ticker={nextEvent}
      headerRight={<AppShellBgmToggle enabled={bgmEnabled} onToggle={() => setBgmEnabled((value) => !value)} />}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="space-y-6">
          <TaiwanStageSelect
            regions={stageRegionNodes}
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
          <DataPrinciplesPanel principles={dataPrinciples} />
        </section>
      </div>

      <section className="mt-6">
        <UpcomingElectionCards
          races={upcomingRaces}
          selectedRegionId={selectedRegionId}
          selectedRegionLabel={selectedRegionSummary?.label ?? selectedRegionNode?.label ?? '未指定區域'}
          selectedPublicRegionId={selectedRegionNode?.publicRegionId ?? null}
        />
      </section>
    </AppShell>
  );
}
