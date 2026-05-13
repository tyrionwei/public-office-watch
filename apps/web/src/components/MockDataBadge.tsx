type MockDataBadgeProps = {
  label?: string;
};

export function MockDataBadge({ label = 'UI 測試資料' }: MockDataBadgeProps) {
  return (
    <span className="inline-flex rounded-sm border border-signal/35 bg-signal/10 px-2 py-1 font-display text-[10px] uppercase tracking-[0.22em] text-signal">
      {label}
    </span>
  );
}
