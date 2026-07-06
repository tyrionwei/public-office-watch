import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { publicDataProvider } from '../lib/publicData';
import { getPersonDisplayPosition, normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { peoplePath, personPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicLocalOfficeSummary, PublicPersonListItem } from '../types/publicViews';
import { PixelFrame } from './PixelFrame';

type LocalOfficeSummaryPanelProps = {
  regionId: string;
};

function EmptyOfficeCard({ emptyText }: { emptyText: string }) {
  return (
    <div className="pixel-corners border border-line/70 bg-bg/35 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">source todo</p>
      <p className="mt-2 text-sm text-slate-300">{emptyText}</p>
    </div>
  );
}

function PersonOfficeLink({ person, dense = false }: { person: PublicPersonListItem; dense?: boolean }) {
  const theme = partyTheme[toPartyThemeKey(person.party)];
  const subtitle = getPersonDisplayPosition(person, '現任公職');
  const linkClassName = dense
    ? 'pixel-corners flex items-start justify-between gap-3 border border-line/70 bg-bg/40 px-3 py-2 transition hover:border-accent/60 hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/35'
    : 'pixel-corners block border border-line/70 bg-bg/40 p-3 transition hover:border-accent/60 hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/35';

  return (
    <Link to={personPath(person.person_id)} className={linkClassName}>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{person.role_label}</p>
        <h3 className={dense ? 'mt-1 truncate font-display text-lg text-white' : 'mt-2 font-display text-xl text-white'}>
          {person.name}
        </h3>
        <p className={dense ? 'mt-1 line-clamp-2 text-xs text-slate-400' : 'mt-1 text-sm text-slate-400'}>
          {subtitle}
        </p>
      </div>
      <span
        className="pixel-corners shrink-0 border px-2 py-1 text-[11px]"
        style={{ borderColor: theme.accent, backgroundColor: `${theme.primary}33`, color: theme.text }}
      >
        {normalizePartyLabel(person.party)}
      </span>
    </Link>
  );
}

function PersonOfficeCard({ person, emptyText }: { person: PublicPersonListItem | null; emptyText: string }) {
  if (!person) {
    return <EmptyOfficeCard emptyText={emptyText} />;
  }

  return <PersonOfficeLink person={person} />;
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
      <div className="pixel-corners border border-accent/45 bg-panel/95 p-3 shadow-[0_16px_0_rgba(0,0,0,0.28)] backdrop-blur-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-accent">其他{title}</p>
          <button
            type="button"
            aria-label={`關閉${title}清單`}
            onClick={() => setIsOpen(false)}
            className="pixel-corners border border-line/70 bg-bg/50 px-2 py-1 text-xs text-slate-300 hover:border-accent/55 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/35"
          >
            X
          </button>
        </div>
        <div id={panelId} className="grid max-h-80 gap-2 overflow-y-auto pr-1">
          {otherPeople.map((person) => (
            <PersonOfficeLink key={person.person_id} person={person} dense />
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
          {people.length} 位
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {visiblePeople.map((person) => (
          <PersonOfficeLink key={person.person_id} person={person} dense />
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
          {isOpen ? '收回其他人員' : `顯示另外 ${otherPeople.length} 位`}
        </button>
      ) : null}
      {typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null}
    </section>
  );
}

function PartyCountCard({ summary, party, count }: { summary: PublicLocalOfficeSummary; party: string; count: number }) {
  const theme = partyTheme[toPartyThemeKey(party)];

  return (
    <Link
      to={peoplePath({ region: summary.region_id, party, role: 'councilor', status: 'current' })}
      className="pixel-corners border p-3 transition hover:-translate-y-0.5 hover:shadow-[0_8px_0_rgba(0,0,0,0.22)] focus:outline-none focus:ring-2 focus:ring-accent/35"
      style={{ borderColor: theme.accent, backgroundColor: `${theme.primary}2E` }}
    >
      <p className="text-xs uppercase tracking-[0.2em]" style={{ color: theme.accent }}>
        councilors
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <span className="text-sm text-white">{party}</span>
        <span className="font-display text-2xl leading-none" style={{ color: theme.text }}>
          {count}
        </span>
      </div>
    </Link>
  );
}

export function LocalOfficeSummaryPanel({ regionId }: LocalOfficeSummaryPanelProps) {
  const summary = publicDataProvider.getLocalOfficeSummaryByRegionId(regionId);
  const hasCouncilors = summary.councilor_party_counts.length > 0;

  return (
    <PixelFrame
      title="縣市公職摘要"
      action={
        <Link
          to={peoplePath({ region: summary.region_id, status: 'current' })}
          className="text-[11px] uppercase tracking-[0.22em] text-accent hover:text-white"
        >
          view people
        </Link>
      }
      className="overflow-visible bg-[linear-gradient(180deg,rgba(12,18,36,0.96),rgba(8,15,30,0.92))]"
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">selected local office</p>
          <h2 className="mt-1 font-display text-2xl text-white">{summary.region_name}</h2>
        </div>
        <Link
          to={peoplePath({ region: summary.region_id, role: 'councilor', status: 'current' })}
          className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-right text-xs text-slate-300 hover:border-accent/55 hover:text-white"
        >
          議員總數
          <span className="ml-2 font-display text-lg text-signal">{summary.councilor_total}</span>
        </Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="grid gap-3">
          <PersonOfficeCard person={summary.chief_executive} emptyText="尚未找到可公開的現任縣市首長資料。" />
          <PersonOfficeGroupCard
            title="副縣市首長"
            people={summary.deputies}
            emptyText="地方政府名冊待同步：副縣市長資料尚未接入。"
            visibleCount={1}
          />
        </div>
        <PersonOfficeGroupCard title="主要單位首長" people={summary.agency_heads} emptyText="局處首長資料待同步。" />
      </div>

      <div className="mt-3">
        <p className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">councilor party cards</p>
        {hasCouncilors ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {summary.councilor_party_counts.map((item) => (
              <PartyCountCard key={item.party} summary={summary} party={item.party} count={item.count} />
            ))}
          </div>
        ) : (
          <div className="pixel-corners border border-line/70 bg-bg/35 px-3 py-3 text-sm text-slate-300">
            尚未找到可公開的現任議員資料；後續會接地方選舉異動與地方政府名冊校正。
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {summary.data_status.map((item) => (
          <div key={item.label} className="pixel-corners border border-line/60 bg-panelAlt/35 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">{item.label}</span>
              <span className={item.status === 'available' ? 'text-xs text-signal' : 'text-xs text-slate-500'}>
                {item.status === 'available' ? '已接入' : '待同步'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{item.note}</p>
          </div>
        ))}
      </div>
    </PixelFrame>
  );
}
