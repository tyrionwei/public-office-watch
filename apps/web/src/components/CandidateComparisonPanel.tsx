import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { translateElectionResult } from '../data/electionI18n';
import { useI18n } from '../i18n';
import { platformClaimsForCandidate } from '../lib/candidatePlatform';
import { getPreviousPartyName, normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { buildCandidateComparisonShareUrl, comparisonAnchorId } from '../lib/socialSharing';
import { personPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicCandidate, PublicPersonClaim, PublicPersonProfile } from '../types/publicViews';
import { SectionPanel } from './SectionPanel';
import { ShareButton } from './ShareButton';

type CandidateComparisonPanelProps = {
  candidates: PublicCandidate[];
  profiles: PublicPersonProfile[];
  loading: boolean;
  currentRaceId: string;
  raceTitle: string;
  onRemove: (personId: string) => void;
};

function claimText(claim: PublicPersonClaim) {
  const platformText = claim.claim_json.platformText;
  if (typeof platformText === 'string' && platformText.trim()) return platformText.trim();
  return claim.claim_value?.trim() ?? null;
}

function uniqueValues(values: Array<string | null | undefined>, limit = 5) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const rawValue of values) {
    const value = rawValue?.trim();
    if (!value) continue;
    const key = value.replace(/\s+/g, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
    if (output.length >= limit) break;
  }
  return output;
}

function profileValues(profile: PublicPersonProfile | null, claimType: PublicPersonClaim['claim_type']) {
  if (!profile) return [];
  return uniqueValues(
    profile.public_claims
      .filter((claim) => claim.claim_type === claimType)
      .map(claimText),
  );
}

function profileSources(profile: PublicPersonProfile | null) {
  if (!profile) return [];
  const sources = new Map<string, { name: string; url: string }>();
  [...profile.public_claims, ...profile.candidate_records].forEach((record) => {
    if (!record.source_url) return;
    const name = record.source_name?.trim() || record.source_url;
    if (!sources.has(record.source_url)) sources.set(record.source_url, { name, url: record.source_url });
  });
  return Array.from(sources.values()).slice(0, 5);
}

function TextList({ values, emptyLabel }: { values: string[]; emptyLabel: string }) {
  if (values.length === 0) return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  return (
    <ul className="max-h-48 space-y-2 overflow-y-auto pr-2 text-sm leading-6 text-slate-200">
      {values.map((value) => <li key={value} className="border-l border-line/70 pl-3">{value}</li>)}
    </ul>
  );
}

