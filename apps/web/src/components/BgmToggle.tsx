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
      className="pixel-corners flex w-full items-center gap-3 border border-line/80 bg-panelAlt/80 px-4 py-3 text-left text-sm text-slate-200 shadow-pixel backdrop-blur-sm"
    >
      <span
        className={[
          'inline-block h-3 w-3 rounded-none border border-white/10',
          enabled ? 'bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.55)]' : 'bg-slate-500',
        ].join(' ')}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[11px] uppercase tracking-[0.24em] text-accent">BGM Control</span>
        <span className="mt-1 block text-sm">{enabled ? 'On' : 'Off'} · Volume 12%</span>
      </span>
      <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">UI only</span>
    </button>
  );
}
