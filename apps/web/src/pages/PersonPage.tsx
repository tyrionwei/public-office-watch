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

function claimJsonRecord(value: PublicPersonClaim['claim_json'][string]) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function claimJsonString(claim: PublicPersonClaim, key: string) {
  const value = claim.claim_json[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function platformTextForClaim(claim: PublicPersonClaim) {
  return claimJsonString(claim, 'platformText') ?? claim.claim_value?.trim() ?? null;
}

function platformSourceLabel(claim: PublicPersonClaim) {
  const source = claimJsonRecord(claim.claim_json.platformSource);
  const sourceKind = typeof source?.sourceKind === 'string' ? source.sourceKind : null;
  const templateTitle = typeof source?.templateTitle === 'string' ? source.templateTitle : null;

  if (sourceKind === 'template') {
    return templateTitle ? 'VoteTW 模板：' + templateTitle : 'VoteTW 模板政見';
  }

  if (sourceKind === 'inline') {
    return 'VoteTW 人物頁政見段落';
  }

  return claim.source_name ?? '公開政見來源';
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
  const voteCount = formatVoteCount(candidate.vote_count);
  const voteRate = formatVoteRate(candidate.vote_rate);
  const rows = [
    ['地區', candidate.region_name ?? '未指定'],
    ['政黨', normalizePartyLabel(candidate.party)],
    ['號次', candidate.candidate_no ?? '無'],
  ];

  if (voteCount) rows.push(['得票數', voteCount]);
  if (voteRate) rows.push(['得票率', voteRate]);
  if (candidate.is_elected !== null) rows.push(['選舉結果', candidate.is_elected ? '當選' : '未當選']);
  if (candidate.is_incumbent !== null) rows.push(['登記現任', candidate.is_incumbent ? '是' : '否']);
  rows.push(['來源', candidate.source_name ?? '待補來源']);
  return rows;
}

function sensitivePublicClaims(claims: PublicPersonClaim[]) {
  return claims.filter((claim) => claim.review_score >= 70 && ['A', 'B'].includes(claim.confidence_level));
}

function confidenceBadge(confidenceLevel: PublicPersonClaim['confidence_level'] | null) {
  return confidenceLevel ? '信任度 ' + confidenceLevel : '信任度待補';
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
    'position',
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {claimTypeLabels[claim.claim_type]}
          </p>
          <h3 className="mt-2 text-sm font-semibold text-white">{claim.claim_value ?? '未提供內容'}</h3>
        </div>
        <span className="text-xs text-signal">{claim.review_score}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="pixel-corners border border-line/70 px-2 py-1">可信度 {claim.confidence_level}</span>
        {claim.source_url ? (
          <a href={claim.source_url} target="_blank" rel="noreferrer" className="text-accent hover:text-white">
            {claim.source_name ?? '來源'}
          </a>
        ) : (
          <span>{claim.source_name ?? '來源待補'}</span>
        )}
      </div>
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
          <div className="text-sm font-semibold text-signal">{item.year ?? item.date ?? '未標年'}</div>
          <article className="pixel-corners border border-line/70 bg-bg/35 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="pixel-corners border border-line/70 px-2 py-1">{timelineCategoryLabels[item.category]}</span>
              <span>{timelineStatusLabels[item.status]}</span>
              <span>{confidenceBadge(item.confidence_level)}</span>
            </div>
            <h3 className="mt-2 text-sm font-semibold text-white">{item.label}</h3>
            {item.detail ? <p className="mt-2 text-sm text-slate-400">{item.detail}</p> : null}
            {item.source_url ? (
              <a href={item.source_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-accent hover:text-white">
                {item.source_name ?? '來源'}
              </a>
            ) : item.source_name ? (
              <p className="mt-3 text-xs text-slate-500">{item.source_name}</p>
            ) : null}
          </article>
        </li>
      ))}
    </ol>
  );
}

