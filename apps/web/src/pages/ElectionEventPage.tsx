import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { buildElectionEvents, filterEventRaces, getElectionEventByKey, getRaceRegionGroup } from '../data/electionEvents';
import { getElectionStatusLabel, getRaceCategory, getRaceStatusLabel, getRaceTypeLabel } from '../data/electionLabels';
import { publicDataProvider } from '../lib/publicData';
import { electionEventPath, electionsPath, racePath } from '../routes/routePaths';

function uniqueCount(values: Array<string | null>) {
  return new Set(values.filter(Boolean)).size;
}

function buildFilterPath(eventKey: string, searchParams: URLSearchParams, key: 'category' | 'region', value: string) {
  const nextParams = new URLSearchParams(searchParams);

  if (value) {
    nextParams.set(key, value);
  } else {
    nextParams.delete(key);
  }

  const query = nextParams.toString();
  return query ? `${electionEventPath(eventKey)}?${query}` : electionEventPath(eventKey);
}

export function ElectionEventPage() {
  const { eventKey } = useParams();
  const [searchParams] = useSearchParams();
  const events = buildElectionEvents(publicDataProvider.getElections(), publicDataProvider.getRaces());
  const event = getElectionEventByKey(events, eventKey ?? '');
  const selectedCategory = searchParams.get('category') ?? '';
  const selectedRegion = searchParams.get('region') ?? '';

  if (!event) {
    return (
      <AppShell>
        <PixelFrame title="找不到大選事件" action={<Link to={electionsPath()} className="text-[11px] uppercase tracking-[0.22em] text-accent">返回選舉年份</Link>}>
          <p className="text-sm text-slate-300">此大選事件尚未載入，或目前沒有可公開的選舉資料。</p>
        </PixelFrame>
      </AppShell>
    );
  }

  const filteredRaces = filterEventRaces(event, selectedCategory, selectedRegion);
  const selectedCategoryLabel = selectedCategory
    ? event.categoryGroups.find((group) => group.category.key === selectedCategory)?.category.label ?? selectedCategory
    : '全部項目';
  const selectedRegionLabel = selectedRegion
    ? event.regionGroups.find((group) => group.key === selectedRegion)?.label ?? selectedRegion
    : '全部區域';
  const regionCount = uniqueCount(event.races.map((race) => getRaceRegionGroup(race).label));

  return (
    <AppShell>
      <div className="space-y-4">
        <PixelFrame
          title="大選總覽"
          action={<Link to={electionsPath()} className="text-[11px] uppercase tracking-[0.22em] text-accent">返回選舉年份</Link>}
        >
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.34fr)]">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.22em] text-accent">{event.votingDate ?? '投票日待公告'}</p>
              <h1 className="mt-2 font-display text-4xl text-white">{event.title}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                這個事件合併 {event.elections.length} 筆原始選舉資料：{event.sourceNameSummary}。先從左側選擇項目，再從右側選擇縣市或區域，中間會列出符合條件的選區項目。
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">{getElectionStatusLabel(event.status)}</span>
                <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">{event.categorySummary}</span>
                <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">{event.regionSummary}</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <HudStatCard label="原始選舉" value={<span className="font-display text-xl text-white">{event.elections.length}</span>} />
              <HudStatCard label="選區項目" value={<span className="font-display text-xl text-white">{event.races.length}</span>} />
              <HudStatCard label="區域" value={<span className="font-display text-xl text-white">{regionCount}</span>} />
            </div>
          </section>
        </PixelFrame>

        <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_240px]">
          <aside className="space-y-3">
            <PixelFrame title="項目分類">
              <div className="space-y-2">
                <Link
                  to={buildFilterPath(event.key, searchParams, 'category', '')}
                  className={selectedCategory === '' ? 'block pixel-corners border border-accent bg-accent/20 px-3 py-2 text-sm text-white' : 'block pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-sm text-slate-300 hover:border-accent/55 hover:text-white'}
                >
                  全部項目 <span className="float-right text-slate-500">{event.races.length}</span>
                </Link>
                {event.categoryGroups.map((group) => (
                  <Link
                    key={group.category.key}
                    to={buildFilterPath(event.key, searchParams, 'category', group.category.key)}
                    className={selectedCategory === group.category.key ? 'block pixel-corners border border-accent bg-accent/20 px-3 py-2 text-sm text-white' : 'block pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-sm text-slate-300 hover:border-accent/55 hover:text-white'}
                  >
                    {group.category.label} <span className="float-right text-slate-500">{group.races.length}</span>
                  </Link>
                ))}
              </div>
            </PixelFrame>
          </aside>

          <SectionPanel title="選區項目" eyebrow={`${selectedCategoryLabel} / ${selectedRegionLabel}`}>
            {filteredRaces.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">目前顯示 {filteredRaces.length} 個項目。點進單一項目後可查看候選人與當選資料。</p>
                <div className="overflow-hidden pixel-corners border border-line/70">
                  <div className="grid gap-3 border-b border-line/70 bg-panelAlt/55 px-4 py-2 text-xs uppercase tracking-[0.16em] text-slate-500 lg:grid-cols-[minmax(180px,1fr)_130px_130px_110px]">
                    <span>項目</span>
                    <span>分類</span>
                    <span>區域</span>
                    <span>狀態</span>
                  </div>
                  <div className="divide-y divide-line/60">
                    {filteredRaces.map((race) => {
                      const category = getRaceCategory(race);
                      const region = getRaceRegionGroup(race);

                      return (
                        <Link
                          key={race.race_id}
                          to={racePath(race.race_id)}
                          className="grid gap-3 px-4 py-3 text-sm transition hover:bg-accent/8 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/35 lg:grid-cols-[minmax(180px,1fr)_130px_130px_110px]"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-display text-lg text-white">{race.title}</p>
                            <p className="mt-1 truncate text-xs text-slate-500">{getRaceTypeLabel(race.race_type)}</p>
                          </div>
                          <p className="text-slate-300">{category.label}</p>
                          <p className="text-slate-300">{region.label}</p>
                          <p className="text-slate-300">{getRaceStatusLabel(race.status)}</p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">目前沒有符合此項目與區域的選區資料。</p>
            )}
          </SectionPanel>

          <aside className="space-y-3">
            <PixelFrame title="縣市 / 區域">
              <div className="space-y-2">
                <Link
                  to={buildFilterPath(event.key, searchParams, 'region', '')}
                  className={selectedRegion === '' ? 'block pixel-corners border border-accent bg-accent/20 px-3 py-2 text-sm text-white' : 'block pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-sm text-slate-300 hover:border-accent/55 hover:text-white'}
                >
                  全部區域 <span className="float-right text-slate-500">{event.races.length}</span>
                </Link>
                {event.regionGroups.map((group) => (
                  <Link
                    key={group.key}
                    to={buildFilterPath(event.key, searchParams, 'region', group.key)}
                    className={selectedRegion === group.key ? 'block pixel-corners border border-accent bg-accent/20 px-3 py-2 text-sm text-white' : 'block pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-sm text-slate-300 hover:border-accent/55 hover:text-white'}
                  >
                    {group.label} <span className="float-right text-slate-500">{group.races.length}</span>
                  </Link>
                ))}
              </div>
            </PixelFrame>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
