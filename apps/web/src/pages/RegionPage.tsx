import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { UpcomingElectionCards } from '../components/UpcomingElectionCards';
import { regions, upcomingRaces } from '../data/mockHomeData';
import { mockStageRegionNodes, mockStageRegionSummaries } from '../data/mockStageMap';
import { homePath } from '../routes/routePaths';

export function RegionPage() {
  const { regionId } = useParams();
  const regionNode = mockStageRegionNodes.find((region) => region.id === regionId);
  const regionSummary = mockStageRegionSummaries.find((summary) => summary.regionId === regionId);
  const baseRegionId = regionNode?.publicRegionId?.replace('region-', '') ?? regionSummary?.regionId;
  const regionCard = regions.find((region) => region.id === baseRegionId);

  return (
    <AppShell>
      <PixelFrame title="Region Data" action={<Link to={homePath()} className="text-[11px] uppercase tracking-[0.22em] text-accent">返回首頁</Link>}>
        {regionNode && regionSummary ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">UI 測試資料</p>
              <h2 className="font-display text-3xl text-white">{regionSummary.label}</h2>
              <p className="text-sm text-slate-400">{regionCard?.tone ?? '尚未接入正式資料，僅展示 placeholder 區域資料。'} </p>
            </div>

            <dl className="grid gap-4 md:grid-cols-2">
              <div className="pixel-corners border border-line/70 bg-bg/38 p-4">
                <dt className="text-xs uppercase tracking-[0.22em] text-slate-500">nearest election</dt>
                <dd className="mt-2 text-white">{regionSummary.nearestElectionName}</dd>
              </div>
              <div className="pixel-corners border border-line/70 bg-bg/38 p-4">
                <dt className="text-xs uppercase tracking-[0.22em] text-slate-500">nearest election date</dt>
                <dd className="mt-2 font-display text-xl text-signal">{regionSummary.nearestElectionDate}</dd>
              </div>
              <div className="pixel-corners border border-line/70 bg-bg/38 p-4">
                <dt className="text-xs uppercase tracking-[0.22em] text-slate-500">upcoming race count</dt>
                <dd className="mt-2 text-white">{regionSummary.upcomingRaceCount} 項 mock 選舉資訊</dd>
              </div>
              <div className="pixel-corners border border-line/70 bg-bg/38 p-4">
                <dt className="text-xs uppercase tracking-[0.22em] text-slate-500">source note</dt>
                <dd className="mt-2 text-slate-300">{regionSummary.sourceNote}</dd>
              </div>
              <div className="pixel-corners border border-line/70 bg-bg/38 p-4 md:col-span-2">
                <dt className="text-xs uppercase tracking-[0.22em] text-slate-500">boundary note</dt>
                <dd className="mt-2 text-slate-300">{regionSummary.boundaryNote}</dd>
              </div>
            </dl>

            <UpcomingElectionCards
              races={upcomingRaces}
              selectedRegionId={regionSummary.regionId}
              selectedRegionLabel={regionSummary.label}
              selectedPublicRegionId={regionNode.publicRegionId}
            />
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-300">
            <h2 className="font-display text-2xl text-white">找不到區域資料</h2>
            <p>此頁目前只提供 UI 測試資料，尚未接入正式資料。</p>
            <p>你可以返回首頁，從 Stage Select 重新選擇區域。</p>
          </div>
        )}
      </PixelFrame>
    </AppShell>
  );
}
