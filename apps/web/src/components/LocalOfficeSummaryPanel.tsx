import { Link } from 'react-router-dom';
import { publicDataProvider } from '../lib/publicData';
import { normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { peoplePath, personPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicLocalOfficeSummary, PublicPersonListItem } from '../types/publicViews';
import { PixelFrame } from './PixelFrame';

type LocalOfficeSummaryPanelProps = {
  regionId: string;
};

function PersonOfficeCard({ person, emptyText }: { person: PublicPersonListItem | null; emptyText: string }) {
  if (!person) {
    return (
      <div className="pixel-corners border border-line/70 bg-bg/35 p-3">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">source todo</p>
        <p className="mt-2 text-sm text-slate-300">{emptyText}</p>
      </div>
    );
  }

  const theme = partyTheme[toPartyThemeKey(person.party)];

  return (
    <Link
      to={personPath(person.person_id)}
      className="pixel-corners block border border-line/70 bg-bg/40 p-3 transition hover:border-accent/60 hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/35"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{person.role_label}</p>
          <h3 className="mt-2 font-display text-xl text-white">{person.name}</h3>
          <p className="mt-1 text-sm text-slate-400">{person.position ?? '現任公職'}</p>
        </div>
        <span
          className="pixel-corners shrink-0 border px-2 py-1 text-[11px]"
          style={{ borderColor: theme.accent, backgroundColor: `${theme.primary}33`, color: theme.text }}
        >
          {normalizePartyLabel(person.party)}
        </span>
      </div>
    </Link>
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
      className="bg-[linear-gradient(180deg,rgba(12,18,36,0.96),rgba(8,15,30,0.92))]"
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

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <PersonOfficeCard person={summary.chief_executive} emptyText="尚未找到可公開的現任縣市首長資料。" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <PersonOfficeCard person={summary.deputies[0] ?? null} emptyText="地方政府名冊待同步：副縣市長資料尚未接入。" />
          <PersonOfficeCard person={summary.agency_heads[0] ?? null} emptyText="局處首長資料待同步。" />
        </div>
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
