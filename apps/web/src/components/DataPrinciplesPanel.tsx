import { dataPrinciplesGuideSprite } from '../data/defaultCharacterAssets';
import { useI18n } from '../i18n';
import { PixelFrame } from './PixelFrame';

type DataPrinciplesPanelProps = {
  principles: string[];
};

const fixedNotes = [
  '公開資料',
  '人工審核',
  '來源可追溯',
  '行政區導覽',
  '中性呈現',
];

export function DataPrinciplesPanel({ principles }: DataPrinciplesPanelProps) {
  const { t } = useI18n();

  return (
    <PixelFrame
      title="Data Principles"
      action={<span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">evidence first</span>}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_96px]">
          <div className="grid grid-cols-1 gap-2">
            {fixedNotes.map((note) => (
              <span
                key={note}
                className="pixel-corners border border-line/70 bg-bg/40 px-3 py-2 text-xs text-slate-200"
              >
                {note}
              </span>
            ))}
          </div>
          <div className="relative hidden min-h-[150px] flex-col items-center justify-end overflow-visible sm:flex">
            <img
              src={dataPrinciplesGuideSprite}
              alt=""
              className="h-[126px] w-auto object-contain object-bottom drop-shadow-[0_12px_10px_rgba(0,0,0,0.44)] [image-rendering:pixelated]"
              aria-hidden="true"
              draggable={false}
            />
            <p className="mt-1 text-center text-[10px] leading-4 text-cyan-200/75">{t('dataGuidance.mascotGuide')}</p>
          </div>
        </div>

        <ul className="space-y-2 text-sm text-slate-300">
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
