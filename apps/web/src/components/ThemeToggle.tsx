import { useI18n } from '../i18n';
import { useTheme } from '../theme';

export function ThemeToggle() {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const light = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={light ? t('theme.switchToDark') : t('theme.switchToLight')}
      title={light ? t('theme.switchToDark') : t('theme.switchToLight')}
      className="pixel-corners inline-flex min-h-12 shrink-0 items-center gap-2 border border-line/80 bg-bg/55 px-3 font-display text-[11px] tracking-[0.08em] text-slate-300 transition hover:border-accent/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/35"
    >
      <span aria-hidden="true" className="text-base leading-none text-accent">{light ? '☀' : '◐'}</span>
      <span>{light ? t('theme.light') : t('theme.dark')}</span>
    </button>
  );
}
