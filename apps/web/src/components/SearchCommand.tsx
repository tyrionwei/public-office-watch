import { PixelFrame } from './PixelFrame';

type SearchCommandProps = {
  selectedRegionLabel: string;
};

export function SearchCommand({ selectedRegionLabel }: SearchCommandProps) {
  return (
    <PixelFrame
      title="Search Command"
      action={
        <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">mock input only</span>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm text-slate-300" htmlFor="search-command">
            搜尋人物、公司、選舉項目、地區
          </label>
          <p className="text-xs text-slate-500">目前僅展示 HUD 搜尋介面，不連接任何實際查詢 API。</p>
          <p className="text-xs text-accent">目前範圍：{selectedRegionLabel}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <input
            id="search-command"
            type="text"
            placeholder="例如：範例市長選舉、範例公司甲、北部都會區"
            className="pixel-corners w-full border border-line bg-bg/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="button"
            className="pixel-corners border border-accent/70 bg-accent/12 px-5 py-3 font-display text-sm uppercase tracking-[0.24em] text-accent transition hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            Search
          </button>
        </div>
      </div>
    </PixelFrame>
  );
}
