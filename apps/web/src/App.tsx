import { useMemo, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { BgmToggle } from './components/BgmToggle';
import { DataPrinciplesPanel } from './components/DataPrinciplesPanel';
import { NextEventTicker } from './components/NextEventTicker';
import { SearchCommand } from './components/SearchCommand';
import { SelectedRegionHud } from './components/SelectedRegionHud';
import { TaiwanStageSelect } from './components/TaiwanStageSelect';
import { UpcomingElectionCards } from './components/UpcomingElectionCards';
import { dataPrinciples, nextEvent, regions, upcomingRaces } from './data/mockHomeData';

function App() {
  const [selectedRegionId, setSelectedRegionId] = useState(regions[0]?.id ?? '');
  const [bgmEnabled, setBgmEnabled] = useState(false);

  const selectedRegion = useMemo(
    () => regions.find((region) => region.id === selectedRegionId) ?? regions[0],
    [selectedRegionId],
  );

  return (
    <div className="min-h-screen bg-bg text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <AppHeader />

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <NextEventTicker {...nextEvent} />
          </div>
          <BgmToggle enabled={bgmEnabled} onToggle={() => setBgmEnabled((value) => !value)} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-6">
            <SearchCommand />
            <TaiwanStageSelect
              regions={regions}
              selectedRegionId={selectedRegionId}
              onSelect={setSelectedRegionId}
            />
            <UpcomingElectionCards races={upcomingRaces} />
          </div>

          <div className="space-y-6">
            {selectedRegion ? <SelectedRegionHud region={selectedRegion} /> : null}
            <DataPrinciplesPanel principles={dataPrinciples} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
