type NextEventTickerProps = {
  title: string;
  subtitle: string;
  date: string;
};

export function NextEventTicker({ title, subtitle, date }: NextEventTickerProps) {
  return (
    <section className="pixel-corners relative overflow-hidden border border-line/80 bg-[#071126]/92 px-3 py-2 shadow-[0_0_0_2px_rgba(114,232,255,0.14)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,79,216,0.08),transparent_18%,transparent_82%,rgba(255,79,216,0.08))]" />
      <div className="relative flex min-h-9 flex-wrap items-center gap-x-5 gap-y-2 text-sm sm:flex-nowrap">
        <span className="pixel-corners shrink-0 border border-red-400/45 bg-red-500/12 px-2 py-1 font-display text-[11px] uppercase tracking-[0.18em] text-signal">
          NEXT EVENT
        </span>
        <span className="min-w-0 font-display text-base leading-tight text-white sm:truncate">
          {title}
        </span>
        <span className="hidden h-4 w-px shrink-0 bg-slate-500 sm:block" aria-hidden="true" />
        <span className="shrink-0 text-slate-200">
          投票日：<span className="font-display text-signal">{date}</span>
        </span>
        <span className="hidden h-4 w-px shrink-0 bg-slate-500 sm:block" aria-hidden="true" />
        <span className="min-w-0 text-slate-300 sm:truncate">{subtitle}</span>
      </div>
    </section>
  );
}
