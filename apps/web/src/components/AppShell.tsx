import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { AppHeader } from './AppHeader';
import { BgmToggle } from './BgmToggle';
import { NextEventTicker } from './NextEventTicker';

type AppShellProps = PropsWithChildren<{
  headerRight?: ReactNode;
  ticker?: ComponentProps<typeof NextEventTicker>;
}>;

export function AppShell({ headerRight, ticker, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-bg text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,12,30,0.94),rgba(6,9,19,0.98)_58%,rgba(3,7,16,1))]" />
        <div className="scanline-overlay absolute inset-0 opacity-50" />
      </div>

      <div className="relative mx-auto w-full max-w-[1640px] px-3 py-4 sm:px-4 lg:px-5">
        <AppHeader rightSlot={headerRight} />

        {ticker ? <div className="mt-3">{<NextEventTicker {...ticker} />}</div> : null}

        <main className="mt-3">{children}</main>
      </div>
    </div>
  );
}

export function AppShellBgmToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return <BgmToggle enabled={enabled} onToggle={onToggle} />;
}
