import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { BgmProvider } from './components/BgmProvider';
import { LanguageProvider } from './i18n';
import { publicDataReadyEvent, refreshConfiguredPublicDataProvider } from './lib/publicDataProviderFactory';
import { aboutPath, dataGuidancePath, electionsPath, homePath, internalDataProgressPath, internalReviewQueuePath, partiesPath, peoplePath } from './routes/routePaths';

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

    void refreshConfiguredPublicDataProvider()
      .then(() => {
        setPublicDataVersion((version) => version + 1);
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) {
          console.warn('Failed to refresh public data snapshot', error);
        }
      });

    return () => window.removeEventListener(publicDataReadyEvent, handlePublicDataReady);
  }, []);

  return (
    <BrowserRouter>
      <LanguageProvider>
        <BgmProvider>
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
              {InternalReviewQueuePage ? <Route path={internalReviewQueuePath()} element={<InternalReviewQueuePage />} /> : null}
              {InternalDataProgressPage ? <Route path={internalDataProgressPath()} element={<InternalDataProgressPage />} /> : null}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BgmProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;
