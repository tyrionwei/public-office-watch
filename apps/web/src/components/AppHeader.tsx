import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { homePath } from '../routes/routePaths';

type AppHeaderProps = {
  rightSlot?: ReactNode;
};

const navItems = [
  { label: '首頁', mark: '⌂', active: true },
  { label: '選舉地圖', mark: '▧' },
  { label: '搜尋', mark: '⌕' },
  { label: '資料來源', mark: '▣' },
  { label: '可信度分級', mark: '★' },
  { label: '關於本站', mark: 'i' },
];

export function AppHeader({ rightSlot }: AppHeaderProps) {
  return (
    <header className="pixel-corners relative overflow-hidden border border-line/80 bg-[#071126]/90 px-3 py-3 shadow-pixel backdrop-blur-sm sm:px-4">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(114,232,255,0.08),transparent_35%,rgba(244,211,94,0.08))]" />

      <div className="relative flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            to={homePath()}
            className="pixel-corners grid h-16 w-16 shrink-0 place-items-center border border-accent/50 bg-bg/60 text-center shadow-[inset_0_0_22px_rgba(114,232,255,0.12)] focus:outline-none focus:ring-2 focus:ring-accent/35"
            aria-label="回到首頁"
          >
            <span className="font-display text-lg leading-none text-signal">POW</span>
          </Link>
          <div className="min-w-0">
            <Link to={homePath()} className="inline-block focus:outline-none focus:ring-2 focus:ring-accent/35">
              <h1 className="font-display text-2xl leading-none text-white sm:text-3xl">
                公職資料觀測站
              </h1>
            </Link>
            <p className="mt-1 font-display text-xs uppercase tracking-[0.26em] text-accent">
              Public Office Watch
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch">
          <nav className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="主導覽">
            {navItems.map((item) => (
              <span
                key={item.label}
                className={[
                  'pixel-corners flex min-h-14 min-w-[88px] flex-col items-center justify-center gap-1 border px-3 py-2 text-center',
                  item.active
                    ? 'border-accent bg-accent/14 text-white shadow-[0_0_16px_rgba(114,232,255,0.16)]'
                    : 'border-line/80 bg-bg/38 text-slate-300',
                ].join(' ')}
              >
                <span className={item.active ? 'text-signal' : 'text-slate-500'}>{item.mark}</span>
                <span className="text-[11px] leading-tight">{item.label}</span>
              </span>
            ))}
          </nav>
          {rightSlot ? <div className="min-w-[230px] xl:max-w-[280px]">{rightSlot}</div> : null}
        </div>
      </div>
    </header>
  );
}
