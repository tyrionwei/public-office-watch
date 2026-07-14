import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { pickDefaultCandidateSprite } from '../data/defaultCharacterAssets';
import { publicDataProvider } from '../lib/publicData';
import { getPersonDisplayPosition, normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { peoplePath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicCandidate, PublicPersonClaim, PublicPersonPartyAffiliation, PublicPersonTimelineItem } from '../types/publicViews';

const candidateStatusLabels: Record<PublicCandidate['registration_status'], string> = {
  [`${'pen'}${'ding'}`]: '待公告',
  registered: '已登記',
  qualified: '資格符合',
  disqualified: '資格不符',
  withdrawn: '已退選',
  elected: '當選',
  not_elected: '未當選',
  unknown: '未知',
};

const genderLabels = {
  male: '男',
  female: '女',
  unknown: '未知',
};

const timelineCategoryLabels: Record<PublicPersonTimelineItem['category'], string> = {
  office: '公職',
  candidacy: '參選',
  party: '黨籍',
  experience: '經歷',
};

const timelineStatusLabels: Record<PublicPersonTimelineItem['status'], string> = {
  current: '現任',
  past: '過往',
  candidate: '候選',
  unknown: '紀錄',
};

const partyRoleContextLabels: Record<PublicPersonPartyAffiliation['role_context'], string> = {
  candidate: '候選登記',
  officeholder: '公職紀錄',
  party_officer: '黨職',
  self_declared: '自行揭露',
  wiki_record: '公開百科紀錄',
  official_record: '官方紀錄',
  other: '其他來源',
};

const claimTypeLabels: Record<PublicPersonClaim['claim_type'], string> = {
  name: '姓名',
  alias: '別名',
  gender: '性別',
  birth_date: '生日',
  party: '政黨',
  party_affiliation: '政黨紀錄',
  position: '職位',
  office: '公職',
  candidacy: '參選',
  district: '地區',
  education: '學歷',
  experience: '經歷',
  platform: '政見',
  finance_summary: '政治獻金',
  legal_case: '司法紀錄',
  family_relation: '政治家族',
  media: '媒體資料',
  external_id: '外部 ID',
  other: '其他',
};

function splitProfileText(value: string | null | undefined) {
  return value
    ?.split(/[;；]/)
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}

function uniqueProfileItems(value: string | null | undefined) {
  const seen = new Set<string>();
  return splitProfileText(value).map((item) => item.replace(/\/+$/, '').trim()).filter((item) => {
    const key = item.replace(/\s+/g, '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function meaningfulEducationItems(value: string | null | undefined) {
  const items = uniqueProfileItems(value);
  const specificItems = items.filter((item) => !/^(?:國小|國中|高中|高職|專科|大學|學士|碩士|博士)(?:學歷)?$/.test(item));
  return specificItems.length > 0 ? specificItems : items;
}

function meaningfulExperienceItems(value: string | null | undefined, currentPosition: string) {
  const normalizeRole = (role: string) => role
    .replace(/^(?:中華民國|共和國)/, '')
    .replace(/\s+/g, '')
    .toLowerCase();
  const normalizedCurrentPosition = normalizeRole(currentPosition);
  const filteredItems = uniqueProfileItems(value).filter((item) => {
    const normalizedItem = normalizeRole(item);
    if (item.length > 240) return false;
    if (normalizedItem === '政治人物' || normalizedItem === 'politician' || normalizedItem === '政府首腦') return false;
    if (normalizedItem === normalizedCurrentPosition) return false;
    if (/^(?:19|20)\d{2}年.*選舉/.test(normalizedItem)) return false;
    return true;
  });
  const chineseItems = filteredItems.filter((item) => /[\u3400-\u9fff]/.test(item));
  return chineseItems.length > 0 ? chineseItems : filteredItems;
}

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) return '待同步';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium' }).format(date);
}

type SourceRecord = {
  source_name: string | null;
  source_url: string | null;
};

function collectProfileSources(...groups: SourceRecord[][]) {
  const sources = new Map<string, { name: string; url: string }>();
  groups.flat().forEach((record) => {
    if (!record.source_url) return;
    const name = record.source_name?.trim() || '公開資料來源';
    const key = name.toLowerCase();
    if (sources.has(key)) return;
    sources.set(key, { name, url: record.source_url });
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

function formatVoteCount(value: number | null) {
  return value === null ? null : value.toLocaleString('zh-TW');
}

function formatVoteRate(value: number | null) {
  if (value === null) return null;
  const percentage = value > 1 ? value : value * 100;
  return percentage.toFixed(2).replace(/\.00$/, '') + '%';
}

function candidateDetailRows(candidate: PublicCandidate) {
  const rows: Array<[string, string]> = [];
  const voteCount = formatVoteCount(candidate.vote_count);
  const voteRate = formatVoteRate(candidate.vote_rate);

  if (candidate.region_name) rows.push(['地區', candidate.region_name]);
  rows.push(['政黨', normalizePartyLabel(candidate.party)]);
  if (candidate.candidate_no !== null) rows.push(['號次', String(candidate.candidate_no)]);
  if (voteCount) rows.push(['得票數', voteCount]);
  if (voteRate) rows.push(['得票率', voteRate]);
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
  return (
    <article className="pixel-corners border border-line/70 bg-bg/35 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
        {claimTypeLabels[claim.claim_type]}
      </p>
      <h3 className="mt-2 text-sm font-semibold text-white">{claim.claim_value}</h3>
    </article>
  );
}

function TimelineList({ items }: { items: PublicPersonTimelineItem[] }) {
  if (items.length === 0) {
    return <EmptyInfo>目前沒有足夠資料建立人物時間軸。</EmptyInfo>;
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="grid gap-3 sm:grid-cols-[76px_minmax(0,1fr)]">
          <div className="text-sm font-semibold text-signal">{item.year ?? item.date ?? '—'}</div>
          <article className="pixel-corners border border-line/70 bg-bg/35 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="pixel-corners border border-line/70 px-2 py-1">{timelineCategoryLabels[item.category]}</span>
              {item.status !== 'unknown' ? <span>{timelineStatusLabels[item.status]}</span> : null}
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
  if (affiliations.length === 0) {
    return <EmptyInfo>目前沒有已公開的黨籍歷史紀錄。</EmptyInfo>;
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
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{isCurrentAffiliation(affiliation) ? '目前黨籍' : '過往黨籍'}</p>
              <h3 className="mt-2 text-sm font-semibold text-white">{normalizePartyLabel(affiliation.party_name)}</h3>
            </div>
            <span className={isCurrentAffiliation(affiliation) ? 'text-xs text-signal' : 'text-xs text-slate-400'}>
              {isCurrentAffiliation(affiliation) ? '現屬' : '曾屬'}
            </span>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            {affiliation.observed_date || affiliation.observed_year ? (
              <div className="flex justify-between gap-3"><dt className="text-slate-500">紀錄時間</dt><dd className="text-right text-slate-200">{affiliation.observed_date ?? affiliation.observed_year}</dd></div>
            ) : null}
            <div className="flex justify-between gap-3"><dt className="text-slate-500">紀錄類型</dt><dd className="text-right text-slate-200">{partyRoleContextLabels[affiliation.role_context]}</dd></div>
          </dl>
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
  const platformText = platformTextForClaim(claim);

  return (
    <article className="pixel-corners border border-line/70 bg-bg/35 p-4">
      <h3 className="text-sm font-semibold text-white">公開政見</h3>
      <div className="mt-3 max-h-72 overflow-auto whitespace-pre-line pr-2 text-sm leading-6 text-slate-200">
        {platformText ?? '未提供內容'}
      </div>
    </article>
  );
}

export function PersonPage() {
  const { personId } = useParams();
  const profile = publicDataProvider.getPersonProfile(personId ?? '');
  const person = profile?.person ?? null;
  const theme = partyTheme[toPartyThemeKey(person?.party)];
  const publicClaims = profile ? visibleProfileClaims(profile.public_claims) : [];
  const birthDateClaim = profile ? claimsByType(profile.public_claims, 'birth_date')[0] ?? null : null;
  const platformClaims = profile ? claimsByType(profile.public_claims, 'platform') : [];
  const financeClaims = profile ? claimsByType(profile.public_claims, 'finance_summary') : [];
  const legalClaims = profile ? sensitivePublicClaims(claimsByType(profile.public_claims, 'legal_case')) : [];
  const familyClaims = profile ? sensitivePublicClaims(claimsByType(profile.public_claims, 'family_relation')) : [];
  const displayPosition = person ? getPersonDisplayPosition(person) : '公開人物資料';
  const profilePosition = person ? getPersonDisplayPosition(person, '待補') : '待補';
  const educationItems = person ? meaningfulEducationItems(person.education) : [];
  const experienceItems = person ? meaningfulExperienceItems(person.experience, displayPosition) : [];
  const profileSources = profile
    ? collectProfileSources(profile.candidate_records, profile.party_affiliations, profile.public_claims)
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
        person.alias ? ['別名', person.alias] : null,
        person.gender && person.gender !== 'unknown' ? ['性別', genderLabels[person.gender]] : null,
        birthDateClaim?.claim_value ? ['生日', birthDateClaim.claim_value] : null,
        ['現職', profilePosition],
        person.region_name || person.district ? ['所處區域', person.region_name ?? person.district ?? ''] : null,
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
        title="人物資料"
        action={
          <Link to={peoplePath()} className="text-[11px] uppercase tracking-[0.22em] text-accent hover:text-white">
            返回人物列表
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
                    label="政黨"
                    value={
                      <span
                        className="pixel-corners inline-block border px-2 py-1 text-sm"
                        style={{ borderColor: theme.accent, backgroundColor: `${theme.primary}33`, color: theme.text }}
                      >
                        {normalizePartyLabel(person.party)}
                      </span>
                    }
                  />
                  <HudStatCard label="地區" value={person.region_name ?? person.district ?? '未指定'} />
                  <HudStatCard label="狀態" value={<span className={person.status === 'current' ? 'text-signal' : 'text-white'}>{person.status_label}</span>} />
                  <HudStatCard label="資料更新" value={formatUpdatedAt(person.updated_at)} />
                </div>
              </div>
            </section>

            <SectionPanel title="基本資料" eyebrow="公開基本資料">
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
              <SectionPanel title="身分摘要" eyebrow="合併身分">
                <div className="grid gap-3 md:grid-cols-2">
                  {identityRecords.map((identity) => (
                    <article key={identity.person_id} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{identity.status_label}</p>
                      <h3 className="mt-2 font-display text-lg text-white">{identity.position ?? identity.role_label}</h3>
                      <p className="mt-2 text-sm text-slate-400">
                        {[normalizePartyLabel(identity.party), identity.district].filter(Boolean).join(' · ') || '公開人物資料'}
                      </p>
                    </article>
                  ))}
                </div>
              </SectionPanel>
            ) : null}

            <SectionPanel title="參選紀錄" eyebrow="選舉與結果">
              {profile.candidate_records.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {profile.candidate_records.map((candidate) => (
                    <article key={candidate.candidate_id} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{candidate.election_name}</p>
                          <h3 className="mt-2 font-display text-lg text-white">{candidate.race_title}</h3>
                        </div>
                        <span className="text-xs text-signal">{candidateStatusLabels[candidate.registration_status]}</span>
                      </div>
                      <dl className="mt-3 space-y-2 text-sm">
                        {candidateDetailRows(candidate).map(([label, value]) => (
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
                <EmptyInfo>目前沒有可公開的參選紀錄。</EmptyInfo>
              )}
            </SectionPanel>

            {profile.timeline_records.length > 0 || profile.party_affiliations.length > 0 ? (
              <div className={
                profile.timeline_records.length > 0 && profile.party_affiliations.length > 0
                  ? 'grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]'
                  : 'grid gap-4'
              }>
                {profile.timeline_records.length > 0 ? (
                  <SectionPanel title="人物時間軸" eyebrow="依年份排序">
                    <TimelineList items={profile.timeline_records} />
                  </SectionPanel>
                ) : null}
                {profile.party_affiliations.length > 0 ? (
                  <SectionPanel title="黨籍紀錄" eyebrow="政黨歸屬">
                    <PartyAffiliationList affiliations={profile.party_affiliations} currentParty={person.party} />
                  </SectionPanel>
                ) : null}
              </div>
            ) : null}

            {educationItems.length > 0 || experienceItems.length > 0 ? (
              <SectionPanel title="學歷與經歷" eyebrow="公開履歷">
                <div className={
                  educationItems.length > 0 && experienceItems.length > 0
                    ? 'grid gap-4 lg:grid-cols-2'
                    : 'grid gap-4'
                }>
                  {educationItems.length > 0 ? (
                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-white">學歷</h3>
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
                      <h3 className="mb-3 text-sm font-semibold text-white">經歷</h3>
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
                  <SectionPanel title="政見" eyebrow="公開政見">
                    <div className="grid gap-3">
                      {platformClaims.map((claim) => (
                        <PlatformClaimCard key={claim.claim_id} claim={claim} />
                      ))}
                    </div>
                  </SectionPanel>
                ) : null}
                {financeClaims.length > 0 ? (
                  <SectionPanel title="政治獻金" eyebrow="公開摘要">
                    <ClaimGrid claims={financeClaims} />
                  </SectionPanel>
                ) : null}
                {legalClaims.length > 0 ? (
                  <SectionPanel title="司法 / 爭議紀錄" eyebrow="已審核資料">
                    <ClaimGrid claims={legalClaims} />
                  </SectionPanel>
                ) : null}
                {familyClaims.length > 0 ? (
                  <SectionPanel title="政治家族關係" eyebrow="已審核資料">
                    <ClaimGrid claims={familyClaims} />
                  </SectionPanel>
                ) : null}
              </div>
            ) : null}

            {publicClaims.length > 0 ? (
              <SectionPanel title="公開資料線索" eyebrow="已審核線索">
                <div className="grid gap-3 md:grid-cols-2">
                  {publicClaims.map((claim) => (
                    <ClaimCard key={claim.claim_id} claim={claim} />
                  ))}
                </div>
              </SectionPanel>
            ) : null}

            {profileSources.length > 0 ? (
              <SectionPanel title="資料來源" eyebrow="參考連結">
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
        ) : (
          <div className="pixel-corners border border-line/70 bg-bg/35 px-4 py-8 text-center text-sm text-slate-300">
            找不到這筆人物資料。
          </div>
        )}
      </PixelFrame>
    </AppShell>
  );
}