function PartyAffiliationList({ affiliations }: { affiliations: PublicPersonPartyAffiliation[] }) {
  if (affiliations.length === 0) {
    return <EmptyInfo>目前沒有已公開的黨籍歷史紀錄。</EmptyInfo>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {affiliations.map((affiliation) => (
        <article key={affiliation.affiliation_id} className="pixel-corners border border-line/70 bg-bg/35 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{affiliation.is_current ? 'current party' : 'party history'}</p>
              <h3 className="mt-2 text-sm font-semibold text-white">{normalizePartyLabel(affiliation.party_name)}</h3>
            </div>
            <span className={affiliation.is_current ? 'text-xs text-signal' : 'text-xs text-slate-400'}>
              {affiliation.is_current ? '現屬' : '曾屬'}
            </span>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-slate-500">紀錄時間</dt><dd className="text-right text-slate-200">{affiliation.observed_date ?? affiliation.observed_year ?? '未標年'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">脈絡</dt><dd className="text-right text-slate-200">{partyRoleContextLabels[affiliation.role_context]}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">信任度</dt><dd className="text-right text-slate-200">{affiliation.confidence_level}</dd></div>
          </dl>
          {affiliation.source_url ? (
            <a href={affiliation.source_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-accent hover:text-white">
              {affiliation.source_name ?? '來源'}
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function ClaimGrid({ claims, emptyText }: { claims: PublicPersonClaim[]; emptyText: string }) {
  if (claims.length === 0) {
    return <EmptyInfo>{emptyText}</EmptyInfo>;
  }

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
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">政見</p>
          <h3 className="mt-2 text-sm font-semibold text-white">{platformSourceLabel(claim)}</h3>
        </div>
        <span className="text-xs text-signal">可信度 {claim.confidence_level}</span>
      </div>
      <div className="mt-3 max-h-72 overflow-auto whitespace-pre-line pr-2 text-sm leading-6 text-slate-200">
        {platformText ?? '未提供內容'}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="pixel-corners border border-line/70 px-2 py-1">review {claim.review_score}</span>
        {claim.source_url ? (
          <a href={claim.source_url} target="_blank" rel="noreferrer" className="text-accent hover:text-white">
            {claim.source_name ?? '來源'}
          </a>
        ) : (
          <span>{claim.source_name ?? '來源待補'}</span>
        )}
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
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {displayPosition}。此頁先彙整目前可公開的基本資料、候選紀錄與資料狀態。
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <HudStatCard
                    label="party"
                    value={
                      <span
                        className="pixel-corners inline-block border px-2 py-1 text-sm"
                        style={{ borderColor: theme.accent, backgroundColor: `${theme.primary}33`, color: theme.text }}
                      >
                        {normalizePartyLabel(person.party)}
                      </span>
                    }
                  />
                  <HudStatCard label="region" value={person.region_name ?? person.district ?? '未指定'} />
                  <HudStatCard label="status" value={<span className={person.status === 'current' ? 'text-signal' : 'text-white'}>{person.status_label}</span>} />
                  <HudStatCard label="updated" value={person.updated_at || '待同步'} />
                </div>
              </div>
            </section>

            <SectionPanel title="基本資料" eyebrow="公開基本資料">
              <dl className="grid gap-3 sm:grid-cols-2">
                {[
                  ['姓名', person.name],
                  ['別名', person.alias ?? '無公開別名'],
                  ['性別', person.gender ? genderLabels[person.gender] : '待補'],
                  ['生日', birthDateClaim?.claim_value ?? '待補'],
                  ['政黨', normalizePartyLabel(person.party)],
                  ['職位', profilePosition],
                  ['所處區域', person.region_name ?? person.district ?? '未指定'],
                  ['選舉年度', person.election_year?.toString() ?? '待補'],
                ].map(([label, value]) => (
                  <div key={label} className="pixel-corners border border-line/70 bg-bg/35 p-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</dt>
                    <dd className="mt-2 text-sm text-white">{value}</dd>
                  </div>
                ))}
              </dl>
            </SectionPanel>

            {profile.identity_records.length > 1 ? (
              <SectionPanel title="身分摘要" eyebrow="合併身分">
                <div className="grid gap-3 md:grid-cols-2">
                  {profile.identity_records.map((identity) => (
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

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
              <SectionPanel title="人物時間軸" eyebrow="profile timeline">
                <TimelineList items={profile.timeline_records} />
              </SectionPanel>
              <SectionPanel title="黨籍紀錄" eyebrow="party history">
                <PartyAffiliationList affiliations={profile.party_affiliations} />
              </SectionPanel>
            </div>

            <SectionPanel title="參選紀錄" eyebrow="參選紀錄">
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

            <SectionPanel title="公開資料線索" eyebrow="已審核線索">
              {publicClaims.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {publicClaims.map((claim) => (
                    <ClaimCard key={claim.claim_id} claim={claim} />
                  ))}
                </div>
              ) : (
                <EmptyInfo>目前沒有已公開的補充資料線索。</EmptyInfo>
              )}
            </SectionPanel>

            <div className="grid gap-4 lg:grid-cols-3">
              <SectionPanel title="經歷" eyebrow="經歷">
                {splitProfileText(person.experience).length > 0 ? (
                  <ul className="space-y-2 text-sm text-slate-300">
                    {splitProfileText(person.experience).map((item) => (
                      <li key={item} className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyInfo>經歷資料來源待同步，暫不手動推論。</EmptyInfo>
                )}
              </SectionPanel>
              <SectionPanel title="學歷" eyebrow="學歷">
                {splitProfileText(person.education).length > 0 ? (
                  <ul className="space-y-2 text-sm text-slate-300">
                    {splitProfileText(person.education).map((item) => (
                      <li key={item} className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyInfo>學歷資料待接官方公報或機關名冊。</EmptyInfo>
                )}
              </SectionPanel>
              <SectionPanel title="政治獻金" eyebrow="政治獻金">
                <ClaimGrid
                  claims={financeClaims}
                  emptyText="此頁不顯示個人捐贈明細；後續僅放可公開摘要或已審核關係。"
                />
              </SectionPanel>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <SectionPanel title="政見" eyebrow="政見">
                {platformClaims.length > 0 ? (
                  <div className="grid gap-3">
                    {platformClaims.map((claim) => (
                      <PlatformClaimCard key={claim.claim_id} claim={claim} />
                    ))}
                  </div>
                ) : (
                  <EmptyInfo>政見資料待接官方公告或公開政見來源。</EmptyInfo>
                )}
              </SectionPanel>
              <SectionPanel title="司法 / 爭議紀錄" eyebrow="司法與爭議">
                <ClaimGrid
                  claims={legalClaims}
                  emptyText="此區只預留已審核公開摘要；法院判決書與媒體/民團整理需比對同一人後才可公開。"
                />
              </SectionPanel>
              <SectionPanel title="政治家族關係" eyebrow="政治家族">
                <ClaimGrid
                  claims={familyClaims}
                  emptyText="政二代、親屬任公職或政治家族關係需來源佐證與人工覆核，暫不自動推論。"
                />
              </SectionPanel>
            </div>
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
