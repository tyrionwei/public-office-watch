import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ElectionPage } from './pages/ElectionPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RegionPage } from './pages/RegionPage';
import { homePath } from './routes/routePaths';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={homePath()} element={<HomePage />} />
        <Route path="/regions/:regionId" element={<RegionPage />} />
        <Route path="/elections/:electionId" element={<ElectionPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