function ComparisonRow({
  label,
  candidates,
  children,
}: {
  label: string;
  candidates: PublicCandidate[];
  children: (candidate: PublicCandidate) => ReactNode;
}) {
  return (
    <section className="border-t border-line/60 py-4">
      <h4 className="mb-3 text-xs uppercase tracking-[0.16em] text-slate-500">{label}</h4>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${candidates.length}, minmax(240px, 1fr))` }}>
        {candidates.map((candidate) => (
          <div key={candidate.person_id} className="min-w-0 border-l border-line/60 pl-4">
            {children(candidate)}
          </div>
        ))}
      </div>
    </section>
  );
}

export function CandidateComparisonPanel({
  candidates,
  profiles,
  loading,
  currentRaceId,
  raceTitle,
  onRemove,
}: CandidateComparisonPanelProps) {
  const { language, t } = useI18n();
  const profilesByPersonId = new Map(profiles.map((profile) => [profile.person.person_id, profile]));
  const minWidth = Math.max(760, candidates.length * 280);
  const candidateNames = candidates.map((candidate) => candidate.person_name).join(language === 'en' ? ', ' : '、');
  const comparisonImageBody = candidates.map((candidate) => {
    const profile = profilesByPersonId.get(candidate.person_id) ?? null;
    const platform = profile
      ? uniqueValues(platformClaimsForCandidate(profile.public_claims, candidate.candidate_id, currentRaceId).map(claimText), 1)[0]
      : null;
    return `${candidate.person_name}｜${platform ?? t('race.compareNoData')}`;
  }).join('\n');
  const shareUrl = candidates.length >= 2
    ? buildCandidateComparisonShareUrl(
        window.location.origin,
        currentRaceId,
        candidates.map((candidate) => candidate.person_id),
      )
    : null;

  return (
    <div id={comparisonAnchorId} className="scroll-mt-24">
      <SectionPanel
        title={t('race.compareTitle')}
        eyebrow={t('race.compareEyebrow')}
        action={shareUrl ? (
          <ShareButton
            title={t('share.comparisonTitle', { race: raceTitle })}
            text={t('share.comparisonText', { candidates: candidateNames })}
            url={shareUrl}
            imageEyebrow={t('share.comparisonEyebrow')}
            imageBody={comparisonImageBody}
            imageAlt={t('share.comparisonPreviewAlt')}
            imageFileName="candidate-comparison.png"
          />
        ) : null}
      >
      {candidates.length < 2 ? (
        <p className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm text-slate-300">{t('race.compareNeedTwo')}</p>
      ) : loading ? (
        <p className="text-sm text-slate-400">{t('race.compareLoading')}</p>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth }}>
            <div className="grid gap-4 pb-5" style={{ gridTemplateColumns: `repeat(${candidates.length}, minmax(240px, 1fr))` }}>
              {candidates.map((candidate) => {
                const partyLabel = normalizePartyLabel(candidate.party ?? candidate.person_party);
                const previousPartyName = getPreviousPartyName(
                  profilesByPersonId.get(candidate.person_id)?.party_affiliations ?? [],
                  partyLabel,
                  candidate.election_year,
                );
                const theme = partyTheme[toPartyThemeKey(partyLabel)];
                return (
                  <header key={candidate.person_id} className="min-w-0 border-l-2 pl-4" style={{ borderColor: theme.accent }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">{candidate.candidate_no ? `${t('race.number')} ${candidate.candidate_no}` : t('race.number')}</p>
                        <h3 className="mt-1 truncate font-display text-2xl text-white">{candidate.person_name}</h3>
                        <span className="theme-party-chip mt-2 inline-block border px-2 py-1 text-xs" style={{ borderColor: theme.accent, color: theme.text }}>
                          {partyLabel}
                        </span>
                        {previousPartyName ? (
                          <p className="mt-1 truncate text-[11px] text-slate-500">
                            {t('race.previousParty')}: {previousPartyName}
                          </p>
                        ) : null}
                      </div>
                      <button type="button" onClick={() => onRemove(candidate.person_id)} className="shrink-0 text-xs text-slate-500 hover:text-rose-300">
                        {t('race.compareRemove')}
                      </button>
                    </div>
                    <Link to={personPath(candidate.person_id)} className="mt-3 inline-block text-sm text-accent hover:text-white">
                      {t('race.compareOpenPerson')}
                    </Link>
                  </header>
                );
              })}
            </div>

            <ComparisonRow label={t('race.compareCurrentOffice')} candidates={candidates}>
              {(candidate) => {
                const profile = profilesByPersonId.get(candidate.person_id);
                return (
                  <div className="space-y-1 text-sm text-slate-200">
                    <p>{profile?.person.current_office_label ?? profile?.person.display_position_label ?? t('race.compareNoData')}</p>
                    <p className="text-slate-500">{profile?.person.region_name ?? profile?.person.district}</p>
                  </div>
                );
              }}
            </ComparisonRow>

            <ComparisonRow label={t('race.compareEducation')} candidates={candidates}>
              {(candidate) => {
                const profile = profilesByPersonId.get(candidate.person_id) ?? null;
                return <TextList values={uniqueValues([profile?.person.education, ...profileValues(profile, 'education')])} emptyLabel={t('race.compareNoData')} />;
              }}
            </ComparisonRow>

            <ComparisonRow label={t('race.compareExperience')} candidates={candidates}>
              {(candidate) => {
                const profile = profilesByPersonId.get(candidate.person_id) ?? null;
                return <TextList values={uniqueValues([profile?.person.experience, ...profileValues(profile, 'experience')], 6)} emptyLabel={t('race.compareNoData')} />;
              }}
            </ComparisonRow>

            <ComparisonRow label={t('race.compareHistory')} candidates={candidates}>
              {(candidate) => {
                const profile = profilesByPersonId.get(candidate.person_id);
                const history = profile?.candidate_records
                  .filter((record) => record.race_id !== currentRaceId)
                  .slice()
                  .sort((left, right) => (right.election_year ?? 0) - (left.election_year ?? 0))
                  .slice(0, 5) ?? [];
                if (history.length === 0) return <p className="text-sm text-slate-500">{t('race.compareNoData')}</p>;
                return (
                  <div className="divide-y divide-line/40 text-sm">
                    {history.map((record) => (
                      <div key={record.candidate_id} className="py-2 first:pt-0">
                        <p className="text-slate-200">{record.election_year ?? '—'} · {record.race_title}</p>
                        <p className="mt-1 text-xs text-slate-500">{translateElectionResult(record.election_result, t)}</p>
                      </div>
                    ))}
                  </div>
                );
              }}
            </ComparisonRow>

            <ComparisonRow label={t('race.comparePlatform')} candidates={candidates}>
              {(candidate) => {
                const profile = profilesByPersonId.get(candidate.person_id) ?? null;
                const claims = profile
                  ? platformClaimsForCandidate(profile.public_claims, candidate.candidate_id, currentRaceId)
                  : [];
                return <TextList values={uniqueValues(claims.map(claimText))} emptyLabel={t('race.compareNoData')} />;
              }}
            </ComparisonRow>

            <ComparisonRow label={t('race.compareCoverage')} candidates={candidates}>
              {(candidate) => {
                const profile = profilesByPersonId.get(candidate.person_id);
                const statuses = [
                  [t('race.compareExperience'), profile?.experience_status === 'available'],
                  [
                    t('race.comparePlatform'),
                    Boolean(profile && platformClaimsForCandidate(profile.public_claims, candidate.candidate_id, currentRaceId).length > 0),
                  ],
                  [t('person.financeTitle'), Boolean(profile && profile.contribution_status !== 'todo')],
                  [t('person.legalTitle'), profile?.public_claims.some((claim) => claim.claim_type === 'legal_case')],
                ] as const;
                return (
                  <dl className="space-y-2 text-sm">
                    {statuses.map(([label, available]) => (
                      <div key={label} className="flex items-center justify-between gap-3">
                        <dt className="text-slate-400">{label}</dt>
                        <dd className={available ? 'text-signal' : 'text-slate-600'}>{available ? t('race.compareAvailable') : t('race.compareTodo')}</dd>
                      </div>
                    ))}
                  </dl>
                );
              }}
            </ComparisonRow>

            <ComparisonRow label={t('race.compareSources')} candidates={candidates}>
              {(candidate) => {
                const sources = profileSources(profilesByPersonId.get(candidate.person_id) ?? null);
                if (sources.length === 0) return <p className="text-sm text-slate-500">{t('race.compareNoData')}</p>;
                return (
                  <div className="space-y-2 text-sm">
                    {sources.map((source) => (
                      <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block truncate text-accent hover:text-white">
                        {source.name}
                      </a>
                    ))}
                  </div>
                );
              }}
            </ComparisonRow>
          </div>
        </div>
      )}
      </SectionPanel>
    </div>
  );
}
