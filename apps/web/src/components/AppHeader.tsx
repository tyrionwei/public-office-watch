export function AppHeader() {
  return (
    <header className="flex flex-col gap-3 border-b border-line/60 pb-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-signal">Arcade Civic Data</p>
        <h1 className="mt-2 font-display text-3xl text-white md:text-4xl">公職資料觀測站</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300 md:text-base">
          選舉地圖 × 公開資料 × 可驗證關聯
        </p>
      </div>
      <div className="rounded-sm border border-line bg-panelAlt/80 px-4 py-3 text-sm text-slate-300">
        <p className="font-display text-xs uppercase tracking-[0.2em] text-accent">Neutral public data platform</p>
        <p className="mt-1">視覺採 arcade 語言，資料呈現維持中性、可追溯、可讀。</p>
      </div>
    </header>
  );
}
