import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { BgmProvider } from './components/BgmProvider';
import { GlobalChatWidget } from './components/GlobalChatWidget';
import { LanguageProvider, useI18n } from './i18n';
import { publicDataReadyEvent, refreshConfiguredPublicDataProvider } from './lib/publicDataProviderFactory';
import { aboutPath, dataGuidancePath, electionsPath, homePath, internalChatAdminPath, internalDataProgressPath, internalReviewQueuePath, partiesPath, peoplePath } from './routes/routePaths';

const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })));
const PeoplePage = lazy(() => import('./pages/PeoplePage').then((module) => ({ default: module.PeoplePage })));
const PersonPage = lazy(() => import('./pages/PersonPage').then((module) => ({ default: module.PersonPage })));
const ElectionsPage = lazy(() => import('./pages/ElectionsPage').then((module) => ({ default: module.ElectionsPage })));
const ElectionEventPage = lazy(() => import('./pages/ElectionEventPage').then((module) => ({ default: module.ElectionEventPage })));
const RacePage = lazy(() => import('./pages/RacePage').then((module) => ({ default: module.RacePage })));
const PartiesPage = lazy(() => import('./pages/PartiesPage').then((module) => ({ default: module.PartiesPage })));
const PartyPage = lazy(() => import('./pages/PartyPage').then((module) => ({ default: module.PartyPage })));
const DataGuidancePage = lazy(() => import('./pages/DataGuidancePage').then((module) => ({ default: module.DataGuidancePage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then((module) => ({ default: module.AboutPage })));
const RegionPage = lazy(() => import('./pages/RegionPage').then((module) => ({ default: module.RegionPage })));
const ElectionPage = lazy(() => import('./pages/ElectionPage').then((module) => ({ default: module.ElectionPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));
const InternalChatAdminPage = lazy(() => import('./pages/InternalChatAdminPage').then((module) => ({ default: module.InternalChatAdminPage })));

const InternalReviewQueuePage = import.meta.env.DEV
  ? lazy(() => import('./pages/InternalReviewQueuePage').then((module) => ({ default: module.InternalReviewQueuePage })))
  : null;
const InternalDataProgressPage = import.meta.env.DEV
  ? lazy(() => import('./pages/InternalDataProgressPage').then((module) => ({ default: module.InternalDataProgressPage })))
  : null;

function PublicDataBootstrapScreen({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const { t } = useI18n();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050a16] p-6 text-slate-300">
      <section className="pixel-corners w-full max-w-md border border-line/70 bg-panel p-6">
        {failed ? (
          <div className="space-y-4">
            <h1 className="font-display text-xl text-white">{t('app.loadError')}</h1>
            <button
              type="button"
              onClick={onRetry}
              className="border border-accent/60 bg-accent/10 px-4 py-2 text-sm text-accent hover:border-accent hover:text-white"
            >
              {t('app.retry')}
            </button>
          </div>
        ) : (
          <div aria-live="polite">
            <p className="font-display text-sm text-white">{t('app.loading')}</p>
            <div className="mt-4 grid gap-2" aria-hidden="true">
              <span className="h-2 animate-pulse bg-line/70" />
              <span className="h-2 w-4/5 animate-pulse bg-line/50" />
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function AppRoutes({
  publicDataStatus,
  onRetry,
}: {
  publicDataStatus: 'loading' | 'ready' | 'error';
  onRetry: () => void;
}) {
  const location = useLocation();
  const isChatAdminRoute = location.pathname === internalChatAdminPath();

  if (publicDataStatus !== 'ready' && !isChatAdminRoute) {
    return <PublicDataBootstrapScreen failed={publicDataStatus === 'error'} onRetry={onRetry} />;
  }

  return (
    <>
      <Suspense fallback={<div className="min-h-screen bg-[#050a16]" />}>
        <Routes>
          <Route path={homePath()} element={<HomePage />} />
          <Route path={peoplePath()} element={<PeoplePage />} />
          <Route path="/people/:personId" element={<PersonPage />} />
          <Route path={electionsPath()} element={<ElectionsPage />} />
          <Route path="/elections/events/:eventKey" element={<ElectionEventPage />} />
          <Route path="/elections/races/:raceId" element={<RacePage />} />
          <Route path={partiesPath()} element={<PartiesPage />} />
          <Route path="/parties/:partySlug" element={<PartyPage />} />
          <Route path={dataGuidancePath()} element={<DataGuidancePage />} />
          <Route path={aboutPath()} element={<AboutPage />} />
          <Route path="/regions/:regionId" element={<RegionPage />} />
          <Route path="/elections/:electionId" element={<ElectionPage />} />
          <Route path={internalChatAdminPath()} element={<InternalChatAdminPage />} />
          {InternalReviewQueuePage ? <Route path={internalReviewQueuePath()} element={<InternalReviewQueuePage />} /> : null}
          {InternalDataProgressPage ? <Route path={internalDataProgressPath()} element={<InternalDataProgressPage />} /> : null}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      {publicDataStatus === 'ready' && !isChatAdminRoute ? <GlobalChatWidget /> : null}
    </>
  );
}

function App() {
  const [, setPublicDataVersion] = useState(0);
  const [publicDataStatus, setPublicDataStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshAttempt, setRefreshAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setPublicDataStatus('loading');
    const handlePublicDataReady = () => setPublicDataVersion((version) => version + 1);
    window.addEventListener(publicDataReadyEvent, handlePublicDataReady);

    void refreshConfiguredPublicDataProvider()
      .then(() => {
        if (!active) return;
        setPublicDataStatus('ready');
        setPublicDataVersion((version) => version + 1);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setPublicDataStatus('error');
        if (import.meta.env.DEV) {
          console.warn('Failed to refresh public data snapshot', error);
        }
      });

    return () => {
      active = false;
      window.removeEventListener(publicDataReadyEvent, handlePublicDataReady);
    };
  }, [refreshAttempt]);

  return (
    <BrowserRouter>
      <LanguageProvider>
        <BgmProvider>
          <>
            <AppRoutes
              publicDataStatus={publicDataStatus}
              onRetry={() => setRefreshAttempt((attempt) => attempt + 1)}
            />
          </>
        </BgmProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;
