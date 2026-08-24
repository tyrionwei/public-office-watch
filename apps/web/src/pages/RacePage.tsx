import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { CandidateComparisonPanel } from '../components/CandidateComparisonPanel';
import { ElectionBreadcrumbs } from '../components/ElectionBreadcrumbs';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { buildElectionEvents, getElectionEventForRace, getRaceRegionGroup } from '../data/electionEvents';
import { isCandidateElected, translateCandidateStatus, translateElectionEventTitle, translateElectionStatus, translateRaceCategory, translateRaceStatus, translateRaceType } from '../data/electionI18n';
import { getRaceCategory } from '../data/electionLabels';
import { useI18n } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import { refreshConfiguredPublicDataProvider } from '../lib/publicDataProviderFactory';
import type { PublicRaceDetailData } from '../lib/publicDataProvider';
import { getPreviousPartyName, normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { electionEventPath, electionsPath, personPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicCandidate, PublicPersonProfile } from '../types/publicViews';

function formatNumber(value: number | null, locale: string) {
  return value === null ? '—' : new Intl.NumberFormat(locale).format(value);
}

function formatPercent(value: number | null) {
  return value === null ? '—' : `${value.toFixed(2)}%`;
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

export function RacePage() {
  const { language, t } = useI18n();
  const { raceId } = useParams();
  const safeRaceId = raceId ?? '';
  const [searchParams, setSearchParams] = useSearchParams();
  const [detail, setDetail] = useState<PublicRaceDetailData>({
    race: null,
    election: null,
    candidates: [],
    partyAffiliations: [],
    referendumQuestion: null,
    referendumOptions: [],
    referendumRegionResults: [],
  });
  const [loading, setLoading] = useState(true);
  const [comparisonProfiles, setComparisonProfiles] = useState<PublicPersonProfile[]>([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setDetail({
      race: null,
      election: null,
      candidates: [],
      partyAffiliations: [],
      referendumQuestion: null,
      referendumOptions: [],
      referendumRegionResults: [],
    });

    void refreshConfiguredPublicDataProvider()
      .then(() => publicDataProvider.loadRaceDetail(safeRaceId))
      .then((nextDetail) => {
        if (active) setDetail(nextDetail);
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.warn('Failed to load race detail', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [safeRaceId]);

  const { race, election } = detail;
  const candidates = useMemo(
    () => detail.candidates.slice().sort((left, right) => compareCandidates(left, right, language)),
    [detail.candidates, language],
  );
  const candidatePersonIds = useMemo(
    () => new Set(candidates.map((candidate) => candidate.person_id).filter(Boolean)),
    [candidates],
  );
  const selectedPersonIds = useMemo(
    () => Array.from(new Set((searchParams.get('compare') ?? '').split(',').filter(Boolean)))
      .filter((personId) => candidatePersonIds.has(personId))
      .slice(0, 4),
    [candidatePersonIds, searchParams],
  );
  const selectedCandidates = selectedPersonIds
    .map((personId) => candidates.find((candidate) => candidate.person_id === personId))
    .filter((candidate): candidate is PublicCandidate => Boolean(candidate));
  const comparisonKey = selectedPersonIds.join(',');
  const electedCount = candidates.filter(isCandidateElected).length;
  useEffect(() => {
    let active = true;
    const personIds = comparisonKey ? comparisonKey.split(',') : [];
    if (personIds.length < 2) {
      setComparisonProfiles([]);
      setComparisonLoading(false);
      return () => {
        active = false;
      };
    }

    setComparisonLoading(true);
    void publicDataProvider.loadPersonProfiles(personIds)
      .then((profiles) => {
        if (active) setComparisonProfiles(profiles);
      })
      .catch((error: unknown) => {
        if (active) setComparisonProfiles([]);
        if (import.meta.env.DEV) console.warn('Failed to load candidate comparison profiles', error);
      })
      .finally(() => {
        if (active) setComparisonLoading(false);
      });

    return () => {
      active = false;
    };
  }, [comparisonKey]);

  const events = buildElectionEvents(election ? [election] : [], race ? [race] : []);
  const event = getElectionEventForRace(events, race);
  const backPath = event ? electionEventPath(event.key) : electionsPath();

  function updateComparison(personId: string, selected: boolean) {
    const nextIds = selected
      ? [...selectedPersonIds, personId].slice(0, 4)
      : selectedPersonIds.filter((selectedId) => selectedId !== personId);
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextIds.length > 0) nextSearchParams.set('compare', nextIds.join(','));
    else nextSearchParams.delete('compare');
    setSearchParams(nextSearchParams, { replace: true });
  }

  if (!race) {
    return (
      <AppShell>
        <PixelFrame title={loading ? t('race.loadingTitle') : t('race.notFoundTitle')} action={<Link to={electionsPath()} className="text-[11px] uppercase tracking-[0.22em] text-accent">{t('race.backYears')}</Link>}>
          <p className="text-sm text-slate-300">{loading ? t('race.loadingBody') : t('race.notFoundBody')}</p>
        </PixelFrame>
      </AppShell>
    );
  }

  const category = getRaceCategory(race);
  const region = getRaceRegionGroup(race);
  const eventTitle = event ? translateElectionEventTitle(event, t) : election?.name ?? race.election_name;
  const eventRootPath = event ? electionEventPath(event.key) : electionsPath();
  const eventRegionPath = event
    ? `${eventRootPath}?${new URLSearchParams({ region: region.key }).toString()}`
    : eventRootPath;
  const eventCategoryPath = event
    ? `${eventRootPath}?${new URLSearchParams({ category: category.key, region: region.key }).toString()}`
    : eventRootPath;
  const isReferendum = race.race_type === 'referendum';
  const referendumQuestion = detail.referendumQuestion;
  const referendumOptions = detail.referendumOptions.slice().sort((left, right) => left.display_order - right.display_order);
  const referendumRegionResults = detail.referendumRegionResults.slice().sort((left, right) => (
    left.region_name.localeCompare(right.region_name, language)
  ));
  const referendumOutcome = referendumQuestion?.result_status === 'passed'
    ? t('race.referendumPassed')
    : referendumQuestion?.result_status === 'not_passed'
      ? t('race.referendumNotPassed')
      : t('race.referendumPending');

  return (
    <AppShell>
      <div className="space-y-4">
        <ElectionBreadcrumbs
          items={[
            { label: eventTitle, to: eventRootPath },
            { label: region.label, to: eventRegionPath },
            { label: translateRaceCategory(category.key, t), to: eventCategoryPath },
            { label: race.title },
          ]}
        />
        <PixelFrame
          title={t('race.detailTitle')}
          action={<Link to={backPath} className="text-[11px] uppercase tracking-[0.22em] text-accent">{t('race.backOverview')}</Link>}
        >
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.34fr)]">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.22em] text-accent">{race.voting_date ?? election?.voting_date ?? t('race.voteDatePending')}</p>
              <h1 className="mt-2 font-display text-4xl text-white">{race.title}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {eventTitle} · {translateRaceCategory(category.key, t)} · {region.label}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">{translateRaceType(race.race_type, t)}</span>
                <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">{translateRaceStatus(race.status, t)}</span>
                {election ? <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">{translateElectionStatus(election.status, t)}</span> : null}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {isReferendum ? (
                <>
                  <HudStatCard label={t('race.referendumOutcome')} value={<span className="font-display text-xl text-signal">{referendumOutcome}</span>} />
                  <HudStatCard label={t('race.referendumTurnout')} value={<span className="font-display text-xl text-white">{formatPercent(referendumQuestion?.turnout_rate ?? null)}</span>} />
                  <HudStatCard label={t('race.region')} value={<span className="font-display text-xl text-white">{referendumQuestion?.jurisdiction_name ?? region.label}</span>} />
                </>
              ) : (
                <>
                  <HudStatCard label={t('race.candidates')} value={<span className="font-display text-xl text-white">{candidates.length}</span>} />
                  <HudStatCard label={t('race.elected')} value={<span className="font-display text-xl text-signal">{electedCount}</span>} />
                  <HudStatCard label={t('race.region')} value={<span className="font-display text-xl text-white">{region.label}</span>} />
                </>
              )}
            </div>
          </section>
        </PixelFrame>

        {isReferendum ? (
          <SectionPanel title={t('race.referendumResult')} eyebrow={t('race.publicData')}>
            {referendumQuestion ? (
              <div className="space-y-4">
                <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('race.referendumProposal')}</p>
                  <p className="mt-3 text-base leading-7 text-white">{referendumQuestion.proposal_text}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {referendumOptions.map((option) => (
                    <div key={option.option_id} className="pixel-corners border border-line/70 bg-panelAlt/45 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-display text-2xl text-white">{option.label}</p>
                        <p className="font-display text-xl text-accent">{formatPercent(option.vote_rate)}</p>
                      </div>
                      <p className="mt-3 text-sm text-slate-300">{formatNumber(option.vote_count, language)} {t('race.referendumVotesUnit')}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <HudStatCard label={t('race.referendumEligibleVoters')} value={<span className="font-display text-lg text-white">{formatNumber(referendumQuestion.eligible_voters, language)}</span>} />
                  <HudStatCard label={t('race.referendumTotalVotes')} value={<span className="font-display text-lg text-white">{formatNumber(referendumQuestion.total_votes, language)}</span>} />
                  <HudStatCard label={t('race.referendumValidVotes')} value={<span className="font-display text-lg text-white">{formatNumber(referendumQuestion.valid_votes, language)}</span>} />
                  <HudStatCard label={t('race.referendumInvalidVotes')} value={<span className="font-display text-lg text-white">{formatNumber(referendumQuestion.invalid_votes, language)}</span>} />
                </div>
                {referendumQuestion.approval_rule ? (
                  <div className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm leading-6 text-slate-300">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('race.referendumApprovalRule')}</p>
                    <p className="mt-2">{referendumQuestion.approval_rule}</p>
                  </div>
                ) : null}
                {referendumRegionResults.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <h2 className="font-display text-2xl text-white">{t('race.referendumRegionBreakdown')}</h2>
                      <p className="text-xs text-slate-500">{t('race.referendumRegionCount', { count: referendumRegionResults.length })}</p>
                    </div>
                    <div className="overflow-x-auto pixel-corners border border-line/70">
                      <div className="min-w-[980px]">
                        <div className="grid grid-cols-[minmax(130px,1fr)_repeat(7,minmax(100px,0.72fr))] gap-3 border-b border-line/70 bg-panelAlt/55 px-4 py-2 text-xs uppercase tracking-[0.12em] text-slate-500">
                          <span>{t('race.referendumRegion')}</span>
                          <span className="text-right">{t('race.referendumEligibleVoters')}</span>
                          <span className="text-right">{t('race.referendumYesVotes')}</span>
                          <span className="text-right">{t('race.referendumYesRate')}</span>
                          <span className="text-right">{t('race.referendumNoVotes')}</span>
                          <span className="text-right">{t('race.referendumNoRate')}</span>
                          <span className="text-right">{t('race.referendumInvalidVotes')}</span>
                          <span className="text-right">{t('race.referendumTurnout')}</span>
                        </div>
                        <div className="divide-y divide-line/60">
                          {referendumRegionResults.map((result) => {
                            const validVotes = result.yes_votes !== null && result.no_votes !== null
                              ? result.yes_votes + result.no_votes
                              : null;
                            const yesRate = validVotes !== null && validVotes > 0 && result.yes_votes !== null
                              ? result.yes_votes * 100 / validVotes
                              : null;
                            const noRate = validVotes !== null && validVotes > 0 && result.no_votes !== null
                              ? result.no_votes * 100 / validVotes
                              : null;

                            return (
                              <div key={result.result_id} className="grid grid-cols-[minmax(130px,1fr)_repeat(7,minmax(100px,0.72fr))] gap-3 px-4 py-3 text-sm text-slate-300">
                                <a href={result.source_url} className="font-medium text-white hover:text-accent" title={t('race.viewElectionSource')}>{result.region_name}</a>
                                <span className="text-right tabular-nums">{formatNumber(result.eligible_voters, language)}</span>
                                <span className="text-right tabular-nums">{formatNumber(result.yes_votes, language)}</span>
                                <span className="text-right tabular-nums">{formatPercent(yesRate)}</span>
                                <span className="text-right tabular-nums">{formatNumber(result.no_votes, language)}</span>
                                <span className="text-right tabular-nums">{formatPercent(noRate)}</span>
                                <span className="text-right tabular-nums">{formatNumber(result.invalid_votes, language)}</span>
                                <span className="text-right tabular-nums">{formatPercent(result.turnout_rate)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-300">{t('race.referendumPendingData')}</p>
            )}
          </SectionPanel>
        ) : null}

        {!isReferendum ? <SectionPanel title={candidates.length > 0 ? t('race.listTitle') : t('race.listFallbackTitle')} eyebrow={t('race.roster')}>
          {candidates.length > 0 ? (
            <div className="overflow-hidden pixel-corners border border-line/70">
              <div className="grid gap-3 border-b border-line/70 bg-panelAlt/55 px-4 py-2 text-xs uppercase tracking-[0.16em] text-slate-500 lg:grid-cols-[44px_72px_minmax(150px,1fr)_minmax(120px,0.55fr)_96px_100px_96px]">
                <span>{t('race.compareSelect')}</span>
                <span>{t('race.number')}</span>
                <span>{t('race.name')}</span>
                <span>{t('race.party')}</span>
                <span>{t('race.status')}</span>
                <span>{t('race.votes')}</span>
                <span>{t('race.voteRate')}</span>
              </div>
              <div className="divide-y divide-line/60">
                {candidates.map((candidate) => {
                  const partyLabel = normalizePartyLabel(candidate.party ?? candidate.person_party);
                  const previousPartyName = getPreviousPartyName(
                    detail.partyAffiliations.filter((affiliation) => affiliation.person_id === candidate.person_id),
                    partyLabel,
                    candidate.election_year,
                  );
                  const theme = partyTheme[toPartyThemeKey(partyLabel)];
                  const isSelected = selectedPersonIds.includes(candidate.person_id);
                  const selectionDisabled = !candidate.person_id || (!isSelected && selectedPersonIds.length >= 4);
                  const rowContent = (
                    <>
                      <label className="flex h-6 w-6 items-center justify-center" title={selectionDisabled ? t('race.compareLimit') : t('race.compareSelect')}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={selectionDisabled}
                          onChange={(event) => updateComparison(candidate.person_id, event.target.checked)}
                          className="h-4 w-4 accent-cyan-300 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={`${t('race.compareSelect')} ${candidate.person_name}`}
                        />
                      </label>
                      <p className="text-sm text-slate-300">{candidate.candidate_no ?? '—'}</p>
                      <div className="min-w-0">
                        {candidate.person_id ? (
                          <Link to={personPath(candidate.person_id)} className="truncate font-display text-lg text-white hover:text-accent">
                            {candidate.person_name}
                          </Link>
                        ) : <p className="truncate font-display text-lg text-white">{candidate.person_name}</p>}
                        <p className="mt-1 truncate text-xs text-slate-500">{candidate.person_position ?? race.title}</p>
                      </div>
                      <div className="min-w-0">
                        <span
                          className="pixel-corners inline-block max-w-full truncate border px-2 py-1 text-xs"
                          style={{ borderColor: theme.accent, backgroundColor: `${theme.primary}33`, color: theme.text }}
                        >
                          {partyLabel}
                        </span>
                        {previousPartyName ? (
                          <p className="mt-1 truncate text-[11px] text-slate-500">
                            {t('race.previousParty')}: {previousPartyName}
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <p className={isCandidateElected(candidate) ? 'text-sm text-signal' : 'text-sm text-slate-300'}>
                          {translateCandidateStatus(candidate, t)}
                        </p>
                        {candidate.is_incumbent ? (
                          <span className="mt-1 inline-block border border-amber-300/50 bg-amber-300/10 px-2 py-0.5 text-[11px] text-amber-200" data-incumbent-badge>
                            {t('race.incumbent')}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-slate-300">{formatNumber(candidate.vote_count, language)}</p>
                      <p className="text-sm text-slate-300">{formatPercent(candidate.vote_rate)}</p>
                    </>
                  );
                  const rowClassName = 'grid gap-3 px-4 py-3 transition hover:bg-accent/8 lg:grid-cols-[44px_72px_minmax(150px,1fr)_minmax(120px,0.55fr)_96px_100px_96px]';

                  return <div key={candidate.candidate_id} className={rowClassName}>{rowContent}</div>;
                })}
              </div>
            </div>
          ) : (
            <div className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm leading-6 text-slate-300">
              <p>{t('race.emptyCandidates')}</p>
            </div>
          )}
          {candidates.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2 border-t border-line/50 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-slate-400">{t('race.compareHint')}</p>
              <p className={selectedPersonIds.length >= 2 ? 'text-signal' : 'text-accent'}>
                {t('race.compareSelected', { count: selectedPersonIds.length })}
              </p>
            </div>
          ) : null}
        </SectionPanel> : null}

        {!isReferendum && selectedCandidates.length > 0 ? (
          <CandidateComparisonPanel
            candidates={selectedCandidates}
            profiles={comparisonProfiles}
            loading={comparisonLoading}
            currentRaceId={race.race_id}
            onRemove={(personId) => updateComparison(personId, false)}
          />
        ) : null}

        <SectionPanel title={t('race.sources')} eyebrow={t('race.publicData')}>
          <div className="grid gap-3 text-sm leading-6 text-slate-300 md:grid-cols-2">
            <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('race.electionData')}</p>
              <p className="mt-2">{referendumQuestion?.source_name ?? election?.source_name ?? race.source_name ?? t('race.publicElectionData')}</p>
              {(referendumQuestion?.source_url ?? election?.source_url) ? <a href={referendumQuestion?.source_url ?? election?.source_url ?? undefined} className="mt-2 inline-block text-xs text-accent hover:text-white">{t('race.viewElectionSource')}</a> : null}
            </div>
            <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('race.raceData')}</p>
              <p className="mt-2">{race.source_name ?? t('race.publicRaceData')}</p>
              {(referendumQuestion?.source_document_url ?? race.source_url) ? <a href={referendumQuestion?.source_document_url ?? race.source_url ?? undefined} className="mt-2 inline-block text-xs text-accent hover:text-white">{t('race.viewRaceSource')}</a> : null}
            </div>
          </div>
        </SectionPanel>
      </div>
    </AppShell>
  );
}
