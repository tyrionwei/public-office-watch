import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Translate } from '../i18n';
import { toPartyThemeKey } from '../lib/personData';
import { personPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicCandidate, PublicPartyListRaceResult } from '../types/publicViews';
import { SectionPanel } from './SectionPanel';

type PartyListRacePanelProps = {
  results: PublicPartyListRaceResult[];
  candidates: PublicCandidate[];
  language: string;
  t: Translate;
};

function candidateOrder(candidate: PublicCandidate) {
  const value = Number.parseInt(candidate.candidate_no ?? '', 10);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatPercent(value: number | null, locale: string) {
  if (value === null) return '—';
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value)}%`;
}

function formatCurrency(value: number | null, locale: string) {
  if (value === null) return null;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function PartyListRacePanel({ results, candidates, language, t }: PartyListRacePanelProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const sortedResults = useMemo(
    () => results.slice().sort((left, right) => left.party_ballot_number - right.party_ballot_number),
    [results],
  );
  const resultBySlug = useMemo(
    () => new Map(sortedResults.map((result) => [result.party_slug, result])),
    [sortedResults],
  );
  const selectedSlugs = Array.from(new Set((searchParams.get('compare') ?? '').split(',').filter(Boolean)))
    .filter((slug) => resultBySlug.has(slug))
    .slice(0, 4);
  const selectedResults = selectedSlugs
    .map((slug) => resultBySlug.get(slug))
    .filter((result): result is PublicPartyListRaceResult => Boolean(result));
  const openParty = resultBySlug.get(searchParams.get('party') ?? '') ?? null;

  function candidatesFor(result: PublicPartyListRaceResult) {
    return candidates
      .filter((candidate) => candidate.party === result.candidate_party_name)
      .slice()
      .sort((left, right) => {
        const orderDifference = candidateOrder(left) - candidateOrder(right);
        return orderDifference !== 0 ? orderDifference : left.person_name.localeCompare(right.person_name, language);
      });
  }

  function updateParty(slug: string | null) {
    const next = new URLSearchParams(searchParams);
    if (slug) next.set('party', slug);
    else next.delete('party');
    setSearchParams(next, { replace: true });
  }

  function updateComparison(slug: string, selected: boolean) {
    const nextSlugs = selected
      ? [...selectedSlugs, slug].slice(0, 4)
      : selectedSlugs.filter((selectedSlug) => selectedSlug !== slug);
    const next = new URLSearchParams(searchParams);
    if (nextSlugs.length > 0) next.set('compare', nextSlugs.join(','));
    else next.delete('compare');
    setSearchParams(next, { replace: true });
  }

  return (
    <>
      <SectionPanel title={t('race.partyListResultsTitle')} eyebrow={t('race.partyListEyebrow')}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sortedResults.map((result) => {
            const theme = partyTheme[toPartyThemeKey(result.party_name)];
            const selected = selectedSlugs.includes(result.party_slug);
            const comparisonDisabled = !selected && selectedSlugs.length >= 4;
            const isOpen = openParty?.party_slug === result.party_slug;

            return (
              <article
                key={result.result_id}
                className="pixel-corners border bg-panelAlt/45 p-4"
                style={{ borderColor: `${theme.accent}88` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('race.number')} {result.party_ballot_number}</p>
                    <h2 className="mt-2 font-display text-2xl text-white">{result.party_name}</h2>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-400" title={comparisonDisabled ? t('race.compareLimit') : t('race.compareSelect')}>
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={comparisonDisabled}
                      onChange={(event) => updateComparison(result.party_slug, event.target.checked)}
                      className="h-4 w-4 accent-cyan-300 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={`${t('race.compareSelect')} ${result.party_name}`}
                    />
                    {t('race.compareSelect')}
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('race.votes')}</p>
                    <p className="mt-1 font-display text-lg text-white">{formatNumber(result.vote_count, language)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('race.voteRate')}</p>
                    <p className="mt-1 font-display text-lg text-accent">{formatPercent(result.vote_rate, language)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('race.partyListSeats')}</p>
                    <p className="mt-1 font-display text-lg text-signal">{result.allocated_seats}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className={result.passed_threshold ? 'border border-signal/50 bg-signal/10 px-2 py-1 text-signal' : 'border border-line/70 bg-bg/35 px-2 py-1 text-slate-400'}>
                    {t(result.passed_threshold ? 'race.partyListPassedThreshold' : 'race.partyListBelowThreshold')}
                  </span>
                  <span className="border border-line/70 bg-bg/35 px-2 py-1 text-slate-300">
                    {t('race.partyListCandidatesUnit', { count: result.candidate_count })}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => updateParty(isOpen ? null : result.party_slug)}
                  className="mt-4 text-xs uppercase tracking-[0.16em] text-accent hover:text-white"
                >
                  {t(isOpen ? 'race.partyListHideRoster' : 'race.partyListViewRoster')}
                </button>
              </article>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-line/50 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-slate-400">{t('race.partyListCompareHint')}</p>
          <p className={selectedSlugs.length >= 2 ? 'text-signal' : 'text-accent'}>
            {t('race.partyListCompareSelected', { count: selectedSlugs.length })}
          </p>
        </div>
      </SectionPanel>

      {openParty ? (
        <SectionPanel title={t('race.partyListRosterTitle', { party: openParty.party_name })} eyebrow={t('race.roster')}>
          <div className="overflow-hidden pixel-corners border border-line/70">
            <div className="grid grid-cols-[72px_minmax(160px,1fr)_110px] gap-3 border-b border-line/70 bg-panelAlt/55 px-4 py-2 text-xs uppercase tracking-[0.16em] text-slate-500">
              <span>{t('race.partyListOrder')}</span>
              <span>{t('race.name')}</span>
              <span>{t('race.status')}</span>
            </div>
            <div className="divide-y divide-line/60">
              {candidatesFor(openParty).map((candidate) => (
                <div key={candidate.candidate_id} className="grid grid-cols-[72px_minmax(160px,1fr)_110px] gap-3 px-4 py-3 text-sm">
                  <span className="text-slate-400">{candidate.candidate_no ?? '—'}</span>
                  {candidate.person_id ? (
                    <Link to={personPath(candidate.person_id)} className="font-display text-lg text-white hover:text-accent">
                      {candidate.person_name}
                    </Link>
                  ) : <span className="font-display text-lg text-white">{candidate.person_name}</span>}
                  <span className={candidate.is_elected ? 'text-signal' : 'text-slate-400'}>
                    {candidate.is_elected ? t('race.elected') : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pixel-corners border border-line/70 bg-bg/35 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('race.partyListOfficialPlatform')}</p>
            {openParty.platform_text ? <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-200">{openParty.platform_text}</p> : null}
            <p className="mt-2 text-sm leading-6 text-slate-400">{t('race.partyListPlatformSourceOnly')}</p>
            {openParty.platform_source_url ? (
              <a href={openParty.platform_source_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-accent hover:text-white">
                {t('race.partyListViewPlatform')}
              </a>
            ) : null}
          </div>
        </SectionPanel>
      ) : null}

      {selectedResults.length > 0 ? (
        <SectionPanel title={t('race.partyListCompareTitle')} eyebrow={t('race.compareEyebrow')}>
          {selectedResults.length < 2 ? (
            <p className="text-sm text-slate-300">{t('race.partyListCompareNeedTwo')}</p>
          ) : (
            <div className="overflow-x-auto pixel-corners border border-line/70">
              <div className="min-w-[760px]" style={{ width: `${Math.max(100, selectedResults.length * 26)}%` }}>
                <div className="grid gap-3 border-b border-line/70 bg-panelAlt/55 px-4 py-3" style={{ gridTemplateColumns: `160px repeat(${selectedResults.length}, minmax(170px, 1fr))` }}>
                  <span />
                  {selectedResults.map((result) => <span key={result.result_id} className="font-display text-lg text-white">{result.party_name}</span>)}
                </div>
                {[
                  [t('race.votes'), (result: PublicPartyListRaceResult) => formatNumber(result.vote_count, language)],
                  [t('race.voteRate'), (result: PublicPartyListRaceResult) => formatPercent(result.vote_rate, language)],
                  [t('race.partyListSeats'), (result: PublicPartyListRaceResult) => t('race.partyListSeatsUnit', { count: result.allocated_seats })],
                  [t('race.partyListGender'), (result: PublicPartyListRaceResult) => t('race.partyListGenderSummary', { female: result.female_candidate_count, male: result.male_candidate_count, unknown: result.unknown_gender_candidate_count })],
                  [t('race.partyListElectedRoster'), (result: PublicPartyListRaceResult) => {
                    const elected = candidatesFor(result).filter((candidate) => candidate.is_elected).map((candidate) => candidate.person_name);
                    return elected.length > 0 ? elected.join('、') : t('race.partyListNoElected');
                  }],
                  [t('race.partyListFinance'), (result: PublicPartyListRaceResult) => {
                    const income = formatCurrency(result.finance_income_total, language);
                    const expense = formatCurrency(result.finance_expense_total, language);
                    return income && expense ? t('race.partyListFinanceSummary', { income, expense }) : t('race.partyListFinanceUnavailable');
                  }],
                ].map(([label, render]) => (
                  <div key={String(label)} className="grid gap-3 border-b border-line/60 px-4 py-3 text-sm last:border-b-0" style={{ gridTemplateColumns: `160px repeat(${selectedResults.length}, minmax(170px, 1fr))` }}>
                    <span className="text-xs uppercase tracking-[0.16em] text-slate-500">{String(label)}</span>
                    {selectedResults.map((result) => <span key={result.result_id} className="leading-6 text-slate-200">{(render as (value: PublicPartyListRaceResult) => string)(result)}</span>)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionPanel>
      ) : null}
    </>
  );
}
