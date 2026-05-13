import type { PropsWithChildren, ReactNode } from 'react';

type SectionPanelProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  action?: ReactNode;
}>;

export function SectionPanel({ title, eyebrow, action, children }: SectionPanelProps) {
  return (
    <section className="pixel-corners border border-line/70 bg-panel/55 p-4 sm:p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          {eyebrow ? <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{eyebrow}</p> : null}
          <h3 className="mt-1 font-display text-xl text-white">{title}</h3>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
