import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { supportPath } from '../routes/routePaths';
import { AppHeader } from './AppHeader';
import { LanguageToggle } from './LanguageToggle';
import { NextEventTicker } from './NextEventTicker';
import { ThemeToggle } from './ThemeToggle';

type AppShellProps = PropsWithChildren<{
  headerRight?: ReactNode;
  ticker?: ComponentProps<typeof NextEventTicker>;
}>;

export function AppShell({ headerRight, ticker, children }: AppShellProps) {
  const { t } = useI18n();
  const headerControl = (
    <div className="grid gap-2">
      {headerRight}
      <div className="flex flex-wrap items-stretch justify-end gap-2">
        <Link
          to={supportPath()}
          className="pixel-corners inline-flex min-h-10 items-center border border-signal/55 bg-signal/8 px-3 font-display text-xs text-signal transition hover:border-signal hover:text-white focus:outline-none focus:ring-2 focus:ring-signal/35"
        >
          ♡ {t('nav.support')}
        </Link>
        <ThemeToggle />
        <LanguageToggle />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 [background:var(--theme-shell-gradient)]" />
        <div className="scanline-overlay absolute inset-0 opacity-50" />
      </div>

      <div className="relative w-full px-3 py-4 sm:px-4 lg:px-5 2xl:px-6">
        <AppHeader rightSlot={headerControl} />

        {ticker ? <div className="mt-3">{<NextEventTicker {...ticker} />}</div> : null}

        <main className="mt-3">{children}</main>
      </div>
    </div>
  );
}
