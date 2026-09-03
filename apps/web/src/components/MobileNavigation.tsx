import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import {
  aboutPath,
  dataGuidancePath,
  electionsPath,
  homePath,
  partiesPath,
  peoplePath,
  supportPath,
  updatesPath,
} from '../routes/routePaths';
import { openGlobalChatEvent } from './GlobalChatWidget';
import { GlobalSearch } from './GlobalSearch';

export type MobilePanel = 'explore' | 'search' | 'more' | null;

type MobileNavigationProps = {
  panel: MobilePanel;
  setPanel: (panel: MobilePanel) => void;
  onOpenVotingRegion: () => void;
};

const exploreItems = [
  { labelKey: 'nav.people', mark: '◎', to: peoplePath() },
  { labelKey: 'nav.elections', mark: '◇', to: electionsPath() },
  { labelKey: 'nav.parties', mark: '▧', to: partiesPath() },
] as const;

const moreItems = [
  { labelKey: 'nav.updates', to: updatesPath() },
  { labelKey: 'nav.dataGuidance', to: dataGuidancePath() },
  { labelKey: 'nav.about', to: aboutPath() },
  { labelKey: 'nav.support', to: supportPath() },
] as const;

export function MobileNavigation({ panel, setPanel, onOpenVotingRegion }: MobileNavigationProps) {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const exploreActive = pathname.startsWith('/people')
    || pathname.startsWith('/elections')
    || pathname.startsWith('/parties')
    || pathname.startsWith('/regions');

  useEffect(() => {
    if (!panel) return undefined;
    const mobileViewport = window.matchMedia('(max-width: 767px)');
    const previousOverflow = document.body.style.overflow;
    if (mobileViewport.matches) document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(null);
    };
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (!event.matches) setPanel(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    mobileViewport.addEventListener('change', handleViewportChange);
    if (panel !== 'search') closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      mobileViewport.removeEventListener('change', handleViewportChange);
    };
  }, [panel, setPanel]);

  const itemClass = (active: boolean) => [
    'flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-center transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/40',
    active ? 'text-white' : 'text-slate-500',
  ].join(' ');

  const openChat = () => {
    setPanel(null);
    window.dispatchEvent(new Event(openGlobalChatEvent));
  };

  return (
    <>
      <nav
        data-mobile-bottom-nav
        aria-label={t('nav.mobileAria')}
        className="fixed inset-x-0 bottom-0 z-[65] flex border-t border-accent/35 bg-panel/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(0,0,0,0.38)] backdrop-blur md:hidden"
      >
        <NavLink to={homePath()} end className={({ isActive }) => itemClass(isActive)}>
          {({ isActive }) => (
            <>
              <span aria-hidden="true" className={isActive ? 'text-signal' : 'text-slate-500'}>⌂</span>
              <span className="truncate text-[10px] leading-tight">{t('nav.mobileMyElection')}</span>
            </>
          )}
        </NavLink>
        <button type="button" onClick={() => setPanel('explore')} className={itemClass(exploreActive || panel === 'explore')}>
          <span aria-hidden="true" className={exploreActive || panel === 'explore' ? 'text-signal' : 'text-slate-500'}>◇</span>
          <span className="text-[10px] leading-tight">{t('nav.mobileExplore')}</span>
        </button>
        <button type="button" onClick={() => setPanel('search')} className={itemClass(panel === 'search')}>
          <span aria-hidden="true" className={panel === 'search' ? 'text-signal' : 'text-slate-500'}>⌕</span>
          <span className="text-[10px] leading-tight">{t('common.search')}</span>
        </button>
        <button type="button" onClick={openChat} className={itemClass(false)}>
          <span aria-hidden="true" className="text-slate-500">▤</span>
          <span className="text-[10px] leading-tight">{t('nav.mobileDiscussion')}</span>
        </button>
        <button type="button" onClick={() => setPanel('more')} className={itemClass(panel === 'more')}>
          <span aria-hidden="true" className={panel === 'more' ? 'text-signal' : 'text-slate-500'}>•••</span>
          <span className="text-[10px] leading-tight">{t('nav.mobileMore')}</span>
        </button>
      </nav>

      {panel ? (
        <div className="fixed inset-0 z-[80] md:hidden">
          <button
            type="button"
            aria-label={t('nav.mobileClose')}
            onClick={() => setPanel(null)}
            className="absolute inset-0 bg-black/70"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label={panel === 'search' ? t('common.search') : panel === 'explore' ? t('nav.mobileExploreTitle') : t('nav.mobileMoreTitle')}
            className={panel === 'search'
              ? 'absolute inset-0 flex flex-col bg-panel px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]'
              : 'pixel-corners absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto border-2 border-accent/60 bg-panel px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_36px_rgba(0,0,0,0.48)]'}
          >
            <header className="mb-4 flex items-center justify-between gap-3 border-b border-line/70 pb-3">
              <h2 className="font-display text-lg text-white">
                {panel === 'search' ? t('common.search') : panel === 'explore' ? t('nav.mobileExploreTitle') : t('nav.mobileMoreTitle')}
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setPanel(null)}
                aria-label={t('nav.mobileClose')}
                className="grid h-11 w-11 place-items-center border border-line text-xl text-slate-300 focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                ×
              </button>
            </header>

            {panel === 'search' ? (
              <GlobalSearch id="mobile-global-search" autoFocus onNavigate={() => setPanel(null)} />
            ) : panel === 'explore' ? (
              <nav className="grid gap-2" aria-label={t('nav.mobileExploreTitle')}>
                {exploreItems.map((item) => (
                  <NavLink
                    key={item.labelKey}
                    to={item.to}
                    onClick={() => setPanel(null)}
                    className="pixel-corners flex min-h-14 items-center gap-3 border border-line/80 bg-bg/45 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                  >
                    <span className="text-accent" aria-hidden="true">{item.mark}</span>
                    <span>{t(item.labelKey)}</span>
                  </NavLink>
                ))}
              </nav>
            ) : (
              <div>
                <nav className="grid gap-2" aria-label={t('nav.mobileMoreTitle')}>
                  <button
                    type="button"
                    onClick={() => {
                      setPanel(null);
                      onOpenVotingRegion();
                    }}
                    className="pixel-corners flex min-h-12 items-center border border-signal/55 bg-signal/8 px-4 text-left text-sm text-signal focus:outline-none focus:ring-2 focus:ring-signal/40"
                  >
                    {t('nav.mobileVotingRegion')}
                  </button>
                  {moreItems.map((item) => (
                    <NavLink
                      key={item.labelKey}
                      to={item.to}
                      onClick={() => setPanel(null)}
                      className="pixel-corners flex min-h-12 items-center border border-line/80 bg-bg/45 px-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    >
                      {t(item.labelKey)}
                    </NavLink>
                  ))}
                </nav>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
