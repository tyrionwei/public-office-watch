import { PixelFrame } from './PixelFrame';

type NextEventTickerProps = {
  title: string;
  subtitle: string;
  date: string;
};

export function NextEventTicker({ title, subtitle, date }: NextEventTickerProps) {
  return (
    <PixelFrame title="Next Event Ticker" className="bg-gradient-to-r from-panel via-panelAlt to-panel">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-lg text-white">{title}</p>
          <p className="text-sm text-slate-300">{subtitle}</p>
        </div>
        <div className="rounded-sm border border-accent/40 bg-bg/50 px-4 py-2 text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Voting date</p>
          <p className="font-display text-xl text-signal">{date}</p>
        </div>
      </div>
    </PixelFrame>
  );
}
