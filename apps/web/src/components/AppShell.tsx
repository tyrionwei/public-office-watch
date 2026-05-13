import type { PropsWithChildren, ReactNode } from 'react';
import { AppHeader } from './AppHeader';
import { BgmToggle } from './BgmToggle';
import { NextEventTicker } from './NextEventTicker';

type AppShellProps = PropsWithChildren<{
  headerRight?: ReactNode;
  ticker?: React.ComponentProps<typeof NextEventTicker>;
}>;

export function AppShell({ headerRight, ticker, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-bg text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="arcade-radial absolute left-[8%] top-[-8rem] h-72 w-72 rounded-full" />
        <div className="arcade-radial arcade-radial-pink absolute bottom-[-10rem] right-[6%] h-96 w-96 rounded-full" />
        <div className="scanline-overlay absolute inset-0 opacity-50" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <AppHeader />

        {ticker || headerRight ? (
          <div className="mt-6 flex flex-col gap-4 xl:flex-row xl:items-stretch">
            <div className="min-w-0 flex-1">{ticker ? <NextEventTicker {...ticker} /> : null}</div>
            {headerRight ? <div className="xl:w-[220px]">{headerRight}</div> : null}
          </div>
        ) : null}

        <main className="mt-6">{children}</main>
      </div>
    </div>
  );
}

export function AppShellBgmToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return <BgmToggle enabled={enabled} onToggle={onToggle} />;
}
