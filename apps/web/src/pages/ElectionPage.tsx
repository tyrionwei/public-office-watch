import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { PollComparisonPanel } from '../components/PollComparisonPanel';
import { SectionPanel } from '../components/SectionPanel';
import { groupRacesByCategory } from '../data/electionLabels';
import {
  isCandidateElected,
  translateCandidateStatus,
  translateElectionStatus,
  translateElectionType,
  translateRaceCategory,
  translateRaceStatus,
  translateRaceType,
} from '../data/electionI18n';
import { useI18n } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import { refreshConfiguredPublicDataProvider } from '../lib/publicDataProviderFactory';
import { normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { electionsPath, personPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicCandidate, PublicRace } from '../types/publicViews';

function formatNumber(value: number | null, locale: string) {
  return value === null ? '—' : new Intl.NumberFormat(locale).format(value);
}

function formatPercent(value: number | null) {
  return value === null ? '—' : `${value.toFixed(2)}%`;
}

function uniqueCount(values: Array<string | null>) {
  return new Set(values.filter(Boolean)).size;
}

function getCandidateNumber(candidate: PublicCandidate) {
  const value = Number.parseInt(candidate.candidate_no ?? '', 10);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function compareCandidates(left: PublicCandidate, right: PublicCandidate, locale: string) {
  const numberDiff = getCandidateNumber(left) - getCandidateNumber(right);
  if (numberDiff !== 0) return numberDiff;
  return left.person_name.localeCompare(right.person_name, locale);
}

function groupCandidateRaces(races: PublicRace[], candidatesByRaceId: Map<string, PublicCandidate[]>) {
  return groupRacesByCategory(races).map((group) => ({
    ...group,
    candidateCount: group.races.reduce((total, race) => total + (candidatesByRaceId.get(race.race_id)?.length ?? 0), 0),
    regionCount: uniqueCount(group.races.map((race) => race.region_name)),
  }));
}

export function ElectionPage() {
  const { language, t } = useI18n();
  const { electionId } = useParams();
  const safeElectionId = electionId ?? '';
  const [loadedElectionId, setLoadedElectionId] = useState<string | null>(null);
  const [failedElectionId, setFailedElectionId] = useState<string | null>(null);
  const loading = loadedElectionId !== safeElectionId;

  useEffect(() => {
    let active = true;
    setFailedElectionId(null);

    if (!safeElectionId) {
      setLoadedElectionId(safeElectionId);
      return () => {
        active = false;
      };
    }

    void refreshConfiguredPublicDataProvider()
      .then(() => publicDataProvider.loadElectionDetail(safeElectionId))
      .catch((error: unknown) => {
        if (!active) return;
        setFailedElectionId(safeElectionId);
        if (import.meta.env.DEV) console.warn('Failed to load election detail', error);
      })
      .finally(() => {
        if (active) setLoadedElectionId(safeElectionId);
      });

    return () => {
      active = false;
    };
  }, [safeElectionId]);

  const election = loading ? null : publicDataProvider.getElectionById(safeElectionId);
  const races = loading ? [] : publicDataProvider.getRacesByElectionId(safeElectionId);
  const candidates = loading ? [] : publicDataProvider.getCandidatesByElectionId(safeElectionId);
  const pollComparison = loading ? null : publicDataProvider.getPollComparisonByElectionId(safeElectionId);
  const candidatesByRaceId = candidates.reduce<Map<string, PublicCandidate[]>>((groups, candidate) => {
    const values = groups.get(candidate.race_id) ?? [];
    values.push(candidate);
    groups.set(candidate.race_id, values);
    return groups;
  }, new Map<string, PublicCandidate[]>());
  const racesWithCandidates = races.filter((race) => candidatesByRaceId.has(race.race_id));
  const raceGroups = groupCandidateRaces(races, candidatesByRaceId);
  const raceGroupsWithCandidates = groupCandidateRaces(racesWithCandidates, candidatesByRaceId);
  const electedCount = candidates.filter(isCandidateElected).length;
  const sourcedCandidateCount = candidates.filter((candidate) => candidate.source_name).length;
  const regionCount = uniqueCount(races.map((race) => race.region_name));
  const raceCategorySummary = raceGroups.length > 0
    ? raceGroups.map((group) => t('legacyElection.categoryItem', { category: translateRaceCategory(group.category.key, t), count: group.races.length })).join(language === 'zh-TW' ? '、' : ', ')
    : t('legacyElection.noCategoriesSummary');

  return (
    <AppShell>
      <PixelFrame
        title={t('legacyElection.frameTitle')}
        action={
          <Link to={electionsPath()} className="text-[11px] uppercase tracking-[0.22em] text-accent">
            {t('legacyElection.back')}
          </Link>
        }
      >
        {election ? (
          <div className="space-y-4">
            <section className="pixel-corners border border-line/70 bg-[linear-gradient(180deg,rgba(11,19,38,0.94),rgba(15,24,46,0.88))] p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.36fr)] lg:items-start">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.22em] text-accent">{t('legacyElection.overview')}</p>
                  <h2 className="mt-2 font-display text-3xl text-white sm:text-4xl">{election.name}</h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                    <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">
                      {translateElectionType(election.election_type, t)}
                    </span>
                    <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">
                      {translateElectionStatus(election.status, t)}
                    </span>
                    <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">
                      {election.voting_date ?? t('event.voteDatePending')}
                    </span>
                  </div>
                </div>

                <div className="pixel-corners border border-line/70 bg-bg/35 px-4 py-3 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{t('legacyElection.source')}</p>
                  <p className="mt-2">{election.source_name ?? t('legacyElection.publicData')}</p>
                  {election.source_url ? (
                    <a href={election.source_url} className="mt-2 inline-block text-xs text-accent hover:text-white">
                      {t('legacyElection.viewSource')}
                    </a>
                  ) : null}
                </div>
              </div>

              <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <HudStatCard label={t('legacyElection.voteDate')} value={<span className="font-display text-xl text-signal">{election.voting_date ?? t('common.toBeAnnounced')}</span>} />
                <HudStatCard label={t('legacyElection.raceCount')} value={<span className="font-display text-xl text-white">{races.length}</span>} />
                <HudStatCard label={t('legacyElection.candidateRecords')} value={<span className="font-display text-xl text-white">{candidates.length}</span>} />
                <HudStatCard label={t('legacyElection.coveredRegions')} value={regionCount > 0 ? t('legacyElection.regionCount', { count: regionCount }) : t('legacyElection.unspecified')} />
              </dl>
            </section>

            <SectionPanel title={t('legacyElection.includesTitle')} eyebrow={t('legacyElection.includesEyebrow')}>
              {raceGroups.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-slate-300">
                    {t('legacyElection.includesDescription', { count: races.length, summary: raceCategorySummary })}
                  </p>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {raceGroups.map((group) => (
                      <div key={group.category.key} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{translateRaceCategory(group.category.key, t)}</p>
                        <p className="mt-2 font-display text-2xl text-white">{group.races.length}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {t('legacyElection.groupSummary', { regions: group.regionCount > 0 ? t('legacyElection.regionUnit', { count: group.regionCount }) : t('legacyElection.unspecifiedRegion'), candidates: group.candidateCount })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">{t('legacyElection.noCategories')}</p>
              )}
            </SectionPanel>

            {pollComparison ? <PollComparisonPanel comparison={pollComparison} /> : null}

            <SectionPanel title={candidates.length > 0 ? t('legacyElection.rosterTitle') : t('legacyElection.raceOverviewTitle')} eyebrow={t('legacyElection.rosterTitle')}>
              {races.length > 0 ? (
                candidates.length > 0 ? (
                  <div className="space-y-4">
                    {racesWithCandidates.length < races.length ? (
                      <p className="text-sm text-slate-400">
                        {t('legacyElection.partialRoster', { available: racesWithCandidates.length, missing: races.length - racesWithCandidates.length })}
                      </p>
                    ) : null}

                    {raceGroupsWithCandidates.map((group) => (
                      <section key={group.category.key} className="space-y-3">
                        <div className="flex flex-col gap-2 border-b border-line/60 pb-2 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-accent">{translateRaceCategory(group.category.key, t)}</p>
                            <h3 className="font-display text-2xl text-white">{t('legacyElection.categoryRaces', { category: translateRaceCategory(group.category.key, t) })}</h3>
                          </div>
                          <p className="text-sm text-slate-400">{t('legacyElection.raceCandidateSummary', { races: group.races.length, candidates: group.candidateCount })}</p>
                        </div>

                        {group.races.map((race) => {
                          const raceCandidates = (candidatesByRaceId.get(race.race_id) ?? []).slice().sort((left, right) => compareCandidates(left, right, language));
                          const raceElectedCount = raceCandidates.filter(isCandidateElected).length;

                          return (
                            <article key={race.race_id} className="pixel-corners border border-line/70 bg-bg/35">
                              <header className="border-b border-line/60 px-4 py-3">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="min-w-0">
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                      {translateRaceType(race.race_type, t)}
                                    </p>
                                    <h4 className="mt-1 font-display text-xl text-white">{race.title}</h4>
                                    <p className="mt-1 text-sm text-slate-400">{race.region_name ?? t('legacyElection.unspecifiedRegion')}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-2 text-xs text-slate-300 lg:justify-end">
                                    <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">
                                      {translateRaceStatus(race.status, t)}
                                    </span>
                                    <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">
                                      {t('legacyElection.candidateCount', { count: raceCandidates.length })}
                                    </span>
                                    {raceElectedCount > 0 ? (
                                      <span className="pixel-corners border border-signal/55 bg-signal/10 px-2 py-1 text-signal">
                                        {t('legacyElection.electedCount', { count: raceElectedCount })}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </header>

                              <div className="divide-y divide-line/60">
                                {raceCandidates.map((candidate) => {
                                  const partyLabel = normalizePartyLabel(candidate.party ?? candidate.person_party);
                                  const theme = partyTheme[toPartyThemeKey(partyLabel)];
                                  const rowContent = (
                                    <>
                                      <div className="min-w-0">
                                        <p className="truncate font-display text-lg text-white">{candidate.person_name}</p>
                                        <p className="mt-1 truncate text-xs text-slate-500">{candidate.person_position ?? race.title}</p>
                                      </div>
                                      <div className="min-w-0">
                                        <span
                                          className="pixel-corners inline-block max-w-full truncate border px-2 py-1 text-xs"
                                          style={{ borderColor: theme.accent, backgroundColor: `${theme.primary}33`, color: theme.text }}
                                        >
                                          {partyLabel}
                                        </span>
                                      </div>
                                      <p className={isCandidateElected(candidate) ? 'text-sm text-signal' : 'text-sm text-slate-300'}>
                                        {translateCandidateStatus(candidate, t)}
                                      </p>
                                      <p className="text-sm text-slate-300">{formatNumber(candidate.vote_count, language)}</p>
                                      <p className="text-sm text-slate-300">{formatPercent(candidate.vote_rate)}</p>
                                    </>
                                  );
                                  const rowClassName = 'grid gap-3 px-4 py-3 lg:grid-cols-[minmax(150px,1fr)_minmax(120px,0.55fr)_100px_100px_96px]';

                                  return candidate.person_id ? (
                                    <Link
                                      key={candidate.candidate_id}
                                      to={personPath(candidate.person_id)}
                                      className={`${rowClassName} transition hover:bg-accent/8 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/35`}
                                    >
                                      {rowContent}
                                    </Link>
                                  ) : (
                                    <div key={candidate.candidate_id} className={rowClassName}>
                                      {rowContent}
                                    </div>
                                  );
                                })}
                              </div>
                            </article>
                          );
                        })}
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm leading-6 text-slate-300">
                      <p>{t('legacyElection.rosterMissing')}</p>
                    </div>

                    {raceGroups.map((group) => (
                      <section key={group.category.key} className="space-y-3">
                        <div className="flex flex-col gap-2 border-b border-line/60 pb-2 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-accent">{translateRaceCategory(group.category.key, t)}</p>
                            <h3 className="font-display text-2xl text-white">{t('legacyElection.categoryOverview', { category: translateRaceCategory(group.category.key, t) })}</h3>
                          </div>
                          <p className="text-sm text-slate-400">{t('legacyElection.raceUnit', { count: group.races.length })}</p>
                        </div>
                        <div className="pixel-corners max-h-[420px] overflow-auto border border-line/70 bg-bg/35">
                          <div className="grid gap-3 border-b border-line/70 px-4 py-2 text-xs uppercase tracking-[0.16em] text-slate-500 md:grid-cols-[minmax(180px,1fr)_minmax(120px,0.45fr)_minmax(120px,0.45fr)]">
                            <span>{t('legacyElection.race')}</span>
                            <span>{t('legacyElection.region')}</span>
                            <span>{t('legacyElection.status')}</span>
                          </div>
                          <div className="divide-y divide-line/60">
                            {group.races.map((race) => (
                              <div key={race.race_id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[minmax(180px,1fr)_minmax(120px,0.45fr)_minmax(120px,0.45fr)]">
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-white">{race.title}</p>
                                  <p className="mt-1 text-xs text-slate-500">{translateRaceType(race.race_type, t)}</p>
                                </div>
                                <p className="text-slate-300">{race.region_name ?? t('legacyElection.unspecifiedRegion')}</p>
                                <p className="text-slate-300">{translateRaceStatus(race.status, t)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>
                    ))}
                  </div>
                )
              ) : (
                <p className="text-sm text-slate-400">{t('legacyElection.noRaces')}</p>
              )}
            </SectionPanel>

            <SectionPanel title={t('legacyElection.dataStatusTitle')} eyebrow={t('legacyElection.dataStatusEyebrow')}>
              <div className="grid gap-3 text-sm leading-6 text-slate-300 md:grid-cols-3">
                <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('legacyElection.coverage')}</p>
                  <p className="mt-2">{t('legacyElection.coverageBody', { races: races.length, candidates: candidates.length, elected: electedCount })}</p>
                </div>
                <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('legacyElection.source')}</p>
                  <p className="mt-2">{t('legacyElection.sourceBody', { count: sourcedCandidateCount })}</p>
                </div>
                <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('legacyElection.boundary')}</p>
                  <p className="mt-2">{t('legacyElection.boundaryBody')}</p>
                </div>
              </div>
            </SectionPanel>
          </div>
        ) : loading ? (
          <p className="text-sm text-slate-300">{t('legacyElection.loading')}</p>
        ) : (
          <div className="space-y-3 text-sm text-slate-300">
            <h2 className="font-display text-2xl text-white">
              {failedElectionId === safeElectionId ? t('legacyElection.loadError') : t('legacyElection.notFound')}
            </h2>
            {failedElectionId === safeElectionId ? null : <p>{t('legacyElection.notFoundBody')}</p>}
            {failedElectionId === safeElectionId ? null : <p>{t('legacyElection.notFoundHint')}</p>}
          </div>
        )}
      </PixelFrame>
    </AppShell>
  );
}
