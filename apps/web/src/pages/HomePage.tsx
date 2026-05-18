import { useMemo, useState } from 'react';
import { AppShell, AppShellBgmToggle } from '../components/AppShell';
import { DataPrinciplesPanel } from '../components/DataPrinciplesPanel';
import { PixelFrame } from '../components/PixelFrame';
import { PollComparisonPanel } from '../components/PollComparisonPanel';
import { SearchCommand } from '../components/SearchCommand';
import { SelectedRegionHud } from '../components/SelectedRegionHud';
import { TaiwanStageSelect } from '../components/TaiwanStageSelect';
import { UpcomingElectionCards } from '../components/UpcomingElectionCards';
import { publicDataProvider } from '../lib/publicData';
import { mockPollComparisons } from '../data/mockPolling';

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
      <div className="grid gap-3 xl:grid-cols-[minmax(420px,0.98fr)_minmax(390px,0.92fr)_minmax(300px,0.62fr)]">
        <section className="min-w-0">
          <div className="min-w-0 xl:h-full">
            <TaiwanStageSelect
              regions={homeData.stageRegions}
              selectedRegionId={selectedRegionId}
              onSelectRegion={setSelectedRegionId}
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
          {mockPollComparisons[0] ? <PollComparisonPanel comparison={mockPollComparisons[0]} /> : null}
          <PixelFrame
            title="Public Data Progress"
            className="bg-[linear-gradient(180deg,rgba(12,18,36,0.96),rgba(8,15,30,0.92))]"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['地圖資料', '22 縣市', '官方界線轉換'],
                ['公開區域', 'metadata', '區域索引'],
                ['人物關聯', '未啟用', '需人工審核'],
              ].map(([label, value, note]) => (
                <div key={label} className="pixel-corners border border-line/70 bg-bg/45 p-3">
                  <p className="font-display text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
                  <p className="mt-2 text-xl font-semibold text-white">{value}</p>
                  <p className="mt-1 text-xs text-slate-400">{note}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 pixel-corners border border-signal/35 bg-signal/10 px-3 py-2 text-xs text-slate-200">
              目前畫面聚焦區域導覽、選舉節點與候選人比較的展示流程。
            </div>
          </PixelFrame>
        </section>

        <section className="space-y-3">
          <SearchCommand selectedRegionLabel={selectedRegionSummary?.label ?? selectedRegionNode?.label ?? '未指定區域'} />
          <div className="xl:max-h-[360px] xl:overflow-auto">
            <UpcomingElectionCards
              races={homeData.upcomingRaces}
              selectedRegionId={selectedRegionId}
              selectedRegionLabel={selectedRegionSummary?.label ?? selectedRegionNode?.label ?? '未指定區域'}
              selectedPublicRegionId={selectedRegionNode?.publicRegionId ?? null}
              compact
            />
          </div>
          <DataPrinciplesPanel principles={homeData.dataPrinciples} />
        </section>
      </div>
    </AppShell>
  );
}
