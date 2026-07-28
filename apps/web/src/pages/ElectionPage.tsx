import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { buildElectionEvents } from '../data/electionEvents';
import { getElectionEventForElection } from '../data/electionEventLookup';
import { useI18n } from '../i18n';
import { refreshConfiguredPublicDataProvider } from '../lib/publicDataProviderFactory';
import { electionEventPath, electionsPath } from '../routes/routePaths';

type ElectionResolution = {
  electionId: string;
  targetPath: string | null;
  failed: boolean;
};

export function ElectionPage() {
  const { t } = useI18n();
  const { electionId } = useParams();
  const safeElectionId = electionId ?? '';
  const [resolution, setResolution] = useState<ElectionResolution | null>(null);
  const loading = resolution?.electionId !== safeElectionId;

  useEffect(() => {
    let active = true;

    if (!safeElectionId) {
      setResolution({ electionId: safeElectionId, targetPath: null, failed: false });
      return () => {
        active = false;
      };
    }

    void refreshConfiguredPublicDataProvider()
      .then((provider) => provider.loadElectionIndex())
      .then((indexData) => {
        if (!active) return;
        const events = buildElectionEvents(indexData.elections, [], indexData.raceSummaries);
        const event = getElectionEventForElection(events, safeElectionId);
        setResolution({
          electionId: safeElectionId,
          targetPath: event ? electionEventPath(event.key) : null,
          failed: false,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setResolution({ electionId: safeElectionId, targetPath: null, failed: true });
        if (import.meta.env.DEV) console.warn('Failed to resolve election event', error);
      });

    return () => {
      active = false;
    };
  }, [safeElectionId]);

  if (!loading && resolution.targetPath) {
    return <Navigate to={resolution.targetPath} replace />;
  }

  return (
    <AppShell>
      <PixelFrame
        title={t('legacyElection.frameTitle')}
        action={
          <Link to={electionsPath()} className="text-[11px] uppercase tracking-[0.22em] text-accent">
            {t('legacyElection.back')}
          </Link>
        }
      >
        {loading ? (
          <p className="text-sm text-slate-300">{t('legacyElection.loading')}</p>
        ) : (
          <div className="space-y-3 text-sm text-slate-300">
            <h2 className="font-display text-2xl text-white">
              {resolution.failed ? t('legacyElection.loadError') : t('legacyElection.notFound')}
            </h2>
            {resolution.failed ? null : <p>{t('legacyElection.notFoundBody')}</p>}
            {resolution.failed ? null : <p>{t('legacyElection.notFoundHint')}</p>}
          </div>
        )}
      </PixelFrame>
    </AppShell>
  );
}
