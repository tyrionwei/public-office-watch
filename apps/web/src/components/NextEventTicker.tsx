import { PixelFrame } from './PixelFrame';

type NextEventTickerProps = {
  title: string;
  subtitle: string;
  date: string;
};

export function NextEventTicker({ title, subtitle, date }: NextEventTickerProps) {
  return (
    <PixelFrame
      title="Next Event"
      className="bg-[linear-gradient(135deg,rgba(7,18,36,0.96),rgba(20,31,59,0.92)_55%,rgba(31,41,79,0.88))]"
      action={
        <span className="rounded-sm border border-accent/40 bg-accent/10 px-2 py-1 font-display text-[10px] uppercase tracking-[0.24em] text-accent">
          Public notice feed
        </span>
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 overflow-hidden">
          <div className="ticker-track flex min-w-max items-center gap-4 pr-8">
            <span className="rounded-sm border border-signal/35 bg-signal/10 px-2 py-1 font-display text-[10px] uppercase tracking-[0.24em] text-signal">
              NEXT EVENT
            </span>
            <p className="font-display text-lg text-white sm:text-xl">{title}</p>
            <span className="h-2 w-2 shrink-0 rounded-none bg-fuchsia-400" aria-hidden="true" />
            <p className="text-sm text-slate-300">{subtitle}</p>
            <span className="h-2 w-2 shrink-0 rounded-none bg-cyan-300" aria-hidden="true" />
            <p className="text-sm text-slate-400">來源 / 公開公告整理</p>
          </div>
        </div>

        <div className="pixel-corners shrink-0 border border-accent/40 bg-bg/60 px-4 py-3 text-left sm:min-w-[180px] sm:text-right">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Voting date</p>
          <p className="mt-1 font-display text-xl text-signal sm:text-2xl">{date}</p>
        </div>
      </div>
    </PixelFrame>
  );
}
