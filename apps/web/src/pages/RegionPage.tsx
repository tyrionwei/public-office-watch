import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { MockDataBadge } from '../components/MockDataBadge';
import { PageNotice } from '../components/PageNotice';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { publicDataProvider } from '../lib/publicData';
import { electionPath, homePath, regionPath } from '../routes/routePaths';

export function RegionPage() {
  const { regionId } = useParams();
  const safeRegionId = regionId ?? '';
  const regionNode = publicDataProvider.getStageRegion(safeRegionId);
  const regionSummary = publicDataProvider.getRegionSummary(safeRegionId);
  const regionCard = publicDataProvider.getRegionCardByStageRegionId(safeRegionId);
  const childRegions = regionNode ? publicDataProvider.getChildStageRegions(regionNode.id) : [];
  const relatedRaces = publicDataProvider.getRelatedRacesByRegionId(safeRegionId);

  return (
    <AppShell>
      <PixelFrame
        title="Region Data"
        action={
          <Link to={homePath()} className="text-[11px] uppercase tracking-[0.22em] text-accent">
            返回首頁
          </Link>
        }
      >
        {regionNode && regionSummary ? (
          <div className="space-y-6">
            <section className="pixel-corners border border-line/70 bg-[linear-gradient(180deg,rgba(11,19,38,0.94),rgba(15,24,46,0.88))] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <MockDataBadge />
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">region hero / hud</p>
                    <h2 className="mt-2 font-display text-3xl text-white sm:text-4xl">{regionSummary.label}</h2>
                    <p className="mt-2 text-sm text-slate-400">
                      {regionCard?.tone ?? '尚未接入正式資料，僅展示 placeholder 區域資料。'}
                    </p>
                  </div>
                </div>

                <div className="pixel-corners border border-line/70 bg-bg/35 px-4 py-3 text-sm text-slate-300 lg:w-[280px]">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">boundary note</p>
                  <p className="mt-2">此為 UI 測試用區域，不代表正式行政區或選舉選區。</p>
                </div>
              </div>

              <dl className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <HudStatCard label="level" value={regionNode.level} />
                <HudStatCard label="nearest election" value={regionSummary.nearestElectionName} />
                <HudStatCard label="nearest election date" value={<span className="font-display text-xl text-signal">{regionSummary.nearestElectionDate}</span>} />
                <HudStatCard label="upcoming race count" value={`${regionSummary.upcomingRaceCount} 項公開選舉項目`} />
              </dl>
            </section>

            <SectionPanel title="Region Election Summary" eyebrow="related mock election cards">
              {relatedRaces.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {relatedRaces.map((race) => (
                    <article key={race.id} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">選舉資訊</p>
                      <h4 className="mt-2 font-display text-lg text-white">{race.title}</h4>
                      <p className="mt-1 text-sm text-slate-400">{race.region} · {race.date}</p>
                      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-300">
                        <span>{race.partyLabel}</span>
                        <Link
                          to={electionPath(race.electionId)}
                          className="rounded-sm border border-accent/60 bg-accent/10 px-3 py-2 font-display text-xs uppercase tracking-[0.22em] text-accent"
                        >
                          查看選舉資訊
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">目前沒有相關 mock election cards。</p>
              )}
            </SectionPanel>

            <PageNotice
              title="Region Data Boundary Notice"
              bullets={[
                '目前使用 mock public-view-shaped data。',
                '尚未接入正式 Supabase public views。',
                '不顯示未審核資料。',
                '不代表正式行政區或選舉選區。',
              ]}
            />

            <SectionPanel title="Child Region Placeholder" eyebrow="next layer placeholder regions">
              {childRegions.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {childRegions.map((child) => (
                    <Link
                      key={child.id}
                      to={regionPath(child.id)}
                      className="pixel-corners border border-line/70 bg-bg/35 p-4 transition hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/35"
                    >
                      <p className="font-display text-sm uppercase tracking-[0.18em] text-white">{child.label}</p>
                      <p className="mt-2 text-xs text-slate-400">{child.note}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">尚無下一層 placeholder 區域。</p>
              )}
            </SectionPanel>
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
