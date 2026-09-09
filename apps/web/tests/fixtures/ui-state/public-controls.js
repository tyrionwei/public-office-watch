import { PublicPageOutOfRangeError } from '../../../src/lib/publicReadContracts.ts';

// Invented public rows and controllable promises; no database or network I/O.
export function installPublicFlowControls() {
  const params = new URLSearchParams(location.search);
  const state = {
    navigations: 0, searchMode: 'success', deferSearch: false, searches: [],
    totalPeople: params.has('zero') ? 0 : 45,
    emptyRange: params.has('empty-range'), failPeople: params.has('people-error'),
    deferPeople: params.has('defer-people'), peopleLoads: [],
  };
  state.search = query => {
    const mode = state.searchMode;
    const load = { query };
    state.searches.push(load);
    return new Promise((resolve, reject) => {
      load.resolve = () => resolve(mode === 'empty' ? [] : [1, 2].map(index => ({
        id: query + index, type: 'person', title: query + ' result ' + index,
        subtitle: 'Synthetic public result', label: 'Person', href: '/people/' + query + index,
      })));
      load.reject = () => reject(new Error('Controlled search failure'));
      if (!state.deferSearch) (mode === 'error' ? load.reject : load.resolve)();
    });
  };
  state.people = (filters, page, size) => {
    const total = state.totalPeople;
    const start = (page - 1) * size;
    const load = { filters: { ...filters }, page, size };
    state.peopleLoads.push(load);
    return new Promise((resolve, reject) => {
      load.reject = () => reject(new Error('Controlled people failure'));
      load.rejectRange = () => reject(new PublicPageOutOfRangeError());
      load.resolve = () => resolve({ total, items: Array.from({ length: Math.min(size, Math.max(0, total - start)) }, (_, i) => ({
        person_id: 'person-' + (start + i + 1), name: 'Person ' + (start + i + 1), party: 'TEST',
        role: 'councilor', role_label: 'Councilor', status: 'current', status_label: 'Current',
        position: 'Fixture office', district: 'Fixture region',
      })) });
      if (!state.deferPeople) {
        if (state.failPeople) load.reject();
        else if (page > 1 && start >= total && !state.emptyRange) load.rejectRange();
        else load.resolve();
      }
    });
  };
  window.__publicFlows = state;
}
