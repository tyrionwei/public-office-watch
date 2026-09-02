import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import { refreshConfiguredPublicDataProvider } from '../lib/publicDataProviderFactory';
import { getPersonDisplayPosition, normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { peoplePath, personPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicLocalOfficeSummary, PublicPersonListItem } from '../types/publicViews';
import { PixelFrame } from './PixelFrame';

type LocalOfficeSummaryPanelProps = {
  regionId: string;
};

function EmptyOfficeCard({ emptyText }: { emptyText: string }) {
  const { t } = useI18n();

  return (
    <div className="pixel-corners border border-line/70 bg-bg/35 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('office.dataPending')}</p>
      <p className="mt-2 text-sm text-slate-300">{emptyText}</p>
    </div>
  );
}

function PersonOfficeLink({
  person,
  dense = false,
  showRoleLabel = true,
}: {
  person: PublicPersonListItem;
  dense?: boolean;
  showRoleLabel?: boolean;
}) {
  const { t } = useI18n();
  const theme = partyTheme[toPartyThemeKey(person.party)];
  const subtitle = getPersonDisplayPosition(person, t('office.currentOfficeFallback'));
  const linkClassName = dense
    ? 'pixel-corners flex items-start justify-between gap-3 border border-line/70 bg-bg/40 px-3 py-2 transition hover:border-accent/60 hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/35'
    : 'pixel-corners flex items-start justify-between gap-3 border border-line/70 bg-bg/40 p-3 transition hover:border-accent/60 hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/35';

  return (
    <Link to={personPath(person.person_id)} className={linkClassName}>
      <div className="min-w-0">
        {showRoleLabel ? <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{person.role_label}</p> : null}
        <h3 className={showRoleLabel ? (dense ? 'mt-1 truncate font-display text-lg text-white' : 'mt-2 font-display text-xl text-white') : dense ? 'truncate font-display text-lg text-white' : 'font-display text-xl text-white'}>
          {person.name}
        </h3>
        <p className={dense ? 'mt-1 line-clamp-2 text-xs text-slate-400' : 'mt-1 text-sm text-slate-400'}>
          {subtitle}
        </p>
      </div>
      <span
        className="theme-party-chip pixel-corners shrink-0 border px-2 py-1 text-[11px]"
        style={{ borderColor: theme.accent, backgroundColor: `${theme.primary}33`, color: theme.text }}
      >
        {normalizePartyLabel(person.party)}
      </span>
    </Link>
  );
}

function PersonOfficeCard({
  title,
  person,
  emptyText,
}: {
  title: string;
  person: PublicPersonListItem | null;
  emptyText: string;
}) {
  return (
    <section className="pixel-corners border border-line/70 bg-bg/35 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <div className="mt-3">{person ? <PersonOfficeLink person={person} showRoleLabel={false} /> : <EmptyOfficeCard emptyText={emptyText} />}</div>
    </section>
  );
}

function PersonOfficeGroupCard({
  title,
  people,
  emptyText,
  visibleCount = 3,
}: {
  title: string;
  people: PublicPersonListItem[];
  emptyText: string;
  visibleCount?: number;
}) {
  const { t } = useI18n();
  const cardRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ left: 0, top: 0, width: 320 });

  useEffect(() => {
    if (!isOpen) return;

    const updatePanelPosition = () => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect) return;

      const gap = 12;
      const viewportPadding = 12;
      const preferredWidth = window.innerWidth >= 1024 ? 384 : 320;
      const width = Math.min(preferredWidth, window.innerWidth - viewportPadding * 2);
      const hasRightSpace = window.innerWidth - rect.right - gap >= width;
      const left = hasRightSpace
        ? rect.right + gap
        : Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - width - viewportPadding);
      const top = hasRightSpace ? rect.top : rect.bottom + 8;

      setPanelPosition({
        left,
        top: Math.max(viewportPadding, Math.min(top, window.innerHeight - 120)),
        width,
      });
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) return;
      if (cardRef.current?.contains(target) || panelRef.current?.contains(target)) return;

      setIsOpen(false);
    };

    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);

    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
    };
  }, [isOpen]);

  if (people.length === 0) {
    return <EmptyOfficeCard emptyText={emptyText} />;
  }

  const visiblePeople = people.slice(0, visibleCount);
  const otherPeople = people.slice(visibleCount);
  const panelId = `${title}-other-office-people`;
  const panel = isOpen ? (
    <div ref={panelRef} className="fixed z-[100]" style={{ left: panelPosition.left, top: panelPosition.top, width: panelPosition.width }}>
      <div className="pixel-corners border border-accent/45 bg-panel/95 p-3 shadow-[0_16px_0_rgba(0,0,0,0.28)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-accent">{t('office.otherTitle', { title })}</p>
          <button
            type="button"
            aria-label={t('office.closeList', { title })}
            onClick={() => setIsOpen(false)}
            className="pixel-corners border border-line/70 bg-bg/50 px-2 py-1 text-xs text-slate-300 hover:border-accent/55 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/35"
          >
            X
          </button>
        </div>
        <div id={panelId} className="grid max-h-80 gap-2 overflow-y-auto pr-1">
          {otherPeople.map((person) => (
            <PersonOfficeLink key={person.person_id} person={person} dense showRoleLabel={false} />
          ))}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <section ref={cardRef} className="pixel-corners relative border border-line/70 bg-bg/35 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{title}</p>
        <span className="pixel-corners border border-line/70 bg-panelAlt/45 px-2 py-1 text-[11px] text-slate-300">
          {t('common.peopleCount', { count: people.length })}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {visiblePeople.map((person) => (
          <PersonOfficeLink key={person.person_id} person={person} dense showRoleLabel={false} />
        ))}
      </div>
      {otherPeople.length > 0 ? (
        <button
          type="button"
          aria-controls={panelId}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          className="pixel-corners mt-2 w-full border border-line/60 bg-panelAlt/30 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-accent/55 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/35"
        >
          {isOpen ? t('office.collapseOthers') : t('office.showMorePeople', { count: otherPeople.length })}
        </button>
      ) : null}
      {typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null}
    </section>
  );
}

