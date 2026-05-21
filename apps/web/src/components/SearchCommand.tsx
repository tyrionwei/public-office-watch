import { PixelFrame } from './PixelFrame';

type SearchCommandProps = {
  selectedRegionLabel: string;
};

export function SearchCommand({ selectedRegionLabel }: SearchCommandProps) {
  const quickSearches = ['臺北市長', '新北市長', '立法委員', '民主進步黨', '中國國民黨'];

  return (
    <PixelFrame
      title="Search Command"
    >
      <div className="space-y-3">
        <label className="sr-only" htmlFor="search-command">
          搜尋人物、公司、選舉項目、地區
        </label>
        <div className="grid gap-2">
          <input
            id="search-command"
            type="text"
            placeholder="搜尋人物、公司、統編、選舉項目..."
            className="pixel-corners w-full border border-line bg-bg/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <p className="text-xs text-accent">目前範圍：{selectedRegionLabel}</p>
        </div>

        <div>
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-success">熱門搜尋</p>
          <div className="flex flex-wrap gap-2">
            {quickSearches.map((item) => (
              <button
                key={item}
                type="button"
                className="pixel-corners border border-line/80 bg-bg/55 px-3 py-1.5 text-xs text-slate-200 transition hover:border-accent/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/25"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
    </PixelFrame>
  );
}
