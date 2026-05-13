import type { ReactNode } from 'react';

type HudStatCardProps = {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  className?: string;
};

export function HudStatCard({ label, value, note, className = '' }: HudStatCardProps) {
  return (
    <div className={`pixel-corners border border-line/70 bg-bg/38 p-4 ${className}`}>
      <dt className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</dt>
      <dd className="mt-2 text-white">{value}</dd>
      {note ? <p className="mt-2 text-xs text-slate-400">{note}</p> : null}
    </div>
  );
}
