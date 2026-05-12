import { PixelFrame } from './PixelFrame';

type DataPrinciplesPanelProps = {
  principles: string[];
};

export function DataPrinciplesPanel({ principles }: DataPrinciplesPanelProps) {
  return (
    <PixelFrame title="Data Principles Panel">
      <ul className="space-y-3 text-sm text-slate-300">
        {principles.map((principle) => (
          <li key={principle} className="flex gap-3">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-none bg-signal" aria-hidden="true" />
            <span>{principle}</span>
          </li>
        ))}
      </ul>
    </PixelFrame>
  );
}
