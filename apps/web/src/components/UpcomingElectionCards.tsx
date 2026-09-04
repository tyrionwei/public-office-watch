import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import type { Translate } from '../i18n';
import { compareUpcomingRacesForDisplay } from '../data/upcomingRaceSort';
import { racePath } from '../routes/routePaths';
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

function getStatusLabel(status: string, t: Translate) {
  if (status === 'upcoming') return t('electionCards.status.upcoming');
  if (status === 'announced') return t('electionCards.status.announced');
  if (status === 'active') return t('electionCards.status.active');
  if (status === 'completed') return t('electionCards.status.completed');
  return status;
}

type RaceGroupKind = 'village' | 'councilor' | 'legislator';
type RaceCategory = 'presidential' | 'chief' | 'representative' | 'basic';

const raceCategoryStyles: Record<RaceCategory, { color: string }> = {
  presidential: { color: '#f472b6' },
  chief: { color: '#f4d35e' },
  representative: { color: '#7dd3fc' },
  basic: { color: '#86efac' },
};

function getRaceGroupLabel(kind: RaceGroupKind, t: Translate) {
  if (kind === 'village') {
    return {
      title: t('electionCards.group.village.title'),
      countLabel: t('electionCards.group.village.count'),
      action: t('electionCards.group.village.action'),
    };
  }

  if (kind === 'councilor') {
    return {
      title: t('electionCards.group.councilor.title'),
      countLabel: t('electionCards.group.councilor.count'),
      action: t('electionCards.group.councilor.action'),
    };
  }

  return {
    title: t('electionCards.group.legislator.title'),
    countLabel: t('electionCards.group.legislator.count'),
    action: t('electionCards.group.legislator.action'),
  };
}

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

function groupTitle(kind: RaceGroupKind, selectedRegionLabel: string, t: Translate) {
  return `${selectedRegionLabel} ${getRaceGroupLabel(kind, t).title}`;
}

function groupRaces(races: UpcomingElectionCardRace[], selectedRegionLabel: string, t: Translate) {
  const groups = new Map<string, UpcomingElectionCardRace[]>();
  const orderedItems: (
    | { kind: 'race'; race: UpcomingElectionCardRace }
    | { kind: 'group'; id: string; groupKind: RaceGroupKind; title: string; races: UpcomingElectionCardRace[] }
  )[] = [];

  for (const race of races.slice().sort(compareUpcomingRacesForDisplay)) {
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
    orderedItems.push({ kind: 'group', id: groupId, groupKind, title: groupTitle(groupKind, selectedRegionLabel, t), races: groupRaces });
  }

  return orderedItems.map((item) => {
    if (item.kind === 'race') {
      return item;
    }

    return { ...item, races: item.races.slice().sort(compareUpcomingRacesForDisplay) };
  });
}

export function UpcomingElectionCards({
  races,
  selectedRegionId,
  selectedRegionLabel,
  selectedPublicRegionId,
  compact = false,
}: UpcomingElectionCardsProps) {
  const { t } = useI18n();
  const normalizedPublicRegionId = selectedPublicRegionId?.replace('region-', '') ?? null;
  const displayItems = groupRaces(races, selectedRegionLabel, t);

  function renderCompactRace(race: UpcomingElectionCardRace) {
    const categoryKind = getRaceCategory(race);
    const category = raceCategoryStyles[categoryKind];
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
            <span className="text-xs text-slate-500">{getStatusLabel(race.status, t)}</span>
            {race.electionId ? (
              <span
                data-race-category={categoryKind}
                className="rounded-sm border bg-accent/8 px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-accent/30"
                style={{ borderColor: `${category.color}88`, color: category.color }}
              >
                {t('electionCards.viewElectionItem')}
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
      <Link key={race.id} to={racePath(race.id)} aria-label={t('electionCards.viewRaceAria', { title: race.title })} className={className} style={style}>
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
    const categoryKind = sample ? getRaceCategory(sample) : 'basic';
    const category = raceCategoryStyles[categoryKind];
    const groupLabel = getRaceGroupLabel(group.groupKind, t);

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
            <span className="justify-self-end text-[11px] text-signal">{sample?.date ?? t('common.toBeAnnounced')}</span>
            <div className="col-span-2 col-start-2 mt-2 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">{sample ? getStatusLabel(sample.status, t) : t('common.toBeAnnounced')}</span>
              <span
                data-race-category={categoryKind}
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
                to={racePath(race.id)}
                className="flex items-center justify-between gap-3 pixel-corners border border-line/60 bg-bg/35 px-3 py-2 transition hover:border-white/20 hover:bg-accent/8 focus:outline-none focus:ring-2 focus:ring-accent/35"
                aria-label={t('electionCards.viewRaceAria', { title: race.title })}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{race.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{race.region}</p>
                </div>
                <span
                  data-race-category={categoryKind}
                  className="shrink-0 rounded-sm border bg-accent/8 px-2 py-1 text-[11px]"
                  style={{ borderColor: `${category.color}88`, color: category.color }}
                >
                  {t('common.view')}
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
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{t('electionCards.item', { number: index + 1 })}</p>
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
            <dt className="text-slate-500">{t('electionCards.voteDate')}</dt>
            <dd>{race.date}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-line/40 pb-2">
            <dt className="text-slate-500">{t('electionCards.status')}</dt>
            <dd>{getStatusLabel(race.status, t)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-line/40 pb-2">
            <dt className="text-slate-500">{t('electionCards.regionRelation')}</dt>
            <dd>{isRelated ? t('electionCards.relatedRegion') : t('electionCards.demoCard')}</dd>
          </div>
          <div className="pt-1">
            {race.electionId ? (
              <Link
                to={racePath(race.id)}
                className="inline-flex rounded-sm border border-accent/60 bg-accent/10 px-3 py-2 font-display text-xs uppercase tracking-[0.22em] text-accent focus:outline-none focus:ring-2 focus:ring-accent/35"
              >
                {t('electionCards.viewElection')}
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="rounded-sm border border-accent/30 bg-accent/8 px-3 py-2 font-display text-xs uppercase tracking-[0.22em] text-accent/60"
              >
                {t('electionCards.viewElection')}
              </button>
            )}
          </div>
        </dl>
      </article>
    );
  }

  return (
    <PixelFrame
      title={compact ? t('electionCards.titleCompact') : t('electionCards.titleFull')}
      action={
        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
          {t('electionCards.selectedRegion', { region: selectedRegionLabel })}
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
          {t('electionCards.noRelated', { region: selectedRegionLabel })}
        </div>
      )}
    </PixelFrame>
  );
}
