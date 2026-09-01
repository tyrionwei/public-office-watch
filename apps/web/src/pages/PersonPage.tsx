import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { PersonFeedbackPanel } from '../components/PersonFeedbackPanel';
import { PlatformFulfillmentList } from '../components/PlatformFulfillmentList';
import { SectionPanel } from '../components/SectionPanel';
import {
  pickDefaultCandidateSprite,
  pickPersonCandidateSprite,
  xiezhiMascotSprite,
} from '../data/defaultCharacterAssets';
import { translateCandidacyStatus, translateElectionResult } from '../data/electionI18n';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import { refreshConfiguredPublicDataProvider } from '../lib/publicDataProviderFactory';
import { platformClaimsForCandidate, platformItemsForClaim } from '../lib/candidatePlatform';
import type { FeedbackSectionKey } from '../lib/personFeedback';
import { getCandidateElectionLabel, getPartyChangeAffiliations, getPersonDisplayPosition, normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { educationProfileItems, experienceProfileItems } from '../lib/profileResume';
import { dataGuidancePath, peoplePath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicCandidate, PublicPersonClaim, PublicPersonPartyAffiliation } from '../types/publicViews';

const genderLabels: Record<'male' | 'female' | 'unknown', TranslationKey> = {
  male: 'person.gender.male',
  female: 'person.gender.female',
  unknown: 'person.gender.unknown',
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
  groups.flat().forEach((record) => {
    if (!record.source_url) return;
    const name = record.source_name?.trim() || fallbackName;
    const url = record.source_url.trim();
    if (!url || sources.has(url)) return;
    sources.set(url, { name, url });
  });
  return Array.from(sources.values());
}

function claimJsonString(claim: PublicPersonClaim, key: string) {
  const value = claim.claim_json[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function claimElectionRaceId(claim: PublicPersonClaim) {
  const electionContext = claim.claim_json.electionContext;
  if (!electionContext || typeof electionContext !== 'object' || Array.isArray(electionContext)) return null;
  const raceId = (electionContext as Record<string, unknown>).raceId;
  return typeof raceId === 'string' && raceId.trim() ? raceId.trim() : null;
}

function formatVoteCount(value: number | null, locale: string) {
  return value === null ? null : value.toLocaleString(locale);
}

function formatVoteRate(value: number | null) {
  if (value === null) return null;
  const percentage = value > 1 ? value : value * 100;
  return percentage.toFixed(2).replace(/\.00$/, '') + '%';
}

function candidateDetailRows(
  candidate: PublicCandidate,
  t: ReturnType<typeof useI18n>['t'],
  locale: string,
  replacementElected: boolean,
) {
  const rows: Array<[string, string, string?]> = [];
  const voteCount = formatVoteCount(candidate.vote_count, locale);
  const voteRate = formatVoteRate(candidate.vote_rate);

  if (candidate.region_name) rows.push([t('person.region'), candidate.region_name]);
  rows.push([t('person.party'), normalizePartyLabel(candidate.party)]);
  if (candidate.election_result === 'elected' || candidate.election_result === 'not_elected') {
    rows.push([
      t('person.electionResult'),
      translateElectionResult(candidate.election_result, t),
      candidate.election_result === 'elected'
        ? 'border border-emerald-400/50 bg-emerald-400/10 px-2 py-0.5 font-semibold text-emerald-200'
        : 'border border-rose-400/45 bg-rose-400/10 px-2 py-0.5 font-semibold text-rose-200',
    ]);
  }
  if (replacementElected) {
    rows.push([t('person.laterElectionStatus'), t('person.replacementElected')]);
  }
  if (candidate.candidate_no !== null) rows.push([t('race.number'), String(candidate.candidate_no)]);
  if (voteCount) rows.push([t('race.votes'), voteCount]);
  if (voteRate) rows.push([t('race.voteRate'), voteRate]);
  return rows;
}

function sensitivePublicClaims(claims: PublicPersonClaim[]) {
  return claims.filter((claim) => claim.review_score >= 70 && ['A', 'B'].includes(claim.confidence_level));
}
type DataStateKind = 'notApplicable' | 'uncollected' | 'noPublicData' | 'pending' | 'loadError';

const dataStateLabelKeys: Record<DataStateKind, TranslationKey> = {
  notApplicable: 'person.dataState.notApplicable',
  uncollected: 'person.dataState.uncollected',
  noPublicData: 'person.dataState.noPublicData',
  pending: 'person.dataState.pending',
  loadError: 'person.dataState.loadError',
};

const dataStateStyles: Record<DataStateKind, string> = {
  notApplicable: 'border-slate-500/45 bg-slate-500/8 text-slate-300',
  uncollected: 'border-amber-300/40 bg-amber-300/8 text-amber-100',
  noPublicData: 'border-cyan-300/40 bg-cyan-300/8 text-cyan-100',
  pending: 'border-violet-300/45 bg-violet-300/10 text-violet-100',
  loadError: 'border-rose-300/55 bg-rose-400/10 text-rose-100',
};

function DataStateNotice({ kind, children }: { kind: DataStateKind; children: string }) {
  const { t } = useI18n();
  return (
    <div
      data-data-state={kind}
      role={kind === 'loadError' ? 'alert' : undefined}
      className={`pixel-corners border px-4 py-4 text-sm ${dataStateStyles[kind]}`}
    >
      <span className="mr-2 inline-block border border-current/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
        {t(dataStateLabelKeys[kind])}
      </span>
      <span className="leading-6">{children}</span>
    </div>
  );
}

function latestUpdatedValue(values: Array<string | null | undefined>) {
  let latestValue: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;
  values.forEach((value) => {
    if (!value) return;
    const time = new Date(value).getTime();
    if (Number.isNaN(time) || time <= latestTime) return;
    latestTime = time;
    latestValue = value;
  });
  return latestValue;
}

const sensitiveStatusLabelKeys: Record<string, TranslationKey> = {
  criminal_judgment_final: 'person.source.status.finalJudgment',
  historical_criminal_judgment_final: 'person.source.status.finalJudgment',
  criminal_judgment_non_final: 'person.source.status.nonFinalJudgment',
  criminal_judgment_first_instance: 'person.source.status.nonFinalJudgment',
  criminal_judgment_appellate_non_final: 'person.source.status.nonFinalJudgment',
  criminal_judgment: 'person.source.status.judgment',
  election_recount_pending: 'person.source.status.recountPending',
  legal_record_unspecified: 'person.source.status.unspecifiedLegal',
};

function sensitiveClaimStatusKey(claim: PublicPersonClaim): TranslationKey {
  if (claim.claim_type === 'family_relation') return 'person.source.status.verifiedPublic';
  const caseStage = claimJsonString(claim, 'caseStage');
  if (!caseStage) return 'person.source.status.verifiedPublic';
  return sensitiveStatusLabelKeys[caseStage] ?? 'person.source.status.verifiedPublic';
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

function ClaimCard({
  claim,
  correctionSection,
  onRequestCorrection,
}: {
  claim: PublicPersonClaim;
  correctionSection?: Extract<FeedbackSectionKey, 'finance' | 'legal' | 'family'>;
  onRequestCorrection?: (section: FeedbackSectionKey) => void;
}) {
  const { language, t } = useI18n();
  const showSourceDetails = Boolean(correctionSection);
  const documentStatus = correctionSection === 'legal' || correctionSection === 'family'
    ? t(sensitiveClaimStatusKey(claim))
    : t('person.source.status.verifiedPublic');

  return (
    <article className="pixel-corners border border-line/70 bg-bg/35 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
        {t(claimTypeLabels[claim.claim_type])}
      </p>
      <h3 className="mt-2 text-sm font-semibold text-white">{claim.claim_value ?? t('person.noContent')}</h3>
      {showSourceDetails ? (
        <div data-sensitive-source className="mt-4 border-t border-line/60 pt-4">
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{t('person.source.name')}</dt>
              <dd className="mt-1 text-slate-200">{claim.source_name?.trim() || t('person.publicSource')}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('person.source.date')}</dt>
              <dd className="mt-1 text-slate-200">{formatUpdatedAt(claim.observed_at, language, t('person.source.notRecorded'))}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('person.source.documentStatus')}</dt>
              <dd className="mt-1 text-slate-200">{documentStatus}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('person.source.organizedAt')}</dt>
              <dd className="mt-1 text-slate-200">{formatUpdatedAt(claim.updated_at, language, t('person.source.notRecorded'))}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {claim.source_url ? (
              <a href={claim.source_url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:text-white">
                {t('person.source.originalLink')} ↗
              </a>
            ) : (
              <span className="text-xs text-slate-500">{t('person.source.noOriginalLink')}</span>
            )}
            {correctionSection && onRequestCorrection ? (
              <button
                type="button"
                onClick={() => onRequestCorrection(correctionSection)}
                className="text-xs text-signal hover:text-white"
              >
                {t('person.source.requestCorrection')} →
              </button>
            ) : null}
          </div>
        </div>
      ) : claim.source_url ? (
        <a href={claim.source_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-accent hover:text-white">
          {claim.source_name?.trim() || t('person.publicSource')} ↗
        </a>
      ) : null}
    </article>
  );
}

function PartyAffiliationList({ affiliations, currentParty }: { affiliations: PublicPersonPartyAffiliation[]; currentParty: string | null }) {
  const { t } = useI18n();

  if (affiliations.length === 0) {
    return <DataStateNotice kind="uncollected">{t('person.affiliation.empty')}</DataStateNotice>;
  }

  const normalizedCurrentParty = currentParty ? normalizePartyLabel(currentParty) : null;
  const inferredCurrentAffiliationId = affiliations.some((affiliation) => affiliation.is_current)
    ? null
    : affiliations.find((affiliation) => normalizePartyLabel(affiliation.party_name) === normalizedCurrentParty)?.affiliation_id ?? null;
  const isCurrentAffiliation = (affiliation: PublicPersonPartyAffiliation) => (
    affiliation.is_current || affiliation.affiliation_id === inferredCurrentAffiliationId
  );

  return (
    <div className="pixel-corners divide-y divide-line/60 border border-line/70 bg-bg/35">
      {affiliations.map((affiliation) => (
        <article key={affiliation.affiliation_id} className="px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                {isCurrentAffiliation(affiliation) ? t('person.affiliation.current') : t('person.affiliation.past')}
              </p>
              <h4 className="mt-1 text-sm font-semibold text-white">{normalizePartyLabel(affiliation.party_name)}</h4>
            </div>
            <span className={isCurrentAffiliation(affiliation) ? 'text-[10px] text-signal' : 'text-[10px] text-slate-400'}>
              {isCurrentAffiliation(affiliation) ? t('person.affiliation.belongs') : t('person.affiliation.formerly')}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            {[
              affiliation.observed_date ?? affiliation.observed_year,
              t(partyRoleContextLabels[affiliation.role_context]),
            ].filter(Boolean).join(' · ')}
          </p>
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

function ClaimGrid({
  claims,
  correctionSection,
  onRequestCorrection,
}: {
  claims: PublicPersonClaim[];
  correctionSection: Extract<FeedbackSectionKey, 'finance' | 'legal' | 'family'>;
  onRequestCorrection: (section: FeedbackSectionKey) => void;
}) {
  return (
    <div className="grid gap-3">
      {claims.map((claim) => (
        <ClaimCard
          key={claim.claim_id}
          claim={claim}
          correctionSection={correctionSection}
          onRequestCorrection={onRequestCorrection}
        />
      ))}
    </div>
  );
}

function PlatformClaimCard({
  claim,
  personName,
}: {
  claim: PublicPersonClaim;
  personName: string;
}) {
  const { t } = useI18n();
  const platformItems = platformItemsForClaim(claim);

  return (
    <article className="pixel-corners border border-line/70 bg-bg/35 p-4">
      <PlatformFulfillmentList claim={claim} title={t('person.publicPlatform')} shareContext={{ personId: claim.person_id, personName }} />
      {platformItems.length === 0 ? (
        <div className="mt-3 text-sm leading-6 text-slate-200">{t('person.noContent')}</div>
      ) : null}
      {claim.source_url ? (
        <a href={claim.source_url} target="_blank" rel="noreferrer" className="mt-3 block truncate text-xs text-accent hover:text-white">
          {claim.source_name?.trim() || t('person.publicSource')}
        </a>
      ) : null}
    </article>
  );
}

export function PersonPage() {
  const { language, t } = useI18n();
  const { personId } = useParams();
  const safePersonId = personId ?? '';
  const [loadedPersonId, setLoadedPersonId] = useState<string | null>(null);
  const [failedPersonId, setFailedPersonId] = useState<string | null>(null);
  const [feedbackRequest, setFeedbackRequest] = useState<{ section: FeedbackSectionKey; version: number } | null>(null);
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
  const partyAffiliations = profile ? getPartyChangeAffiliations(profile.party_affiliations, person?.party) : [];
  const theme = partyTheme[toPartyThemeKey(person?.party)];
  const publicClaims = profile ? visibleProfileClaims(profile.public_claims) : [];
  const birthDateClaim = profile ? claimsByType(profile.public_claims, 'birth_date')[0] ?? null : null;
  const primaryPhotoUrl = person?.primary_photo_thumbnail_url ?? person?.primary_photo_url ?? null;
  const personSprite = person ? pickPersonCandidateSprite(person.person_id) : null;
  const portraitSrc = person
    ? personSprite ?? primaryPhotoUrl ?? pickDefaultCandidateSprite(person.name, person.gender, birthDateClaim?.claim_value)
    : xiezhiMascotSprite;
  const usesMascotFallback = Boolean(person && !primaryPhotoUrl && portraitSrc === xiezhiMascotSprite);
  const usesDemographicFallback = Boolean(person && !personSprite && !primaryPhotoUrl && portraitSrc !== xiezhiMascotSprite);
  const portraitFallbackLabel = usesMascotFallback
    ? t('person.mascotFallbackLabel')
    : usesDemographicFallback ? t('person.demographicFallbackLabel') : null;
  const portraitFallbackDescription = usesMascotFallback
    ? t('person.mascotFallbackDescription')
    : usesDemographicFallback ? t('person.demographicFallbackDescription') : null;
  const financeClaims = profile ? claimsByType(profile.public_claims, 'finance_summary') : [];
  const rawLegalClaims = profile ? claimsByType(profile.public_claims, 'legal_case') : [];
  const rawFamilyClaims = profile ? claimsByType(profile.public_claims, 'family_relation') : [];
  const legalClaims = sensitivePublicClaims(rawLegalClaims);
  const familyClaims = sensitivePublicClaims(rawFamilyClaims);
  const displayPosition = person ? getPersonDisplayPosition(person) : t('person.publicRecord');
  const profilePosition = person ? getPersonDisplayPosition(person, t('person.toBeAdded')) : t('person.toBeAdded');
  const educationItems = person ? educationProfileItems(person.education) : [];
  const experienceItems = person ? experienceProfileItems(person.experience, displayPosition) : [];
  const profileSources = profile && person
    ? collectProfileSources(
        t('person.publicSource'),
        [{ source_name: person.photo_source_name, source_url: person.photo_source_url }],
        profile.candidate_records,
        profile.party_affiliations,
        profile.public_claims,
      )
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
  const visibleProfileSources = profileSources.slice(0, 12);
  const latestProfileUpdate = profile && person
    ? latestUpdatedValue([
        person.updated_at,
        ...profile.candidate_records.flatMap((candidate) => [candidate.candidate_updated_at, candidate.status_updated_at]),
        ...profile.party_affiliations.map((affiliation) => affiliation.updated_at),
        ...profile.public_claims.map((claim) => claim.updated_at),
      ])
    : null;
  const platformClaims = profile ? claimsByType(profile.public_claims, 'platform') : [];
  const sectionStates: Array<{ label: string; status: 'complete' | 'uncollected' | 'pending' }> = [
    {
      label: t('person.currentPosition'),
      status: person && (person.current_office_label || person.position || person.upcoming_candidate_label) ? 'complete' : 'uncollected',
    },
    { label: t('person.party'), status: person?.party ? 'complete' : 'uncollected' },
    { label: t('person.candidaciesTitle'), status: profile?.candidate_records.length ? 'complete' : 'uncollected' },
    { label: t('person.affiliationsTitle'), status: partyAffiliations.length ? 'complete' : 'uncollected' },
    { label: t('person.education'), status: educationItems.length ? 'complete' : 'uncollected' },
    { label: t('person.experience'), status: experienceItems.length ? 'complete' : 'uncollected' },
    { label: t('person.platformTitle'), status: platformClaims.length ? 'complete' : 'uncollected' },
    { label: t('person.financeTitle'), status: financeClaims.length ? 'complete' : 'uncollected' },
    {
      label: t('person.legalTitle'),
      status: legalClaims.length ? 'complete' : rawLegalClaims.length ? 'pending' : 'uncollected',
    },
    {
      label: t('person.familyTitle'),
      status: familyClaims.length ? 'complete' : rawFamilyClaims.length ? 'pending' : 'uncollected',
    },
  ];
  const completedSections = sectionStates.filter((section) => section.status === 'complete').map((section) => section.label);
  const uncollectedSections = sectionStates.filter((section) => section.status === 'uncollected').map((section) => section.label);
  const pendingSections = sectionStates.filter((section) => section.status === 'pending').map((section) => section.label);
  const sectionListSeparator = language === 'en' ? ', ' : '、';

  function handleRequestCorrection(section: FeedbackSectionKey) {
    setFeedbackRequest((current) => ({ section, version: (current?.version ?? 0) + 1 }));
  }

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
              <figure className="space-y-2">
                <div className="pixel-corners relative flex min-h-[220px] items-end justify-center border border-line/70 bg-bg/40 p-4">
                  <img
                    src={portraitSrc}
                    alt={personSprite || primaryPhotoUrl ? person.name : portraitFallbackLabel ?? ''}
                    className="max-h-[190px] w-auto object-contain object-bottom [image-rendering:pixelated]"
                  />
                  {portraitFallbackLabel ? (
                    <span className="absolute left-2 top-2 border border-cyan-300/50 bg-[#07101f]/90 px-2 py-1 text-[10px] text-cyan-100">
                      {portraitFallbackLabel}
                    </span>
                  ) : null}
                </div>
                {portraitFallbackDescription ? (
                  <figcaption className="text-xs leading-5 text-slate-400">
                    {portraitFallbackDescription}
                  </figcaption>
                ) : null}
              </figure>

              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{person.role_label}</p>
                <h2 className="mt-2 font-display text-4xl text-white">{person.name}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">{displayPosition}</p>
                <p className="mt-2 max-w-3xl text-[11px] leading-5 text-slate-500">
                  {t('person.dataQualityNote')}{' '}
                  <Link className="text-accent hover:text-white" to={dataGuidancePath()}>
                    {t('person.qualityDetails')} →
                  </Link>
                </p>
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
                  <HudStatCard label={t('person.updated')} value={formatUpdatedAt(latestProfileUpdate, language, t('person.awaitingSync'))} />
                </div>
              </div>
            </section>

            <SectionPanel title={t('person.dataSummary.title')} eyebrow={t('person.dataSummary.eyebrow')}>
              <div data-person-data-summary className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <HudStatCard
                    label={t('person.dataSummary.lastUpdated')}
                    value={formatUpdatedAt(latestProfileUpdate, language, t('person.awaitingSync'))}
                  />
                  <HudStatCard
                    label={t('person.dataSummary.sourceCount')}
                    value={t('person.dataSummary.sourceCountValue', { count: profileSources.length })}
                  />
                  <HudStatCard
                    label={t('person.dataSummary.reviewState')}
                    value={<span className="text-signal">{t('person.dataSummary.reviewedOnly')}</span>}
                  />
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
                  <article className="pixel-corners border border-signal/35 bg-signal/5 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-signal">{t('person.dataSummary.completed')}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                      {completedSections.join(sectionListSeparator) || t('person.dataSummary.none')}
                    </p>
                  </article>
                  <article className="pixel-corners border border-amber-300/35 bg-amber-300/5 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">{t('person.dataSummary.uncollected')}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                      {uncollectedSections.join(sectionListSeparator) || t('person.dataSummary.none')}
                    </p>
                  </article>
                  <article className="pixel-corners border border-violet-300/35 bg-violet-300/5 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">{t('person.dataSummary.pending')}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                      {pendingSections.join(sectionListSeparator) || t('person.dataSummary.none')}
                    </p>
                  </article>
                </div>
                <p className="border-l-2 border-accent/60 pl-3 text-xs leading-5 text-slate-400">
                  {t('person.dataSummary.reviewPolicy')}
                </p>
              </div>
            </SectionPanel>

            <PersonFeedbackPanel
              personId={person.person_id}
              personName={person.name}
              requestedSection={feedbackRequest?.section}
              requestVersion={feedbackRequest?.version}
            />

            <SectionPanel title={t('person.basicTitle')} eyebrow={t('person.basicEyebrow')}>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
                <dl className="grid content-start gap-3 sm:grid-cols-2">
                  {basicFacts.map(([label, value]) => (
                    <div key={label} className="pixel-corners border border-line/70 bg-bg/35 p-3">
                      <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</dt>
                      <dd className="mt-2 text-sm text-white">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('person.affiliationsEyebrow')}</p>
                  <h3 className="mb-3 mt-1 text-sm font-semibold text-white">{t('person.affiliationsTitle')}</h3>
                  <PartyAffiliationList affiliations={partyAffiliations} currentParty={person.party} />
                </div>
              </div>
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
                  {profile.candidate_records.map((candidate) => {
                    const candidatePlatforms = platformClaimsForCandidate(
                      profile.public_claims, candidate.candidate_id, candidate.race_id,
                    );
                    const replacementElected = profile.public_claims.some((claim) => (
                      claim.claim_type === 'office'
                      && (
                        claim.candidate_id === candidate.candidate_id
                        || claimElectionRaceId(claim) === candidate.race_id
                      )
                      && claim.claim_json.event === 'succession'
                    ));
                    return (
                    <article
                      key={candidate.candidate_id}
                      className="pixel-corners flex h-full flex-col border border-line/70 bg-bg/35 p-4"
                      data-candidacy-card
                    >
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
                        {candidateDetailRows(candidate, t, language, replacementElected).map(([label, value, valueClass]) => (
                          <div key={label} className="flex justify-between gap-3">
                            <dt className="text-slate-500">{label}</dt>
                            <dd className={`text-right ${valueClass ?? 'text-slate-200'}`}>{value}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="mt-auto pt-4" data-candidacy-platform>
                        {candidatePlatforms.length > 0 ? (
                          <div className="border-t border-line/60 pt-4">
                            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500">{t('person.platformTitle')}</p>
                            <div className="grid gap-3">
                              {candidatePlatforms.map((claim) => (
                                <PlatformClaimCard key={claim.claim_id} claim={claim} personName={person.name} />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <DataStateNotice kind="uncollected">{t('person.platform.empty')}</DataStateNotice>
                        )}
                      </div>
                    </article>
                    );
                  })}
                </div>
              ) : (
                <DataStateNotice kind="uncollected">{t('person.noCandidacies')}</DataStateNotice>
              )}
            </SectionPanel>

            {partyOffices.length > 0 ? (
              <SectionPanel title={t('person.partyOfficesTitle')} eyebrow={t('person.partyOfficesEyebrow')}>
                <PartyOfficeList affiliations={partyOffices} />
              </SectionPanel>
            ) : null}

            <SectionPanel title={t('person.resumeTitle')} eyebrow={t('person.resumeEyebrow')}>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-white">{t('person.education')}</h3>
                  {educationItems.length > 0 ? (
                    <ul className="space-y-2 text-sm text-slate-300">
                      {educationItems.map((item) => (
                        <li key={item} className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <DataStateNotice kind="uncollected">{t('person.resume.educationEmpty')}</DataStateNotice>
                  )}
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-white">{t('person.experience')}</h3>
                  {experienceItems.length > 0 ? (
                    <ul className="space-y-2 text-sm text-slate-300">
                      {experienceItems.map((item) => (
                        <li key={item} className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <DataStateNotice kind="uncollected">{t('person.resume.experienceEmpty')}</DataStateNotice>
                  )}
                </div>
              </div>
            </SectionPanel>

            <div className="grid gap-4 xl:grid-cols-3">
              <SectionPanel title={t('person.financeTitle')} eyebrow={t('person.financeEyebrow')}>
                {financeClaims.length > 0 ? (
                  <ClaimGrid claims={financeClaims} correctionSection="finance" onRequestCorrection={handleRequestCorrection} />
                ) : (
                  <DataStateNotice kind="uncollected">{t('person.finance.empty')}</DataStateNotice>
                )}
              </SectionPanel>
              <SectionPanel title={t('person.legalTitle')} eyebrow={t('person.reviewedEyebrow')}>
                {legalClaims.length > 0 ? (
                  <ClaimGrid claims={legalClaims} correctionSection="legal" onRequestCorrection={handleRequestCorrection} />
                ) : rawLegalClaims.length > 0 ? (
                  <DataStateNotice kind="pending">{t('person.legal.pending')}</DataStateNotice>
                ) : (
                  <DataStateNotice kind="uncollected">{t('person.legal.empty')}</DataStateNotice>
                )}
              </SectionPanel>
              <SectionPanel title={t('person.familyTitle')} eyebrow={t('person.reviewedEyebrow')}>
                {familyClaims.length > 0 ? (
                  <ClaimGrid claims={familyClaims} correctionSection="family" onRequestCorrection={handleRequestCorrection} />
                ) : rawFamilyClaims.length > 0 ? (
                  <DataStateNotice kind="pending">{t('person.family.pending')}</DataStateNotice>
                ) : (
                  <DataStateNotice kind="uncollected">{t('person.family.empty')}</DataStateNotice>
                )}
              </SectionPanel>
            </div>

            {publicClaims.length > 0 ? (
              <SectionPanel title={t('person.leadsTitle')} eyebrow={t('person.leadsEyebrow')}>
                <div className="grid gap-3 md:grid-cols-2">
                  {publicClaims.map((claim) => (
                    <ClaimCard key={claim.claim_id} claim={claim} />
                  ))}
                </div>
              </SectionPanel>
            ) : null}

            <SectionPanel title={t('person.sourcesTitle')} eyebrow={t('person.sourcesEyebrow')}>
              {profileSources.length > 0 ? (
                <>
                  {profileSources.length > visibleProfileSources.length ? (
                    <p className="mb-3 text-xs text-slate-500">
                      {t('person.sourcesShowing', { shown: visibleProfileSources.length, total: profileSources.length })}
                    </p>
                  ) : null}
                  <ul className="grid gap-2 md:grid-cols-2">
                    {visibleProfileSources.map((source) => (
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
                </>
              ) : (
                <DataStateNotice kind="uncollected">{t('person.sourcesEmpty')}</DataStateNotice>
              )}
            </SectionPanel>
          </div>
        ) : loading ? (
          <div data-data-state="loading" aria-live="polite" className="pixel-corners border border-accent/45 bg-accent/8 px-4 py-8 text-center text-sm text-cyan-100">
            {t('person.loading')}
          </div>
        ) : failedPersonId === safePersonId ? (
          <DataStateNotice kind="loadError">{t('person.loadError')}</DataStateNotice>
        ) : (
          <DataStateNotice kind="noPublicData">{t('person.notFound')}</DataStateNotice>
        )}
      </PixelFrame>
    </AppShell>
  );
}
