import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { electionPath } from '../routes/routePaths';

type NextEventTickerProps = {
  title: string;
  date: string;
  electionId: string | null;
  rightSlot?: ReactNode;
};

const containerClassName = 'pixel-corners relative overflow-hidden border border-line/80 bg-panel/92 px-3 py-2 shadow-[0_0_0_2px_rgba(114,232,255,0.14)]';
const eventClassName = 'group/event flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35 sm:flex-nowrap';

export function NextEventTicker({ title, date, electionId, rightSlot }: NextEventTickerProps) {
  const { t } = useI18n();
  const eventContent = (
    <>
      <span className="pixel-corners shrink-0 border border-red-400/45 bg-red-500/12 px-2 py-1 font-display text-[11px] uppercase tracking-[0.18em] text-signal">
        NEXT EVENT
      </span>
      <span className="min-w-0 flex-1 font-display text-base leading-tight text-white transition group-hover/event:text-accent sm:truncate">
        {title}
      </span>
      <span className="hidden h-4 w-px shrink-0 bg-slate-500 sm:block" aria-hidden="true" />
      <span className="shrink-0 text-slate-200">
        {t('ticker.voteDate')}<span className="font-display text-signal">{date}</span>
      </span>
      <span className="hidden h-4 w-px shrink-0 bg-slate-500 xl:block" aria-hidden="true" />
      <span className="hidden min-w-0 text-slate-300 xl:block xl:truncate">{t('ticker.viewElection')}</span>
      {electionId ? <span className="shrink-0 text-accent" aria-hidden="true">→</span> : null}
    </>
  );

  return (
    <section data-next-event-ticker className={containerClassName}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,79,216,0.08),transparent_18%,transparent_82%,rgba(255,79,216,0.08))]" />
      <div className="relative flex min-h-9 items-center gap-3">
        {electionId ? (
          <Link to={electionPath(electionId)} className={eventClassName} aria-label={t('ticker.viewElectionAria', { title })}>
            {eventContent}
          </Link>
        ) : (
          <div className={eventClassName}>{eventContent}</div>
        )}
        {rightSlot ? (
          <>
            <span className="hidden h-5 w-px shrink-0 bg-line md:block" aria-hidden="true" />
            {rightSlot}
          </>
        ) : null}
      </div>
    </section>
  );
}
