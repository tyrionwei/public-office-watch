import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import { refreshConfiguredPublicDataProvider } from '../lib/publicDataProviderFactory';
import { normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { peoplePath, personPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicLegislatorPartySummary, PublicNationalOfficeHolder, PublicNationalOfficeInstitution } from '../types/publicViews';
import { PixelFrame } from './PixelFrame';

const institutionOrder: PublicNationalOfficeInstitution[] = [
  'presidency',
  'executive_yuan',
  'legislative_yuan',
  'judicial_yuan',
  'examination_yuan',
  'control_yuan',
];

function HolderSlot({ holder }: { holder: PublicNationalOfficeHolder | undefined }) {
  const { t } = useI18n();
  const isVacant = !holder?.holder_name || holder.tenure_status === 'vacant';
  const roleLabel = holder?.role_key === 'deputy'
    ? t('nationalOffice.deputy')
    : t('nationalOffice.chief');
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{roleLabel}</p>
        {holder?.tenure_status === 'acting' || isVacant ? (
          <span className="text-[10px] uppercase tracking-[0.16em] text-warning">
            {holder?.tenure_status === 'acting' ? t('nationalOffice.acting') : t('nationalOffice.vacant')}
          </span>
        ) : null}
      </div>
      <p className="mt-1 truncate font-display text-lg text-white">
        {holder?.holder_name || t('nationalOffice.awaitingAppointment')}
      </p>
    </>
  );

  return (
    <div className="pixel-corners border border-line/65 bg-bg/40 px-3 py-2">
      {holder?.holder_person_id ? (
        <Link className="block hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/35" to={personPath(holder.holder_person_id)}>
          {content}
        </Link>
      ) : content}
      {holder?.source_url ? (
        <a
          className="mt-2 inline-block text-[10px] text-slate-500 hover:text-accent"
          href={holder.source_url}
          target="_blank"
          rel="noreferrer"
        >
          {t('nationalOffice.source')}
        </a>
      ) : null}
    </div>
  );
}

function InstitutionCard({ institution, holders }: {
  institution: PublicNationalOfficeInstitution;
  holders: PublicNationalOfficeHolder[];
}) {
  const { t } = useI18n();
  return (
    <section className="pixel-corners border border-line/70 bg-panelAlt/25 p-3">
      <p className="mb-2 font-display text-xs uppercase tracking-[0.2em] text-accent">
        {t(`nationalOffice.institution.${institution}`)}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <HolderSlot holder={holders.find((holder) => holder.role_key === 'chief')} />
        <HolderSlot holder={holders.find((holder) => holder.role_key === 'deputy')} />
      </div>
    </section>
  );
}

function legislatorPartyCounts(rows: PublicLegislatorPartySummary[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const party = normalizePartyLabel(row.party_name);
    counts.set(party, (counts.get(party) ?? 0) + row.legislator_count);
  }
  return Array.from(counts, ([party, count]) => ({ party, count }))
    .sort((left, right) => right.count - left.count || left.party.localeCompare(right.party, 'zh-Hant-TW'));
}

export function NationalOfficeSummaryPanel() {
  const { t } = useI18n();
  const [holders, setHolders] = useState<PublicNationalOfficeHolder[]>([]);
  const [legislatorSummary, setLegislatorSummary] = useState<PublicLegislatorPartySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    void refreshConfiguredPublicDataProvider()
      .then(() => Promise.all([
        publicDataProvider.loadNationalOfficeHolders(),
        publicDataProvider.loadCurrentLegislatorPartySummary(),
      ]))
      .then(([nextHolders, nextLegislatorSummary]) => {
        if (!active) return;
        setHolders(nextHolders);
        setLegislatorSummary(nextLegislatorSummary);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoading(false);
        if (import.meta.env.DEV) console.warn('Failed to load national office summary', error);
      });

    return () => {
      active = false;
    };
  }, []);

  const partyCounts = useMemo(() => legislatorPartyCounts(legislatorSummary), [legislatorSummary]);
  const legislatorCount = useMemo(
    () => partyCounts.reduce((total, item) => total + item.count, 0),
    [partyCounts],
  );
  const largestPartyCount = partyCounts[0]?.count ?? 1;

  return (
    <PixelFrame
      title={t('nationalOffice.title')}
      action={loading ? <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t('office.loading')}</span> : null}
      className="overflow-visible bg-[linear-gradient(180deg,rgba(12,18,36,0.96),rgba(8,15,30,0.92))]"
    >
      <div className="space-y-3">
        {institutionOrder.map((institution) => (
          <InstitutionCard
            key={institution}
            institution={institution}
            holders={holders.filter((holder) => holder.institution_key === institution)}
          />
        ))}

        <section className="pixel-corners border border-line/70 bg-panelAlt/25 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-xs uppercase tracking-[0.2em] text-accent">{t('nationalOffice.legislatorParties')}</p>
              <p className="mt-1 text-xs text-slate-500">{t('nationalOffice.recordedLegislators', { count: legislatorCount })}</p>
            </div>
            <Link
              to={peoplePath({ role: 'legislator', status: 'current' })}
              className="text-[10px] uppercase tracking-[0.16em] text-accent hover:text-white"
            >
              {t('office.viewPeople')}
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {partyCounts.map(({ party, count }) => {
              const theme = partyTheme[toPartyThemeKey(party)];
              return (
                <div key={party} className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-slate-300">{party}</span>
                    </div>
                    <div className="h-2 overflow-hidden border border-line/60 bg-bg/60">
                      <div
                        className="h-full"
                        style={{ width: `${Math.max(4, (count / largestPartyCount) * 100)}%`, backgroundColor: theme.accent }}
                      />
                    </div>
                  </div>
                  <span className="text-right font-display text-lg" style={{ color: theme.text }}>{count}</span>
                </div>
              );
            })}
            {!loading && partyCounts.length === 0 ? (
              <p className="text-sm text-slate-400">{t('nationalOffice.noLegislators')}</p>
            ) : null}
          </div>
        </section>
      </div>
    </PixelFrame>
  );
}