function PartyCountCard({ summary, party, count }: { summary: PublicLocalOfficeSummary; party: string; count: number }) {
  const { t } = useI18n();
  const theme = partyTheme[toPartyThemeKey(party)];

  return (
    <Link
      to={peoplePath({ region: summary.region_id, party, role: 'councilor', status: 'current' })}
      className="pixel-corners border p-3 transition hover:-translate-y-0.5 hover:shadow-[0_8px_0_rgba(0,0,0,0.22)] focus:outline-none focus:ring-2 focus:ring-accent/35"
      style={{ borderColor: theme.accent, backgroundColor: `${theme.primary}2E` }}
    >
      <p className="theme-party-text text-xs uppercase tracking-[0.2em]" style={{ color: theme.accent }}>
        {t('office.councilors')}
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <span className="text-sm text-white">{party}</span>
        <span className="theme-party-text font-display text-2xl leading-none" style={{ color: theme.text }}>
          {count}
        </span>
      </div>
    </Link>
  );
}

export function LocalOfficeSummaryPanel({ regionId }: LocalOfficeSummaryPanelProps) {
  const { t } = useI18n();
  const [summary, setSummary] = useState(() => publicDataProvider.getLocalOfficeSummaryByRegionId(regionId));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setSummary(publicDataProvider.getLocalOfficeSummaryByRegionId(regionId));
    setLoading(true);

    void refreshConfiguredPublicDataProvider()
      .then(() => publicDataProvider.loadLocalOfficeSummaryByRegionId(regionId))
      .then((nextSummary) => {
        if (active) {
          setSummary(nextSummary);
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoading(false);
          if (import.meta.env.DEV) {
            console.warn('Failed to load local office summary', error);
          }
        }
      });

    return () => {
      active = false;
    };
  }, [regionId]);

  const hasCouncilors = summary.councilor_party_counts.length > 0;

  return (
    <PixelFrame
      title={t('office.title')}
      action={
        loading ? (
          <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{t('office.loading')}</span>
        ) : (
          <Link
            to={peoplePath({ region: summary.region_id, status: 'current' })}
            className="text-[11px] uppercase tracking-[0.22em] text-accent hover:text-white"
          >
            {t('office.viewPeople')}
          </Link>
        )
      }
      className="overflow-visible [background:var(--theme-panel-gradient)]"
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{t('office.currentLocalOffice')}</p>
          <h2 className="mt-1 font-display text-2xl text-white">{summary.region_name}</h2>
        </div>
        <Link
          to={peoplePath({ region: summary.region_id, role: 'councilor', status: 'current' })}
          className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-right text-xs text-slate-300 hover:border-accent/55 hover:text-white"
        >
          {t('office.councilorTotal')}
          <span className="ml-2 font-display text-lg text-signal">{summary.councilor_total}</span>
        </Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="grid gap-3">
          <PersonOfficeCard title={t('people.role.local_chief')} person={summary.chief_executive} emptyText={t('office.emptyChief')} />
          <PersonOfficeGroupCard
            title={t('office.deputyChiefs')}
            people={summary.deputies}
            emptyText={t('office.emptyDeputies')}
            visibleCount={1}
          />
        </div>
        <PersonOfficeGroupCard title={t('office.agencyHeads')} people={summary.agency_heads} emptyText={t('office.emptyAgencyHeads')} />
      </div>

      <div className="mt-3">
        <p className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">{t('office.councilorPartyCards')}</p>
        {hasCouncilors ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {summary.councilor_party_counts.map((item) => (
              <PartyCountCard key={item.party} summary={summary} party={item.party} count={item.count} />
            ))}
          </div>
        ) : (
          <div className="pixel-corners border border-line/70 bg-bg/35 px-3 py-3 text-sm text-slate-300">
            {t('office.emptyCouncilors')}
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {summary.data_status.map((item) => (
          <div key={item.label} className="pixel-corners border border-line/60 bg-panelAlt/35 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">{item.label}</span>
              <span className={item.status === 'available' ? 'text-xs text-signal' : 'text-xs text-slate-500'}>
                {item.status === 'available' ? t('office.available') : t('office.todo')}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{item.note}</p>
          </div>
        ))}
      </div>
    </PixelFrame>
  );
}
