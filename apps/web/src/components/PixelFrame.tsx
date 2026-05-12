import type { PropsWithChildren, ReactNode } from 'react';

type PixelFrameProps = PropsWithChildren<{
  title?: string;
  action?: ReactNode;
  className?: string;
}>;

export function PixelFrame({ title, action, className = '', children }: PixelFrameProps) {
  return (
    <section
      className={[
        'pixel-corners relative overflow-hidden border border-line/80 bg-panel/90 p-4 shadow-pixel backdrop-blur-sm sm:p-5',
        'before:pointer-events-none before:absolute before:inset-[1px] before:border before:border-white/5 before:content-[""]',
        className,
      ].join(' ')}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/70 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-fuchsia-400/40 to-transparent" />

      {(title || action) && (
        <header className="hud-divider relative mb-4 flex items-start justify-between gap-3 pb-3">
          <div>
            {title ? (
              <h2 className="font-display text-[11px] uppercase tracking-[0.32em] text-accent sm:text-xs">
                {title}
              </h2>
            ) : (
              <span />
            )}
          </div>
          {action}
        </header>
      )}

      <div className="relative">{children}</div>
    </section>
  );
}
