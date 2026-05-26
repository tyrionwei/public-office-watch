import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { BgmProvider } from './components/BgmProvider';
import { publicDataReadyEvent } from './lib/publicDataProviderFactory';
import { refreshSupabasePublicDataSnapshot } from './lib/supabasePublicDataProvider';
import { AboutPage } from './pages/AboutPage';
import { DataGuidancePage } from './pages/DataGuidancePage';
import { ElectionPage } from './pages/ElectionPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PartiesPage } from './pages/PartiesPage';
import { PartyPage } from './pages/PartyPage';
import { PeoplePage } from './pages/PeoplePage';
import { PersonPage } from './pages/PersonPage';
import { RegionPage } from './pages/RegionPage';
import { aboutPath, dataGuidancePath, homePath, internalDataProgressPath, internalReviewQueuePath, partiesPath, peoplePath } from './routes/routePaths';

const InternalReviewQueuePage = import.meta.env.DEV
  ? lazy(() => import('./pages/InternalReviewQueuePage').then((module) => ({ default: module.InternalReviewQueuePage })))
  : null;
const InternalDataProgressPage = import.meta.env.DEV
  ? lazy(() => import('./pages/InternalDataProgressPage').then((module) => ({ default: module.InternalDataProgressPage })))
  : null;

function App() {
  const [, setPublicDataVersion] = useState(0);

  useEffect(() => {
    const handlePublicDataReady = () => setPublicDataVersion((version) => version + 1);
    window.addEventListener(publicDataReadyEvent, handlePublicDataReady);

    void refreshSupabasePublicDataSnapshot().then(() => {
      setPublicDataVersion((version) => version + 1);
    });

    return () => window.removeEventListener(publicDataReadyEvent, handlePublicDataReady);
  }, []);

  return (
    <BrowserRouter>
      <BgmProvider>
        <Routes>
          <Route path={homePath()} element={<HomePage />} />
          <Route path={peoplePath()} element={<PeoplePage />} />
          <Route path="/people/:personId" element={<PersonPage />} />
          <Route path={partiesPath()} element={<PartiesPage />} />
          <Route path="/parties/:partySlug" element={<PartyPage />} />
          <Route path={dataGuidancePath()} element={<DataGuidancePage />} />
          <Route path={aboutPath()} element={<AboutPage />} />
          <Route path="/regions/:regionId" element={<RegionPage />} />
          <Route path="/elections/:electionId" element={<ElectionPage />} />
          {InternalReviewQueuePage ? (
            <Route
              path={internalReviewQueuePath()}
              element={
                <Suspense fallback={null}>
                  <InternalReviewQueuePage />
                </Suspense>
              }
            />
          ) : null}
          {InternalDataProgressPage ? (
            <Route
              path={internalDataProgressPath()}
              element={
                <Suspense fallback={null}>
                  <InternalDataProgressPage />
                </Suspense>
              }
            />
          ) : null}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BgmProvider>
    </BrowserRouter>
  );
}

export default App;
