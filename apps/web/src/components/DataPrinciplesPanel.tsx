import { PixelFrame } from './PixelFrame';

type DataPrinciplesPanelProps = {
  principles: string[];
};

const fixedNotes = [
  '公開資料',
  '人工審核',
  '來源可追溯',
  '前端只讀 public views',
  '中性呈現',
];

export function DataPrinciplesPanel({ principles }: DataPrinciplesPanelProps) {
  return (
    <PixelFrame
      title="Data Principles"
      action={<span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">evidence first</span>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {fixedNotes.map((note) => (
            <span
              key={note}
              className="pixel-corners border border-line/70 bg-bg/40 px-3 py-2 text-xs text-slate-200"
            >
              {note}
            </span>
          ))}
        </div>

        <ul className="space-y-3 text-sm text-slate-300">
          {principles.map((principle) => (
            <li key={principle} className="flex gap-3">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-none bg-signal" aria-hidden="true" />
              <span>{principle}</span>
            </li>
          ))}
        </ul>
      </div>
    </PixelFrame>
  );
}
