import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { HomePage } from '../../../src/pages/HomePage';

const seats = [
  { party: '甲黨', count: 50 }, { party: '乙黨', count: 40 },
  { party: '丙黨', count: 20 }, { party: '其他', count: 3 },
];
function home(regionId = null) {
  const region = regionId ? { id: regionId, publicRegionId: regionId, label: regionId === 'taipei' ? '臺北市' : '新北市', level: 'county_city', parentId: null } : null;
  const raceId = regionId === 'taipei' ? 'alpha' : regionId === 'new-taipei-city' ? 'beta' : 'national';
  return {
    ticker: { title: '2026地方公職人員選舉', date: '2026-11-28', electionId: 'election-2026' },
    regions: [],
    stageRegions: region ? [region] : [{ id: 'taipei', publicRegionId: 'taipei', label: '臺北市', level: 'county_city', parentId: null }, { id: 'new-taipei-city', publicRegionId: 'new-taipei-city', label: '新北市', level: 'county_city', parentId: null }],
    stageRegionSummaries: [],
    upcomingRaces: [{ id: 'race-' + raceId, title: 'Race ' + raceId, region: regionId ?? '全國', regionId: regionId ?? '', date: '2026-11-28', status: 'upcoming', raceType: regionId ? 'local_chief' : 'legislator' }],
    candidateSummaries: [], seatDistribution: seats, dataPrinciples: [],
  };
}
window.__homeRecovery = {
  calls: [], failNationalOnce: true, pendingAlpha: null,
  load(regionId) {
    this.calls.push(regionId ?? null);
    if ((regionId ?? null) === null && this.failNationalOnce) { this.failNationalOnce = false; return Promise.reject(new Error('home RPC unavailable')); }
    if (regionId === 'taipei') return new Promise(resolve => { this.pendingAlpha = () => resolve(home('taipei')); });
    return Promise.resolve(home(regionId));
  },
};
function NavigationBridge() {
  const navigate = useNavigate();
  useEffect(() => { window.__goHomePath = navigate; }, [navigate]);
  return <HomePage />;
}
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[window.location.pathname + window.location.search]}><NavigationBridge /></MemoryRouter>);
