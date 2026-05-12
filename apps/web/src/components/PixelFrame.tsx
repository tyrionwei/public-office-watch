import type { PropsWithChildren, ReactNode } from 'react';

type PixelFrameProps = PropsWithChildren<{
  title?: string;
  action?: ReactNode;
  className?: string;
}>;

export function PixelFrame({ title, action, className = '', children }: PixelFrameProps) {
  return (
    <section className={`rounded-sm border border-line bg-panel/95 p-4 shadow-pixel ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-3 border-b border-line/70 pb-2">
          {title ? <h2 className="font-display text-sm uppercase tracking-[0.24em] text-accent">{title}</h2> : <span />}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
