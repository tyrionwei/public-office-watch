import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
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
import { normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { electionEventPath, electionsPath, personPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicCandidate } from '../types/publicViews';

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
  const [detail, setDetail] = useState<PublicRaceDetailData>({ race: null, election: null, candidates: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setDetail({ race: null, election: null, candidates: [] });

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
  const candidates = detail.candidates.slice().sort((left, right) => compareCandidates(left, right, language));
  const electedCount = candidates.filter(isCandidateElected).length;
  const events = buildElectionEvents(election ? [election] : [], race ? [race] : []);
  const event = getElectionEventForRace(events, race);
  const backPath = event ? electionEventPath(event.key) : electionsPath();

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

  return (
    <AppShell>
      <div className="space-y-4">
        <PixelFrame
          title={t('race.detailTitle')}
          action={<Link to={backPath} className="text-[11px] uppercase tracking-[0.22em] text-accent">{t('race.backOverview')}</Link>}
        >
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.34fr)]">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.22em] text-accent">{race.voting_date ?? election?.voting_date ?? t('race.voteDatePending')}</p>
              <h1 className="mt-2 font-display text-4xl text-white">{race.title}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {event ? translateElectionEventTitle(event, t) : election?.name ?? race.election_name} · {translateRaceCategory(category.key, t)} · {region.label}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">{translateRaceType(race.race_type, t)}</span>
                <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">{translateRaceStatus(race.status, t)}</span>
                {election ? <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">{translateElectionStatus(election.status, t)}</span> : null}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <HudStatCard label={t('race.candidates')} value={<span className="font-display text-xl text-white">{candidates.length}</span>} />
              <HudStatCard label={t('race.elected')} value={<span className="font-display text-xl text-signal">{electedCount}</span>} />
              <HudStatCard label={t('race.region')} value={<span className="font-display text-xl text-white">{region.label}</span>} />
            </div>
          </section>
        </PixelFrame>

        <SectionPanel title={candidates.length > 0 ? t('race.listTitle') : t('race.listFallbackTitle')} eyebrow={t('race.roster')}>
          {candidates.length > 0 ? (
            <div className="overflow-hidden pixel-corners border border-line/70">
              <div className="grid gap-3 border-b border-line/70 bg-panelAlt/55 px-4 py-2 text-xs uppercase tracking-[0.16em] text-slate-500 lg:grid-cols-[72px_minmax(150px,1fr)_minmax(120px,0.55fr)_96px_100px_96px]">
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
                  const theme = partyTheme[toPartyThemeKey(partyLabel)];
                  const rowContent = (
                    <>
                      <p className="text-sm text-slate-300">{candidate.candidate_no ?? '—'}</p>
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
                  const rowClassName = 'grid gap-3 px-4 py-3 lg:grid-cols-[72px_minmax(150px,1fr)_minmax(120px,0.55fr)_96px_100px_96px]';

                  return candidate.person_id ? (
                    <Link
                      key={candidate.candidate_id}
                      to={personPath(candidate.person_id)}
                      className={`${rowClassName} transition hover:bg-accent/8 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/35`}
                    >
                      {rowContent}
                    </Link>
                  ) : (
                    <div key={candidate.candidate_id} className={rowClassName}>{rowContent}</div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm leading-6 text-slate-300">
              <p>{t('race.emptyCandidates')}</p>
            </div>
          )}
        </SectionPanel>

        <SectionPanel title={t('race.sources')} eyebrow={t('race.publicData')}>
          <div className="grid gap-3 text-sm leading-6 text-slate-300 md:grid-cols-2">
            <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('race.electionData')}</p>
              <p className="mt-2">{election?.source_name ?? race.source_name ?? t('race.publicElectionData')}</p>
              {election?.source_url ? <a href={election.source_url} className="mt-2 inline-block text-xs text-accent hover:text-white">{t('race.viewElectionSource')}</a> : null}
            </div>
            <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('race.raceData')}</p>
              <p className="mt-2">{race.source_name ?? t('race.publicRaceData')}</p>
              {race.source_url ? <a href={race.source_url} className="mt-2 inline-block text-xs text-accent hover:text-white">{t('race.viewRaceSource')}</a> : null}
            </div>
          </div>
        </SectionPanel>
      </div>
    </AppShell>
  );
}
