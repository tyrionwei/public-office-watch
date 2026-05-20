import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { BgmProvider } from './components/BgmProvider';
import { publicDataReadyEvent } from './lib/publicDataProviderFactory';
import { AboutPage } from './pages/AboutPage';
import { DataGuidancePage } from './pages/DataGuidancePage';
import { ElectionPage } from './pages/ElectionPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PartiesPage } from './pages/PartiesPage';
import { PartyPage } from './pages/PartyPage';
import { RegionPage } from './pages/RegionPage';
import { aboutPath, dataGuidancePath, homePath, partiesPath } from './routes/routePaths';

function App() {
  const [, setPublicDataVersion] = useState(0);

  useEffect(() => {
    const handlePublicDataReady = () => setPublicDataVersion((version) => version + 1);
    window.addEventListener(publicDataReadyEvent, handlePublicDataReady);
    return () => window.removeEventListener(publicDataReadyEvent, handlePublicDataReady);
  }, []);

  return (
    <BrowserRouter>
      <BgmProvider>
        <Routes>
          <Route path={homePath()} element={<HomePage />} />
          <Route path={partiesPath()} element={<PartiesPage />} />
          <Route path="/parties/:partySlug" element={<PartyPage />} />
          <Route path={dataGuidancePath()} element={<DataGuidancePage />} />
          <Route path={aboutPath()} element={<AboutPage />} />
          <Route path="/regions/:regionId" element={<RegionPage />} />
          <Route path="/elections/:electionId" element={<ElectionPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BgmProvider>
    </BrowserRouter>
  );
}

export default App;
