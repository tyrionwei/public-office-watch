type PageNoticeProps = {
  title: string;
  bullets: string[];
};

export function PageNotice({ title, bullets }: PageNoticeProps) {
  return (
    <div className="pixel-corners border border-line/70 bg-panelAlt/45 p-4">
      <p className="font-display text-[11px] uppercase tracking-[0.24em] text-accent">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-slate-300">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex gap-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-none bg-signal" aria-hidden="true" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
