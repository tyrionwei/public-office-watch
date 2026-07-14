import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useI18n } from '../i18n';
import { aboutPath, dataGuidancePath, electionsPath, homePath, partiesPath, peoplePath } from '../routes/routePaths';
import { GlobalSearch } from './GlobalSearch';

type AppHeaderProps = {
  rightSlot?: ReactNode;
};

const navItems = [
  { labelKey: 'nav.home', mark: '⌂', to: homePath(), end: true },
  { labelKey: 'nav.people', mark: '◎', to: peoplePath(), end: false },
  { labelKey: 'nav.elections', mark: '◇', to: electionsPath(), end: false },
  { labelKey: 'nav.parties', mark: '▧', to: partiesPath(), end: false },
  { labelKey: 'nav.dataGuidance', mark: '▣', to: dataGuidancePath(), end: false },
  { labelKey: 'nav.about', mark: 'i', to: aboutPath(), end: false },
] as const;

export function AppHeader({ rightSlot }: AppHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="relative z-50 px-3 py-3 sm:px-4">
      <div className="pixel-corners pointer-events-none absolute inset-0 border border-line/80 bg-[#071126]/90 shadow-pixel backdrop-blur-sm" />
      <div className="pixel-corners pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(114,232,255,0.08),transparent_35%,rgba(244,211,94,0.08))]" />

      <div className="relative">
        <div className="grid gap-3 2xl:grid-cols-[minmax(260px,0.72fr)_minmax(340px,0.9fr)_auto_auto] 2xl:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              to={homePath()}
              className="pixel-corners grid h-16 w-16 shrink-0 place-items-center border border-accent/50 bg-bg/60 text-center shadow-[inset_0_0_22px_rgba(114,232,255,0.12)] focus:outline-none focus:ring-2 focus:ring-accent/35"
              aria-label={t('nav.homeAria')}
            >
              <span className="font-display text-lg leading-none text-signal">POW</span>
            </Link>
            <div className="min-w-0">
              <Link to={homePath()} className="inline-block focus:outline-none focus:ring-2 focus:ring-accent/35">
                <h1 className="font-display text-2xl leading-none text-white sm:text-3xl">
                  {t('brand.name')}
                </h1>
              </Link>
              <p className="mt-1 font-display text-xs uppercase tracking-[0.26em] text-accent">
                {t('brand.subtitle')}
              </p>
            </div>
          </div>

          <div className="min-w-0 2xl:justify-self-center 2xl:w-full 2xl:max-w-[560px]">
            <GlobalSearch />
          </div>

          <nav className="grid grid-cols-2 gap-2 sm:grid-cols-6 2xl:flex 2xl:items-stretch" aria-label={t('nav.mainAria')}>
            {navItems.map((item) => (
              <NavLink
                key={item.labelKey}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'pixel-corners flex min-h-12 min-w-[104px] flex-col items-center justify-center gap-1 border px-3 py-2 text-center transition focus:outline-none focus:ring-2 focus:ring-accent/35',
                    isActive
                      ? 'border-accent bg-accent/14 text-white shadow-[0_0_16px_rgba(114,232,255,0.16)]'
                      : 'border-line/80 bg-bg/38 text-slate-300 hover:border-accent/45 hover:text-white',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={isActive ? 'text-signal' : 'text-slate-500'}>{item.mark}</span>
                    <span className="text-[11px] leading-tight">{t(item.labelKey)}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {rightSlot ? <div className="w-full max-w-[300px] justify-self-end">{rightSlot}</div> : null}
        </div>
      </div>
    </header>
  );
}
