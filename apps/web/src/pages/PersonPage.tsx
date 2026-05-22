import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { pickDefaultCandidateSprite } from '../data/defaultCharacterAssets';
import { publicDataProvider } from '../lib/publicData';
import { normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { peoplePath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicCandidate } from '../types/publicViews';

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

function splitProfileText(value: string | null | undefined) {
  return value
    ?.split(/[;；]/)
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}

function EmptyInfo({ children }: { children: string }) {
  return (
    <div className="pixel-corners border border-line/70 bg-bg/35 px-4 py-5 text-sm text-slate-300">
      {children}
    </div>
  );
}

export function PersonPage() {
  const { personId } = useParams();
  const profile = publicDataProvider.getPersonProfile(personId ?? '');
  const person = profile?.person ?? null;
  const theme = partyTheme[toPartyThemeKey(person?.party)];

  return (
    <AppShell>
      <PixelFrame
        title="人物資料"
        action={
          <Link to={peoplePath()} className="text-[11px] uppercase tracking-[0.22em] text-accent hover:text-white">
            back to people
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
                  {person.position ?? '公開人物資料'}。此頁先彙整目前可公開的基本資料、候選紀錄與資料狀態。
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

            <SectionPanel title="基本資料" eyebrow="public profile">
              <dl className="grid gap-3 sm:grid-cols-2">
                {[
                  ['姓名', person.name],
                  ['別名', person.alias ?? '無公開別名'],
                  ['性別', person.gender ? genderLabels[person.gender] : '待補'],
                  ['政黨', normalizePartyLabel(person.party)],
                  ['職位', person.position ?? '待補'],
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
              <SectionPanel title="身分摘要" eyebrow="merged profile">
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

            <SectionPanel title="參選紀錄" eyebrow="candidate records">
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
                        <div className="flex justify-between gap-3"><dt className="text-slate-500">地區</dt><dd className="text-right text-slate-200">{candidate.region_name ?? '未指定'}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-slate-500">政黨</dt><dd className="text-right text-slate-200">{normalizePartyLabel(candidate.party)}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-slate-500">號次</dt><dd className="text-right text-slate-200">{candidate.candidate_no ?? '無'}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-slate-500">來源</dt><dd className="text-right text-slate-200">{candidate.source_name ?? '待補來源'}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyInfo>目前沒有可公開的參選紀錄。</EmptyInfo>
              )}
            </SectionPanel>

            <div className="grid gap-4 lg:grid-cols-3">
              <SectionPanel title="經歷" eyebrow="experience">
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
              <SectionPanel title="學歷" eyebrow="education">
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
              <SectionPanel title="政治獻金" eyebrow="contributions">
                <EmptyInfo>此頁不顯示個人捐贈明細；後續僅放可公開摘要或已審核關係。</EmptyInfo>
              </SectionPanel>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <SectionPanel title="政見" eyebrow="platform">
                <EmptyInfo>政見資料待接官方公告或公開政見來源。</EmptyInfo>
              </SectionPanel>
              <SectionPanel title="司法 / 爭議紀錄" eyebrow="legal records">
                <EmptyInfo>此區只預留已審核公開摘要；法院判決書與媒體/民團整理需比對同一人後才可公開。</EmptyInfo>
              </SectionPanel>
              <SectionPanel title="政治家族關係" eyebrow="family network">
                <EmptyInfo>政二代、親屬任公職或政治家族關係需來源佐證與人工覆核，暫不自動推論。</EmptyInfo>
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
