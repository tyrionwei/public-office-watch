type BgmToggleProps = {
  enabled: boolean;
  onToggle: () => void;
};

export function BgmToggle({ enabled, onToggle }: BgmToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      className="flex items-center gap-3 rounded-sm border border-line bg-panelAlt/80 px-4 py-3 text-left text-sm text-slate-200"
    >
      <span className={`inline-block h-3 w-3 rounded-none ${enabled ? 'bg-success' : 'bg-slate-500'}`} aria-hidden="true" />
      <span>
        <span className="block font-display text-xs uppercase tracking-[0.18em] text-accent">BGM</span>
        <span className="block">{enabled ? 'On' : 'Off'} · Volume 12%</span>
      </span>
    </button>
  );
}
