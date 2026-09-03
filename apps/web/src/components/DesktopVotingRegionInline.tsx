import { Link } from 'react-router-dom';
import { selectNextElectionVotingCycle } from '../data/electionVotingCycles';
import { useI18n } from '../i18n';
import { buildCecPollingPlaceLookupUrl } from '../lib/cecPollingPlaceLookup';
import type { HomeTicker } from '../lib/publicDataProvider';
import { useVotingRegion } from '../votingRegion';

type DesktopVotingRegionInlineProps = {
  onOpenEditor: () => void;
  ticker: HomeTicker;
};

export function DesktopVotingRegionInline({ onOpenEditor, ticker }: DesktopVotingRegionInlineProps) {
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
  const pollingPlaceLookupUrl = votingCycle?.pollingPlaceLookupUrl
    ? buildCecPollingPlaceLookupUrl(votingCycle.pollingPlaceLookupUrl, preference)
    : null;

  return (
    <div data-desktop-voting-region className="hidden shrink-0 items-center gap-2 md:flex">
      <span className="text-[10px] uppercase tracking-[0.14em] text-accent">{isEnglish ? 'VOTING AREA' : '戶籍'}</span>
      <span className="max-w-48 truncate text-xs font-semibold text-slate-100" title={preferenceLabel}>{preferenceLabel}</span>
      <Link
        to={{ pathname: '/', search: `?region=${encodeURIComponent(preference.county.id)}` }}
        className="inline-flex min-h-9 items-center border border-line px-2.5 text-xs text-slate-200 hover:border-accent/55 hover:text-accent"
      >
        {isEnglish ? `Browse ${preference.county.name}` : `切到${preference.county.name}`}
      </Link>
      <button type="button" onClick={onOpenEditor} className="min-h-9 px-2 text-xs text-accent underline underline-offset-4">
        {isEnglish ? 'Change' : '變更'}
      </button>
      {pollingPlaceLookupUrl ? (
        <a href={pollingPlaceLookupUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center border border-signal/60 bg-signal/8 px-2.5 text-xs font-semibold text-signal">
          {isEnglish ? 'Polling place ↗' : '投票所 ↗'}
        </a>
      ) : null}
    </div>
  );
}
