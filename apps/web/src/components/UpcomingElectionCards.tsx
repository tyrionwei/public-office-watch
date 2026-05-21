import { Link } from 'react-router-dom';
import { electionPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import { PixelFrame } from './PixelFrame';

type UpcomingElectionCardRace = {
  id: string;
  title: string;
  region: string;
  regionId: string;
  date: string;
  status: string;
  raceType: string;
  partyTag: keyof typeof partyTheme;
  partyLabel: string;
  electionId?: string;
};

type UpcomingElectionCardsProps = {
  races: UpcomingElectionCardRace[];
  selectedRegionId: string;
  selectedRegionLabel: string;
  selectedPublicRegionId: string | null;
  compact?: boolean;
};

const statusLabels: Record<string, string> = {
  upcoming: '即將進行',
  announced: '已公告',
  active: '進行中',
  completed: '已完成',
};

type RaceGroupKind = 'village' | 'councilor' | 'legislator';
type RaceCategory = 'presidential' | 'chief' | 'representative' | 'basic';

const raceCategoryStyles: Record<RaceCategory, { color: string; label: string }> = {
  presidential: { color: '#f472b6', label: '總統選舉' },
  chief: { color: '#f4d35e', label: '首長選舉' },
  representative: { color: '#7dd3fc', label: '民意代表選舉' },
  basic: { color: '#86efac', label: '基層公職' },
};

const raceGroupLabels: Record<RaceGroupKind, { title: string; countLabel: string; action: string }> = {
  village: {
    title: '村里長選舉',
    countLabel: '個村里層級選舉項目',
    action: '點開選擇行政區',
  },
  councilor: {
    title: '議員選舉',
    countLabel: '個議員選區項目',
    action: '點開選擇選區',
  },
  legislator: {
    title: '區域立法委員選舉',
    countLabel: '個立委選區項目',
    action: '點開選擇選區',
  },
};

function getRaceGroupKind(race: UpcomingElectionCardRace): RaceGroupKind | null {
  if (race.raceType === 'village_chief' || race.title.includes('里長') || race.title.includes('村長')) {
    return 'village';
  }

  if (race.raceType === 'city_councilor' || race.raceType === 'county_councilor' || race.title.includes('議員')) {
    return 'councilor';
  }

  if (race.raceType === 'legislator' && (race.title.includes('第') || race.title.includes('選舉區'))) {
    return 'legislator';
  }

  return null;
}

function getRaceCategory(race: UpcomingElectionCardRace): RaceCategory {
  if (race.raceType === 'president' || race.raceType === 'vice_president') {
    return 'presidential';
  }

  if (race.raceType === 'municipality_mayor' || race.raceType === 'county_mayor' || race.raceType === 'township_mayor') {
    return 'chief';
  }

  if (
    race.raceType === 'legislator' ||
    race.raceType === 'party_list_legislator' ||
    race.raceType === 'city_councilor' ||
    race.raceType === 'county_councilor' ||
    race.raceType === 'township_representative'
  ) {
    return 'representative';
  }

  return 'basic';
}

function groupTitle(kind: RaceGroupKind, selectedRegionLabel: string) {
  return `${selectedRegionLabel} ${raceGroupLabels[kind].title}`;
}

function isUnfinishedRace(race: UpcomingElectionCardRace) {
  return !['completed', 'cancelled'].includes(race.status);
}

function electionDistrictNumber(race: UpcomingElectionCardRace) {
  const match = race.title.match(/第\s*(\d+)\s*選舉區/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function compareRaceOrder(left: UpcomingElectionCardRace, right: UpcomingElectionCardRace) {
  const statusDiff = Number(isUnfinishedRace(left)) - Number(isUnfinishedRace(right));
  if (statusDiff !== 0) return statusDiff;

  const leftDistrictNumber = electionDistrictNumber(left);
  const rightDistrictNumber = electionDistrictNumber(right);
  if (leftDistrictNumber !== rightDistrictNumber) return leftDistrictNumber - rightDistrictNumber;

  if (left.date !== right.date) return right.date.localeCompare(left.date);

  return left.title.localeCompare(right.title, 'zh-Hant-TW');
}

function groupRaces(races: UpcomingElectionCardRace[], selectedRegionLabel: string) {
  const groups = new Map<string, UpcomingElectionCardRace[]>();
  const orderedItems: (
    | { kind: 'race'; race: UpcomingElectionCardRace }
    | { kind: 'group'; id: string; groupKind: RaceGroupKind; title: string; races: UpcomingElectionCardRace[] }
  )[] = [];

  for (const race of races.slice().sort(compareRaceOrder)) {
    const groupKind = getRaceGroupKind(race);

    if (!groupKind) {
      orderedItems.push({ kind: 'race', race });
      continue;
    }

    const groupId = `${groupKind}-${race.electionId ?? 'unknown'}-${selectedRegionLabel}-${race.date}`;
    const existing = groups.get(groupId);

    if (existing) {
      existing.push(race);
      continue;
    }

    const groupRaces = [race];
    groups.set(groupId, groupRaces);
    orderedItems.push({ kind: 'group', id: groupId, groupKind, title: groupTitle(groupKind, selectedRegionLabel), races: groupRaces });
  }

  return orderedItems.map((item) => {
    if (item.kind === 'race') {
      return item;
    }

    return { ...item, races: item.races.slice().sort(compareRaceOrder) };
  });
}

export function UpcomingElectionCards({
  races,
  selectedRegionId,
  selectedRegionLabel,
  selectedPublicRegionId,
  compact = false,
}: UpcomingElectionCardsProps) {
  const normalizedPublicRegionId = selectedPublicRegionId?.replace('region-', '') ?? null;
  const displayItems = groupRaces(races, selectedRegionLabel);

  function renderCompactRace(race: UpcomingElectionCardRace) {
    const category = raceCategoryStyles[getRaceCategory(race)];
    const isRelated = race.regionId === normalizedPublicRegionId || race.regionId === selectedRegionId;

    const content = (
      <>
        <div
          className="pointer-events-none absolute inset-y-3 left-0 w-1"
          style={{ backgroundColor: category.color }}
          aria-hidden="true"
        />
        <div className="grid grid-cols-[56px_minmax(0,1fr)_84px] items-start gap-3 pl-2">
          <div
            className="grid h-11 w-11 place-items-center rounded-sm border bg-bg/80 font-display text-lg text-white"
            style={{ borderColor: category.color }}
            aria-hidden="true"
          >
            ▣
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm leading-tight text-white">{race.title}</p>
            <p className="mt-1 text-xs text-slate-400">{race.region}</p>
          </div>
          <span className="justify-self-end text-[11px] text-signal">{race.date}</span>
          <div className="col-span-2 col-start-2 mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">{statusLabels[race.status] ?? race.status}</span>
            {race.electionId ? (
              <span
                className="rounded-sm border bg-accent/8 px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-accent/30"
                style={{ borderColor: `${category.color}88`, color: category.color }}
              >
                查看選舉項目
              </span>
            ) : null}
          </div>
        </div>
      </>
    );

    const className =
      'pixel-corners relative block overflow-hidden border bg-bg/55 p-3 transition hover:-translate-y-0.5 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-accent/35';
    const style = { borderColor: isRelated ? category.color : 'rgba(49,64,91,0.8)' };

    return race.electionId ? (
      <Link key={race.id} to={electionPath(race.electionId)} aria-label={`查看${race.title}`} className={className} style={style}>
        {content}
      </Link>
    ) : (
      <article key={race.id} className={className} style={style}>
        {content}
      </article>
    );
  }

  function renderCompactGroup(group: { id: string; groupKind: RaceGroupKind; title: string; races: UpcomingElectionCardRace[] }) {
    const sample = group.races[0];
    const category = raceCategoryStyles[sample ? getRaceCategory(sample) : 'basic'];
    const groupLabel = raceGroupLabels[group.groupKind];

    return (
      <details
        key={group.id}
        className="pixel-corners relative overflow-hidden border bg-bg/55 p-3 open:bg-accent/8"
        style={{ borderColor: category.color }}
      >
        <div
          className="pointer-events-none absolute inset-y-3 left-0 w-1"
          style={{ backgroundColor: category.color }}
          aria-hidden="true"
        />
        <summary className="cursor-pointer list-none">
          <div className="grid grid-cols-[56px_minmax(0,1fr)_84px] items-start gap-3 pl-2">
            <div
              className="grid h-11 w-11 place-items-center rounded-sm border bg-bg/80 font-display text-lg text-white"
              style={{ borderColor: category.color }}
              aria-hidden="true"
            >
              ▦
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm leading-tight text-white">{group.title}</p>
              <p className="mt-1 text-xs text-slate-400">{group.races.length} {groupLabel.countLabel}</p>
            </div>
            <span className="justify-self-end text-[11px] text-signal">{sample?.date ?? '待公告'}</span>
            <div className="col-span-2 col-start-2 mt-2 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">{statusLabels[sample?.status ?? ''] ?? sample?.status ?? '待公告'}</span>
              <span
                className="rounded-sm border bg-accent/8 px-2 py-1 text-[11px]"
                style={{ borderColor: `${category.color}88`, color: category.color }}
              >
                {groupLabel.action}
              </span>
            </div>
          </div>
        </summary>
        <div className="mt-3 space-y-2 border-t border-line/60 pt-3">
          {group.races.map((race) => (
            race.electionId ? (
              <Link
                key={race.id}
                to={electionPath(race.electionId)}
                className="flex items-center justify-between gap-3 pixel-corners border border-line/60 bg-bg/35 px-3 py-2 transition hover:border-white/20 hover:bg-accent/8 focus:outline-none focus:ring-2 focus:ring-accent/35"
                aria-label={`查看${race.title}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{race.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{race.region}</p>
                </div>
                <span
                  className="shrink-0 rounded-sm border bg-accent/8 px-2 py-1 text-[11px]"
                  style={{ borderColor: `${category.color}88`, color: category.color }}
                >
                  查看
                </span>
              </Link>
            ) : (
              <div key={race.id} className="flex items-center justify-between gap-3 pixel-corners border border-line/60 bg-bg/35 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{race.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{race.region}</p>
                </div>
              </div>
            )
          ))}
        </div>
      </details>
    );
  }

  function renderFullRace(race: UpcomingElectionCardRace, index: number) {
    const theme = partyTheme[race.partyTag];
    const isRelated = race.regionId === normalizedPublicRegionId || race.regionId === selectedRegionId;

    return (
      <article
        key={race.id}
        className={[
          'pixel-corners relative overflow-hidden border bg-bg/55 transition hover:-translate-y-0.5 hover:border-white/20',
          'p-4 xl:max-h-[240px] xl:overflow-auto',
          isRelated ? 'border-accent shadow-[0_0_24px_rgba(103,232,249,0.12)]' : 'border-line/80',
        ].join(' ')}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: theme.primary }}
          aria-hidden="true"
        />

        <div className="flex items-start justify-between gap-3">
          <div
            className="grid h-14 w-14 shrink-0 grid-cols-4 gap-0.5 rounded-sm border p-1"
            style={{ borderColor: theme.primary, backgroundColor: `${theme.primary}20` }}
            aria-hidden="true"
          >
            {Array.from({ length: 16 }).map((_, pixel) => (
              <span
                key={pixel}
                style={{ backgroundColor: [1, 2, 4, 5, 6, 9, 10, 13].includes(pixel) ? theme.primary : 'rgba(255,255,255,0.06)' }}
              />
            ))}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Card {index + 1}</p>
            <p className="mt-1 font-display text-base leading-tight text-white">{race.title}</p>
            <p className="mt-1 text-sm text-slate-400">{race.region}</p>
          </div>
          <span
            className="shrink-0 rounded-sm border bg-bg/85 px-2 py-1 text-xs font-semibold text-white shadow-[inset_0_0_10px_rgba(255,255,255,0.04)]"
            style={{
              borderColor: theme.accent,
            }}
          >
            {race.partyLabel}
          </span>
        </div>

        <dl className="mt-4 grid gap-3 text-sm text-slate-300">
          <div className="flex items-center justify-between gap-3 border-b border-line/40 pb-2">
            <dt className="text-slate-500">投票日</dt>
            <dd>{race.date}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-line/40 pb-2">
            <dt className="text-slate-500">狀態</dt>
            <dd>{statusLabels[race.status] ?? race.status}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-line/40 pb-2">
            <dt className="text-slate-500">區域關聯</dt>
            <dd>{isRelated ? '目前選取區域相關' : '示範卡片'}</dd>
          </div>
          <div className="pt-1">
            {race.electionId ? (
              <Link
                to={electionPath(race.electionId)}
                className="inline-flex rounded-sm border border-accent/60 bg-accent/10 px-3 py-2 font-display text-xs uppercase tracking-[0.22em] text-accent focus:outline-none focus:ring-2 focus:ring-accent/35"
              >
                查看選舉資訊
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="rounded-sm border border-accent/30 bg-accent/8 px-3 py-2 font-display text-xs uppercase tracking-[0.22em] text-accent/60"
              >
                查看選舉資訊
              </button>
            )}
          </div>
        </dl>
      </article>
    );
  }

  return (
    <PixelFrame
      title={compact ? '即將到來的選舉' : '熱門選舉項目'}
      action={
        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
          目前選取區域：{selectedRegionLabel}
        </span>
      }
    >
      {displayItems.length > 0 ? (
        <div className={compact ? 'grid gap-3' : 'grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'}>
          {displayItems.map((item, index) => {
            if (item.kind === 'group') {
              return renderCompactGroup(item);
            }

            return compact ? renderCompactRace(item.race) : renderFullRace(item.race, index);
          })}
        </div>
      ) : (
        <div className="pixel-corners border border-line/70 bg-bg/35 px-3 py-4 text-sm text-slate-300">
          目前沒有找到和 {selectedRegionLabel} 直接相關的即將到來選舉。
        </div>
      )}
    </PixelFrame>
  );
}
