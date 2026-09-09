import { AppErrorBoundary } from '../../../src/components/AppErrorBoundary';
import { RouteMetadata } from '../../../src/components/RouteMetadata';
import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { installControls } from './controls';
import { installPublicFlowControls } from './public-controls';
import { installPageFailureControls } from './page-failure-controls';
import { ElectionsPage } from '../../../src/pages/ElectionsPage';
import { ElectionEventPage } from '../../../src/pages/ElectionEventPage';
import { RacePage } from '../../../src/pages/RacePage';
import { PartiesPage } from '../../../src/pages/PartiesPage';
import { PartyPage } from '../../../src/pages/PartyPage';
import { GlobalSearch } from '../../../src/components/GlobalSearch';
import { MobileNavigation } from '../../../src/components/MobileNavigation';
import { PeoplePage } from '../../../src/pages/PeoplePage';
import { PartyListRacePanel } from '../../../src/components/PartyListRacePanel';
import { PlatformFulfillmentList } from '../../../src/components/PlatformFulfillmentList';
import { MobileVotingRegion } from '../../../src/components/MobileVotingRegion';
import { MyPollingPlace } from '../../../src/components/MyPollingPlace';
import { VotingRegionProvider, useVotingRegion } from '../../../src/votingRegion';

const t = (key, values) => key + (values ? ' ' + Object.values(values).join(' ') : '');
const results = ['a', 'b'].map((key, index) => ({ result_id: 'result-' + key, party_slug: key,
  party_name: 'PARTY ' + key.toUpperCase(), party_ballot_number: index + 1, candidate_party_name: key,
  candidate_count: 0, passed_threshold: true, vote_count: 100, vote_rate: 50, allocated_seats: 1 }));
const LazyPage = lazy(() => import('./lazy-page.jsx'));
function MetadataFixture() {
  const navigate = useNavigate();
  useEffect(() => { window.__navigateMetadata = navigate; }, [navigate]);
  return <><RouteMetadata /><h1>Metadata fixture</h1></>;
}
function MobilePanels() {
  const [panel, setPanel] = useState(null);
  return <>
    <MobileNavigation panel={panel} setPanel={setPanel} onOpenVotingRegion={() => document.querySelector('[data-next-dialog]').focus()} />
    <button data-next-dialog>Next dialog fixture</button>
  </>;
}
function PageFailures() {
  const navigate = useNavigate();
  const current = useLocation();
  useEffect(() => {
    window.__navigateFailurePage = navigate;
    return () => { delete window.__navigateFailurePage; };
  }, [navigate]);
  return <>
    <Routes>
      <Route path="/elections" element={<ElectionsPage />} />
      <Route path="/elections/events/:eventKey" element={<ElectionEventPage />} />
      <Route path="/elections/races/:raceId" element={<RacePage />} />
      <Route path="/parties" element={<PartiesPage />} />
      <Route path="/parties/:partySlug" element={<PartyPage />} />
    </Routes>
    <output data-failure-route>{current.pathname + current.search}</output>
  </>;
}
function Voting() {
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  const unstableClose = new URLSearchParams(location.search).has('unstableClose');
  useEffect(() => {
    window.__rerenderVoting = () => setRevision(value => value + 1);
    return () => { delete window.__rerenderVoting; };
  }, []);
  return <VotingRegionProvider>
    <button onClick={() => setOpen(true)}>Open editor fixture</button>
    <MobileVotingRegion editorOpen={open} onOpenEditor={() => setOpen(true)} onCloseEditor={unstableClose
      ? () => { window.__closedVotingRevision = revision; setOpen(false); } : close} />
    <MyPollingPlace eventKey="fixture-election" lookupUrl="https://example.invalid" onClose={() => {}} />
    <SavedPreference />
  </VotingRegionProvider>;
}
function SavedPreference() {
  const { preference } = useVotingRegion();
  return <output data-saved-preference>{JSON.stringify(preference)}</output>;
}
function Person() {
  const [id, setId] = useState('result-a');
  return <>
    <button onClick={() => setId('result-a')}>Person A</button>
    <button onClick={() => setId('result-b')}>Person B</button>
    <section data-person-fixture>
      <PlatformFulfillmentList claim={{ claim_id: id, claim_json: {}, claim_value: '' }} title={'Person ' + id} />
    </section>
  </>;
}
function PublicFlows({ people }) {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <button onClick={() => navigate('/people?status=current&page=2')}>People page 2</button>
    <button onClick={() => navigate(-1)}>Browser back fixture</button>
    {people ? <PeoplePage /> : <GlobalSearch onNavigate={() => { window.__publicFlows.navigations += 1; }} />}
    <button>Outside search</button>
    <output data-fixture-location>{location.pathname + location.search}</output>
  </>;
}
installControls();
installPublicFlowControls();
installPageFailureControls();
const parameters = new URLSearchParams(location.search);
if (parameters.has('metadata')) {
  window.__metadataState = { people: {} };
  const canonical = document.createElement('link'); canonical.rel = 'canonical'; canonical.href = 'https://pow4vote.org/people/server-a'; document.head.append(canonical);
  const server = document.createElement('script'); server.type = 'application/ld+json'; server.id = 'public-office-watch-server-structured-data';
  server.textContent = JSON.stringify({ '@type': 'Person', name: 'Server Person A' }); document.head.append(server);
}
createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={[parameters.get('route') ?? '/?party=a']}>
    {parameters.has('boundary') ? <AppErrorBoundary><Suspense fallback={<p>Loading lazy page</p>}><LazyPage /></Suspense></AppErrorBoundary> : parameters.has('metadata') ? <MetadataFixture /> : parameters.has('pageFailures') ? <PageFailures /> : parameters.has('mobilePanels') ? <MobilePanels /> : parameters.has('search') || parameters.has('people') ? <PublicFlows people={parameters.has('people')} />
      : parameters.has('voting') ? <Voting /> : parameters.has('person') ? <Person />
      : <PartyListRacePanel results={results} candidates={[]} language="en" t={t} />}
  </MemoryRouter>,
);
