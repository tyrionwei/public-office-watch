import { PixelFrame } from './PixelFrame';

export function SearchCommand() {
  return (
    <PixelFrame title="Search Command">
      <div className="space-y-3">
        <label className="block text-sm text-slate-300" htmlFor="search-command">
          搜尋人物、公司、選舉項目
        </label>
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            id="search-command"
            type="text"
            placeholder="例如：範例市長選舉、測試人物A、北部都會區"
            className="w-full rounded-sm border border-line bg-bg px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-slate-500 focus:border-accent"
          />
          <button
            type="button"
            className="rounded-sm border border-accent bg-accent/10 px-5 py-3 font-display text-sm uppercase tracking-[0.18em] text-accent"
          >
            Search
          </button>
        </div>
        <p className="text-xs text-slate-400">目前為前端骨架 placeholder，未連接任何實際查詢 API。</p>
      </div>
    </PixelFrame>
  );
}
