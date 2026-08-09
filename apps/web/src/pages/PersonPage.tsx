import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { PersonFeedbackPanel } from '../components/PersonFeedbackPanel';
import { SectionPanel } from '../components/SectionPanel';
import { pickDefaultCandidateSprite } from '../data/defaultCharacterAssets';
import { translateCandidacyStatus, translateElectionResult } from '../data/electionI18n';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import { refreshConfiguredPublicDataProvider } from '../lib/publicDataProviderFactory';
import { getCandidateElectionLabel, getPersonDisplayPosition, normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { educationProfileItems, experienceProfileItems } from '../lib/profileResume';
import { peoplePath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicCandidate, PublicPersonClaim, PublicPersonPartyAffiliation, PublicPersonTimelineItem } from '../types/publicViews';

const genderLabels: Record<'male' | 'female' | 'unknown', TranslationKey> = {
  male: 'person.gender.male',
  female: 'person.gender.female',
  unknown: 'person.gender.unknown',
};

const timelineCategoryLabels: Record<PublicPersonTimelineItem['category'], TranslationKey> = {
  office: 'person.claim.office',
  candidacy: 'person.claim.candidacy',
  party: 'person.claim.party',
  experience: 'person.claim.experience',
};

const timelineStatusLabels: Record<PublicPersonTimelineItem['status'], TranslationKey> = {
  current: 'person.timeline.status.current',
  past: 'person.timeline.status.past',
  candidate: 'person.timeline.status.candidate',
  unknown: 'person.timeline.status.record',
};

const partyRoleContextLabels: Record<PublicPersonPartyAffiliation['role_context'], TranslationKey> = {
  candidate: 'person.partyRole.candidate',
  officeholder: 'person.partyRole.officeholder',
  party_officer: 'person.partyRole.partyOfficer',
  self_declared: 'person.partyRole.selfDeclared',
  wiki_record: 'person.partyRole.wikiRecord',
  official_record: 'person.partyRole.officialRecord',
  other: 'person.partyRole.other',
};

const claimTypeLabels: Record<PublicPersonClaim['claim_type'], TranslationKey> = {
  name: 'person.claim.name',
  alias: 'person.claim.alias',
  gender: 'person.claim.gender',
  birth_date: 'person.claim.birthDate',
  party: 'person.claim.party',
  party_affiliation: 'person.claim.partyAffiliation',
  position: 'person.claim.position',
  office: 'person.claim.office',
  candidacy: 'person.claim.candidacy',
  district: 'person.claim.district',
  education: 'person.claim.education',
  experience: 'person.claim.experience',
  platform: 'person.claim.platform',
  finance_summary: 'person.claim.finance',
  legal_case: 'person.claim.legal',
  family_relation: 'person.claim.family',
  media: 'person.claim.media',
  external_id: 'person.claim.externalId',
  other: 'person.claim.other',
};

function formatUpdatedAt(value: string | null | undefined, locale: string, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

type SourceRecord = {
  source_name: string | null;
  source_url: string | null;
};

function collectProfileSources(fallbackName: string, ...groups: SourceRecord[][]) {
  const sources = new Map<string, { name: string; url: string }>();
  const sourceUrls = new Set<string>();
  groups.flat().forEach((record) => {
    if (!record.source_url) return;
    const name = record.source_name?.trim() || fallbackName;
    const url = record.source_url.trim();
    const key = name.toLowerCase();
    if (!url || sources.has(key) || sourceUrls.has(url)) return;
    sources.set(key, { name, url });
    sourceUrls.add(url);
  });
  return Array.from(sources.values()).slice(0, 12);
}

function claimJsonString(claim: PublicPersonClaim, key: string) {
  const value = claim.claim_json[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function platformTextForClaim(claim: PublicPersonClaim) {
  return claimJsonString(claim, 'platformText') ?? claim.claim_value?.trim() ?? null;
}

function formatVoteCount(value: number | null, locale: string) {
  return value === null ? null : value.toLocaleString(locale);
}

function formatVoteRate(value: number | null) {
  if (value === null) return null;
  const percentage = value > 1 ? value : value * 100;
  return percentage.toFixed(2).replace(/\.00$/, '') + '%';
}

function candidateDetailRows(candidate: PublicCandidate, t: ReturnType<typeof useI18n>['t'], locale: string) {
  const rows: Array<[string, string]> = [];
  const voteCount = formatVoteCount(candidate.vote_count, locale);
  const voteRate = formatVoteRate(candidate.vote_rate);

  if (candidate.region_name) rows.push([t('person.region'), candidate.region_name]);
  rows.push([t('person.party'), normalizePartyLabel(candidate.party)]);
  if (candidate.election_result === 'elected' || candidate.election_result === 'not_elected') {
    rows.push([t('person.electionResult'), translateElectionResult(candidate.election_result, t)]);
  }
  if (candidate.candidate_no !== null) rows.push([t('race.number'), String(candidate.candidate_no)]);
  if (voteCount) rows.push([t('race.votes'), voteCount]);
  if (voteRate) rows.push([t('race.voteRate'), voteRate]);
  return rows;
}

function sensitivePublicClaims(claims: PublicPersonClaim[]) {
  return claims.filter((claim) => claim.review_score >= 70 && ['A', 'B'].includes(claim.confidence_level));
}

function EmptyInfo({ children }: { children: string }) {
  return (
    <div className="pixel-corners border border-line/70 bg-bg/35 px-4 py-5 text-sm text-slate-300">
      {children}
    </div>
  );
}

function visibleProfileClaims(claims: PublicPersonClaim[]) {
  const seen = new Set<string>();
  const sectionClaimTypes: PublicPersonClaim['claim_type'][] = [
    'alias',
    'gender',
    'birth_date',
    'party',
    'party_affiliation',
    'position',
    'office',
    'candidacy',
    'district',
    'education',
    'experience',
    'platform',
    'finance_summary',
    'legal_case',
    'family_relation',
  ];

  return claims
    .filter((claim) => !['name', 'external_id', ...sectionClaimTypes].includes(claim.claim_type))
    .filter((claim) => Boolean(claim.claim_value?.trim()))
    .filter((claim) => {
      const key = `${claim.claim_type}:${claim.claim_value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function claimsByType(claims: PublicPersonClaim[], claimType: PublicPersonClaim['claim_type']) {
  return claims.filter((claim) => claim.claim_type === claimType);
}

function ClaimCard({ claim }: { claim: PublicPersonClaim }) {
  const { t } = useI18n();

  return (
    <article className="pixel-corners border border-line/70 bg-bg/35 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
        {t(claimTypeLabels[claim.claim_type])}
      </p>
      <h3 className="mt-2 text-sm font-semibold text-white">{claim.claim_value}</h3>
      {claim.claim_type === 'legal_case' && claim.source_url ? (
        <a
          href={claim.source_url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-xs text-accent hover:text-white"
        >
          {claim.source_name?.trim() || t('person.publicSource')} ↗
        </a>
      ) : null}
    </article>
  );
}

function TimelineList({ items }: { items: PublicPersonTimelineItem[] }) {
  const { t } = useI18n();

  if (items.length === 0) {
    return <EmptyInfo>{t('person.timeline.empty')}</EmptyInfo>;
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="grid gap-3 sm:grid-cols-[76px_minmax(0,1fr)]">
          <div className="text-sm font-semibold text-signal">{item.year ?? item.date ?? '—'}</div>
          <article className="pixel-corners border border-line/70 bg-bg/35 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="pixel-corners border border-line/70 px-2 py-1">{t(timelineCategoryLabels[item.category])}</span>
              {item.status !== 'unknown' ? <span>{t(timelineStatusLabels[item.status])}</span> : null}
            </div>
            <h3 className="mt-2 text-sm font-semibold text-white">{item.label}</h3>
            {item.detail ? <p className="mt-2 text-sm text-slate-400">{item.detail}</p> : null}
          </article>
        </li>
      ))}
    </ol>
  );
}

function PartyAffiliationList({ affiliations, currentParty }: { affiliations: PublicPersonPartyAffiliation[]; currentParty: string | null }) {
  const { t } = useI18n();

  if (affiliations.length === 0) {
    return <EmptyInfo>{t('person.affiliation.empty')}</EmptyInfo>;
  }

  const normalizedCurrentParty = currentParty ? normalizePartyLabel(currentParty) : null;
  const inferredCurrentAffiliationId = affiliations.some((affiliation) => affiliation.is_current)
    ? null
    : affiliations.find((affiliation) => normalizePartyLabel(affiliation.party_name) === normalizedCurrentParty)?.affiliation_id ?? null;
  const isCurrentAffiliation = (affiliation: PublicPersonPartyAffiliation) => (
    affiliation.is_current || affiliation.affiliation_id === inferredCurrentAffiliationId
  );

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {affiliations.map((affiliation) => (
        <article key={affiliation.affiliation_id} className="pixel-corners border border-line/70 bg-bg/35 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{isCurrentAffiliation(affiliation) ? t('person.affiliation.current') : t('person.affiliation.past')}</p>
              <h3 className="mt-2 text-sm font-semibold text-white">{normalizePartyLabel(affiliation.party_name)}</h3>
            </div>
            <span className={isCurrentAffiliation(affiliation) ? 'text-xs text-signal' : 'text-xs text-slate-400'}>
              {isCurrentAffiliation(affiliation) ? t('person.affiliation.belongs') : t('person.affiliation.formerly')}
            </span>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            {affiliation.observed_date || affiliation.observed_year ? (
              <div className="flex justify-between gap-3"><dt className="text-slate-500">{t('person.affiliation.observed')}</dt><dd className="text-right text-slate-200">{affiliation.observed_date ?? affiliation.observed_year}</dd></div>
            ) : null}
            <div className="flex justify-between gap-3"><dt className="text-slate-500">{t('person.affiliation.type')}</dt><dd className="text-right text-slate-200">{t(partyRoleContextLabels[affiliation.role_context])}</dd></div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function PartyOfficeList({ affiliations }: { affiliations: PublicPersonPartyAffiliation[] }) {
  const { t } = useI18n();

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {affiliations.map((affiliation) => (
        <article key={affiliation.affiliation_id} className="pixel-corners border border-accent/45 bg-accent/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-accent">{affiliation.organization_unit ?? normalizePartyLabel(affiliation.party_name)}</p>
          <h3 className="mt-2 text-base font-semibold text-white">{affiliation.role_title ?? t('person.partyOffice')}</h3>
          <p className="mt-2 text-sm text-slate-300">{normalizePartyLabel(affiliation.party_name)}</p>
          {affiliation.start_date ? (
            <p className="mt-3 text-xs text-slate-500">{t('person.affiliation.start')} {affiliation.start_date}</p>
          ) : affiliation.observed_date ? (
            <p className="mt-3 text-xs text-slate-500">{t('person.affiliation.observed')} {affiliation.observed_date}</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function ClaimGrid({ claims }: { claims: PublicPersonClaim[] }) {
  return (
    <div className="grid gap-3">
      {claims.map((claim) => (
        <ClaimCard key={claim.claim_id} claim={claim} />
      ))}
    </div>
  );
}

function PlatformClaimCard({ claim }: { claim: PublicPersonClaim }) {
  const { t } = useI18n();
  const platformText = platformTextForClaim(claim);

  return (
    <article className="pixel-corners border border-line/70 bg-bg/35 p-4">
      <h3 className="text-sm font-semibold text-white">{t('person.publicPlatform')}</h3>
      <div className="mt-3 max-h-72 overflow-auto whitespace-pre-line pr-2 text-sm leading-6 text-slate-200">
        {platformText ?? t('person.noContent')}
      </div>
    </article>
  );
}

export function PersonPage() {
  const { language, t } = useI18n();
  const { personId } = useParams();
  const safePersonId = personId ?? '';
  const [loadedPersonId, setLoadedPersonId] = useState<string | null>(null);
  const [failedPersonId, setFailedPersonId] = useState<string | null>(null);
  const loading = loadedPersonId !== safePersonId;

  useEffect(() => {
    let active = true;
    setFailedPersonId(null);

    if (!safePersonId) {
      setLoadedPersonId(safePersonId);
      return () => {
        active = false;
      };
    }

    void refreshConfiguredPublicDataProvider()
      .then(() => publicDataProvider.loadPersonProfiles([safePersonId]))
      .catch((error: unknown) => {
        if (!active) return;
        setFailedPersonId(safePersonId);
        if (import.meta.env.DEV) console.warn('Failed to load person profile', error);
      })
      .finally(() => {
        if (active) setLoadedPersonId(safePersonId);
      });

    return () => {
      active = false;
    };
  }, [safePersonId]);

  const profile = loading ? null : publicDataProvider.getPersonProfile(safePersonId);
  const person = profile?.person ?? null;
  const partyOffices = profile?.party_affiliations.filter((affiliation) => affiliation.role_context === 'party_officer' && affiliation.is_current) ?? [];
  const partyAffiliations = profile?.party_affiliations.filter((affiliation) => affiliation.role_context !== 'party_officer') ?? [];
  const theme = partyTheme[toPartyThemeKey(person?.party)];
  const publicClaims = profile ? visibleProfileClaims(profile.public_claims) : [];
  const birthDateClaim = profile ? claimsByType(profile.public_claims, 'birth_date')[0] ?? null : null;
  const platformClaims = profile ? claimsByType(profile.public_claims, 'platform') : [];
  const financeClaims = profile ? claimsByType(profile.public_claims, 'finance_summary') : [];
  const legalClaims = profile ? sensitivePublicClaims(claimsByType(profile.public_claims, 'legal_case')) : [];
  const familyClaims = profile ? sensitivePublicClaims(claimsByType(profile.public_claims, 'family_relation')) : [];
  const displayPosition = person ? getPersonDisplayPosition(person) : t('person.publicRecord');
  const profilePosition = person ? getPersonDisplayPosition(person, t('person.toBeAdded')) : t('person.toBeAdded');
  const educationItems = person ? educationProfileItems(person.education) : [];
  const experienceItems = person ? experienceProfileItems(person.experience, displayPosition) : [];
  const profileSources = profile
    ? collectProfileSources(t('person.publicSource'), profile.candidate_records, profile.party_affiliations, profile.public_claims)
    : [];
  const identityRecords = profile
    ? profile.identity_records.filter((identity, index, records) => {
        const key = [identity.position, identity.role_label, identity.party, identity.district, identity.status_label].join(':');
        return records.findIndex((record) => (
          [record.position, record.role_label, record.party, record.district, record.status_label].join(':') === key
        )) === index;
      })
    : [];
  const basicFacts: Array<[string, string]> = person
    ? [
        person.alias ? [t('person.alias'), person.alias] : null,
        person.gender && person.gender !== 'unknown' ? [t('person.gender'), t(genderLabels[person.gender])] : null,
        birthDateClaim?.claim_value ? [t('person.birthDate'), birthDateClaim.claim_value] : null,
        [t('person.currentPosition'), profilePosition],
        person.region_name || person.district ? [t('person.location'), person.region_name ?? person.district ?? ''] : null,
      ].filter((fact): fact is [string, string] => fact !== null)
    : [];
  const supplementarySectionCount = [
    platformClaims.length,
    financeClaims.length,
    legalClaims.length,
    familyClaims.length,
  ].filter(Boolean).length;

  return (
    <AppShell>
      <PixelFrame
        title={t('person.frameTitle')}
        action={
          <Link to={peoplePath()} className="text-[11px] uppercase tracking-[0.22em] text-accent hover:text-white">
            {t('person.back')}
          </Link>
        }
      >
        {person && profile ? (
          <div className="space-y-4">
            <section className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="pixel-corners flex min-h-[220px] items-end justify-center border border-line/70 bg-bg/40 p-4">
                <img
                  src={person.primary_photo_thumbnail_url ?? person.primary_photo_url ?? pickDefaultCandidateSprite(person.name, person.gender)}
                  alt={person.primary_photo_url ? person.name : ''}
                  className="max-h-[190px] w-auto object-contain object-bottom [image-rendering:pixelated]"
                />
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{person.role_label}</p>
                <h2 className="mt-2 font-display text-4xl text-white">{person.name}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">{displayPosition}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <HudStatCard
                    label={t('person.party')}
                    value={
                      <span
                        className="pixel-corners inline-block border px-2 py-1 text-sm"
                        style={{ borderColor: theme.accent, backgroundColor: `${theme.primary}33`, color: theme.text }}
                      >
                        {normalizePartyLabel(person.party)}
                      </span>
                    }
                  />
                  <HudStatCard label={t('person.region')} value={person.region_name ?? person.district ?? t('person.unspecified')} />
                  <HudStatCard label={t('person.status')} value={<span className={person.status === 'current' ? 'text-signal' : 'text-white'}>{t(person.status === 'current' ? 'people.status.current' : person.status === 'candidate' ? 'people.status.candidate' : person.status === 'former' ? 'people.status.former' : 'people.status.other')}</span>} />
                  <HudStatCard label={t('person.updated')} value={formatUpdatedAt(person.updated_at, language, t('person.awaitingSync'))} />
                </div>
              </div>
            </section>

            <PersonFeedbackPanel personId={person.person_id} personName={person.name} />

            <SectionPanel title={t('person.basicTitle')} eyebrow={t('person.basicEyebrow')}>
              <dl className="grid gap-3 sm:grid-cols-2">
                {basicFacts.map(([label, value]) => (
                  <div key={label} className="pixel-corners border border-line/70 bg-bg/35 p-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</dt>
                    <dd className="mt-2 text-sm text-white">{value}</dd>
                  </div>
                ))}
              </dl>
            </SectionPanel>

            {identityRecords.length > 1 ? (
              <SectionPanel title={t('person.identitiesTitle')} eyebrow={t('person.identitiesEyebrow')}>
                <div className="grid gap-3 md:grid-cols-2">
                  {identityRecords.map((identity) => (
                    <article key={identity.person_id} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{identity.status_label}</p>
                      <h3 className="mt-2 font-display text-lg text-white">{identity.position ?? identity.role_label}</h3>
                      <p className="mt-2 text-sm text-slate-400">
                        {[normalizePartyLabel(identity.party), identity.district].filter(Boolean).join(' · ') || t('person.publicRecord')}
                      </p>
                    </article>
                  ))}
                </div>
              </SectionPanel>
            ) : null}

            <SectionPanel title={t('person.candidaciesTitle')} eyebrow={t('person.candidaciesEyebrow')}>
              {profile.candidate_records.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {profile.candidate_records.map((candidate) => (
                    <article key={candidate.candidate_id} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{getCandidateElectionLabel(candidate)}</p>
                          <h3 className="mt-2 font-display text-lg text-white">{candidate.race_title}</h3>
                        </div>
                        <span className="text-xs text-signal">
                          {t('person.candidacyStatusValue', { status: translateCandidacyStatus(candidate.candidacy_status, t) })}
                        </span>
                      </div>
                      <dl className="mt-3 space-y-2 text-sm">
                        {candidateDetailRows(candidate, t, language).map(([label, value]) => (
                          <div key={label} className="flex justify-between gap-3">
                            <dt className="text-slate-500">{label}</dt>
                            <dd className="text-right text-slate-200">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyInfo>{t('person.noCandidacies')}</EmptyInfo>
              )}
            </SectionPanel>

            {partyOffices.length > 0 ? (
              <SectionPanel title={t('person.partyOfficesTitle')} eyebrow={t('person.partyOfficesEyebrow')}>
                <PartyOfficeList affiliations={partyOffices} />
              </SectionPanel>
            ) : null}

            {profile.timeline_records.length > 0 || partyAffiliations.length > 0 ? (
              <div className={
                profile.timeline_records.length > 0 && partyAffiliations.length > 0
                  ? 'grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]'
                  : 'grid gap-4'
              }>
                {profile.timeline_records.length > 0 ? (
                  <SectionPanel title={t('person.timelineTitle')} eyebrow={t('person.timelineEyebrow')}>
                    <TimelineList items={profile.timeline_records} />
                  </SectionPanel>
                ) : null}
                {partyAffiliations.length > 0 ? (
                  <SectionPanel title={t('person.affiliationsTitle')} eyebrow={t('person.affiliationsEyebrow')}>
                    <PartyAffiliationList affiliations={partyAffiliations} currentParty={person.party} />
                  </SectionPanel>
                ) : null}
              </div>
            ) : null}

            {educationItems.length > 0 || experienceItems.length > 0 ? (
              <SectionPanel title={t('person.resumeTitle')} eyebrow={t('person.resumeEyebrow')}>
                <div className={
                  educationItems.length > 0 && experienceItems.length > 0
                    ? 'grid gap-4 lg:grid-cols-2'
                    : 'grid gap-4'
                }>
                  {educationItems.length > 0 ? (
                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-white">{t('person.education')}</h3>
                      <ul className="space-y-2 text-sm text-slate-300">
                        {educationItems.map((item) => (
                          <li key={item} className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {experienceItems.length > 0 ? (
                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-white">{t('person.experience')}</h3>
                      <ul className="space-y-2 text-sm text-slate-300">
                        {experienceItems.map((item) => (
                          <li key={item} className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </SectionPanel>
            ) : null}

            {supplementarySectionCount > 0 ? (
              <div className={supplementarySectionCount > 1 ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4'}>
                {platformClaims.length > 0 ? (
                  <SectionPanel title={t('person.platformTitle')} eyebrow={t('person.platformEyebrow')}>
                    <div className="grid gap-3">
                      {platformClaims.map((claim) => (
                        <PlatformClaimCard key={claim.claim_id} claim={claim} />
                      ))}
                    </div>
                  </SectionPanel>
                ) : null}
                {financeClaims.length > 0 ? (
                  <SectionPanel title={t('person.financeTitle')} eyebrow={t('person.financeEyebrow')}>
                    <ClaimGrid claims={financeClaims} />
                  </SectionPanel>
                ) : null}
                {legalClaims.length > 0 ? (
                  <SectionPanel title={t('person.legalTitle')} eyebrow={t('person.reviewedEyebrow')}>
                    <ClaimGrid claims={legalClaims} />
                  </SectionPanel>
                ) : null}
                {familyClaims.length > 0 ? (
                  <SectionPanel title={t('person.familyTitle')} eyebrow={t('person.reviewedEyebrow')}>
                    <ClaimGrid claims={familyClaims} />
                  </SectionPanel>
                ) : null}
              </div>
            ) : null}

            {publicClaims.length > 0 ? (
              <SectionPanel title={t('person.leadsTitle')} eyebrow={t('person.leadsEyebrow')}>
                <div className="grid gap-3 md:grid-cols-2">
                  {publicClaims.map((claim) => (
                    <ClaimCard key={claim.claim_id} claim={claim} />
                  ))}
                </div>
              </SectionPanel>
            ) : null}

            {profileSources.length > 0 ? (
              <SectionPanel title={t('person.sourcesTitle')} eyebrow={t('person.sourcesEyebrow')}>
                <ul className="grid gap-2 md:grid-cols-2">
                  {profileSources.map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="pixel-corners block border border-line/70 bg-bg/35 px-3 py-2 text-sm text-accent hover:text-white"
                      >
                        {source.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </SectionPanel>
            ) : null}
          </div>
        ) : loading ? (
          <div className="pixel-corners border border-line/70 bg-bg/35 px-4 py-8 text-center text-sm text-slate-300">
            {t('person.loading')}
          </div>
        ) : (
          <div className="pixel-corners border border-line/70 bg-bg/35 px-4 py-8 text-center text-sm text-slate-300">
            {failedPersonId === safePersonId ? t('person.loadError') : t('person.notFound')}
          </div>
        )}
      </PixelFrame>
    </AppShell>
  );
}
