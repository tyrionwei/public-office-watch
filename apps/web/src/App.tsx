import { useMemo, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { BgmToggle } from './components/BgmToggle';
import { DataPrinciplesPanel } from './components/DataPrinciplesPanel';
import { NextEventTicker } from './components/NextEventTicker';
import { SearchCommand } from './components/SearchCommand';
import { SelectedRegionHud } from './components/SelectedRegionHud';
import { TaiwanStageSelect } from './components/TaiwanStageSelect';
import { UpcomingElectionCards } from './components/UpcomingElectionCards';
import {
  dataPrinciples,
  nextEvent,
  regions,
  stageSelectRegions,
  upcomingRaces,
} from './data/mockHomeData';

function App() {
  const [selectedRegionId, setSelectedRegionId] = useState(regions[0]?.id ?? '');
  const [bgmEnabled, setBgmEnabled] = useState(false);

  const selectedRegion = useMemo(
    () => regions.find((region) => region.id === selectedRegionId) ?? regions[0],
    [selectedRegionId],
  );

  return (
    <div className="min-h-screen bg-bg text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="arcade-radial absolute left-[8%] top-[-8rem] h-72 w-72 rounded-full" />
        <div className="arcade-radial arcade-radial-pink absolute bottom-[-10rem] right-[6%] h-96 w-96 rounded-full" />
        <div className="scanline-overlay absolute inset-0 opacity-50" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <AppHeader />

        <div className="mt-6 flex flex-col gap-4 xl:flex-row xl:items-stretch">
          <div className="min-w-0 flex-1">
            <NextEventTicker {...nextEvent} />
          </div>
          <div className="xl:w-[220px]">
            <BgmToggle enabled={bgmEnabled} onToggle={() => setBgmEnabled((value) => !value)} />
          </div>
        </div>

        <main className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <section className="space-y-6">
            <TaiwanStageSelect
              regions={regions}
              selectedRegionId={selectedRegionId}
              onSelect={setSelectedRegionId}
              stageRegions={stageSelectRegions}
            />
          </section>

          <section className="space-y-6">
            <SelectedRegionHud region={selectedRegion} />
            <SearchCommand />
            <DataPrinciplesPanel principles={dataPrinciples} />
          </section>
        </main>

        <section className="mt-6">
          <UpcomingElectionCards races={upcomingRaces} />
        </section>
      </div>
    </div>
  );
}

export default App;
