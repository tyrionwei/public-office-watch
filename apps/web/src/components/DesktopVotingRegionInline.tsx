import { Link } from 'react-router-dom';
import { selectNextElectionVotingCycle } from '../data/electionVotingCycles';
import { useI18n } from '../i18n';
import type { HomeTicker } from '../lib/publicDataProvider';
import { useVotingRegion } from '../votingRegion';

type DesktopVotingRegionInlineProps = {
  onOpenEditor: () => void;
  onOpenPollingPlace?: () => void;
  pollingPlaceOpen?: boolean;
  ticker: HomeTicker;
};

export function DesktopVotingRegionInline({ onOpenEditor, onOpenPollingPlace, pollingPlaceOpen = false, ticker }: DesktopVotingRegionInlineProps) {
  const { language } = useI18n();
  const { preference } = useVotingRegion();
  const isEnglish = language === 'en';

  if (!preference) {
    return (
      <div data-desktop-voting-region className="hidden shrink-0 items-center gap-2 md:flex">
        <span className="text-xs text-slate-400">{isEnglish ? 'Voting area not set' : '尚未設定投票地區'}</span>
        <button type="button" onClick={onOpenEditor} className="min-h-9 border border-accent/65 bg-accent/8 px-3 text-xs font-semibold text-accent">
          {isEnglish ? 'Set' : '設定'}
        </button>
      </div>
    );
  }

  const preferenceLabel = [preference.county.name, preference.district?.name, preference.village?.name]
    .filter(Boolean)
    .join(' ');
  const votingCycle = selectNextElectionVotingCycle(preference, ticker.date);
  const canOpenPollingPlace = votingCycle?.pollingPlaceStatus === 'lookup-available'
    && Boolean(votingCycle.pollingPlaceLookupUrl)
    && Boolean(onOpenPollingPlace);

  return (
    <div data-desktop-voting-region className="hidden shrink-0 items-center gap-2 md:flex">
      <button
        type="button"
        onClick={onOpenEditor}
        className="inline-flex min-h-9 items-center border border-line px-2.5 text-xs text-slate-200 hover:border-accent/55 hover:text-accent"
      >
        {isEnglish ? 'Change' : '變更'}
      </button>
      <span className="text-[10px] uppercase tracking-[0.14em] text-accent">{isEnglish ? 'VOTING AREA' : '投票地區'}</span>
      <span className="max-w-48 truncate text-xs font-semibold text-slate-100" title={preferenceLabel}>{preferenceLabel}</span>
      <Link
        to={{ pathname: '/', search: `?region=${encodeURIComponent(preference.county.id)}` }}
        className="inline-flex min-h-9 items-center border border-line px-2.5 text-xs text-slate-200 hover:border-accent/55 hover:text-accent"
      >
        {isEnglish ? `Browse ${preference.county.name}` : `切到${preference.county.name}`}
      </Link>
      {canOpenPollingPlace ? (
        <button type="button" onClick={onOpenPollingPlace} aria-expanded={pollingPlaceOpen} className="inline-flex min-h-9 items-center border border-signal/60 bg-signal/8 px-2.5 text-xs font-semibold text-signal">
          {isEnglish ? 'View polling places' : '查看投開票所'}
        </button>
      ) : null}
    </div>
  );
}
