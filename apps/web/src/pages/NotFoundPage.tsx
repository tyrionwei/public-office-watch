import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { useI18n } from '../i18n';
import { homePath } from '../routes/routePaths';

export function NotFoundPage() {
  const { t } = useI18n();

  return (
    <AppShell>
      <PixelFrame title={t('notFound.frameTitle')}>
        <div className="space-y-3 text-sm text-slate-300">
          <h2 className="font-display text-3xl text-white">{t('notFound.heading')}</h2>
          <p>{t('notFound.description')}</p>
          <Link
            to={homePath()}
            className="inline-flex rounded-sm border border-accent/60 bg-accent/10 px-4 py-2 font-display text-xs uppercase tracking-[0.22em] text-accent"
          >
            {t('notFound.backHome')}
          </Link>
        </div>
      </PixelFrame>
    </AppShell>
  );
}
