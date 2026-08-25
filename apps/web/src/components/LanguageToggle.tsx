import type { Language } from '../i18n';
import { useI18n } from '../i18n';

const languageOptions: { value: Language; labelKey: 'language.zh' | 'language.en' }[] = [
  { value: 'zh-TW', labelKey: 'language.zh' },
  { value: 'en', labelKey: 'language.en' },
];

export function LanguageToggle() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div
      className="pixel-corners flex shrink-0 items-center gap-1 border border-line/80 bg-bg/55 p-1 shadow-[inset_0_0_18px_rgba(114,232,255,0.06)]"
      aria-label={t('language.aria')}
    >
      {languageOptions.map((option) => {
        const selected = language === option.value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => setLanguage(option.value)}
            className={[
              'pixel-corners grid min-h-10 w-14 place-items-center whitespace-nowrap font-display text-[11px] uppercase tracking-[0.14em] transition focus:outline-none focus:ring-2 focus:ring-accent/35',
              selected ? 'bg-accent/18 text-white' : 'text-slate-500 hover:bg-panelAlt/45 hover:text-slate-200',
            ].join(' ')}
          >
            {t(option.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
