export function AppHeader() {
  return (
    <header className="pixel-corners relative overflow-hidden border border-line/70 bg-panel/70 px-4 py-5 shadow-pixel backdrop-blur-sm sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(56,189,248,0.06),transparent_42%,rgba(244,114,182,0.07))]" />

      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="font-display text-[11px] uppercase tracking-[0.35em] text-signal sm:text-xs">
            Arcade Civic Data
          </p>
          <h1 className="mt-3 font-display text-3xl leading-none text-white sm:text-4xl lg:text-5xl">
            公職資料觀測站
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
            選舉地圖 × 公開資料 × 可驗證關聯
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
          <div className="pixel-corners border border-line/70 bg-bg/40 px-4 py-3">
            <p className="font-display text-[11px] uppercase tracking-[0.28em] text-accent">Signal</p>
            <p className="mt-2 text-sm text-slate-200">首頁以夜間 HUD 視覺呈現，但資訊表達維持中性可讀。</p>
          </div>
          <div className="pixel-corners border border-line/70 bg-bg/40 px-4 py-3">
            <p className="font-display text-[11px] uppercase tracking-[0.28em] text-accent">Read Scope</p>
            <p className="mt-2 text-sm text-slate-200">前端目前只展示 mock public views 形狀，不連資料庫。</p>
          </div>
        </div>
      </div>
    </header>
  );
}
