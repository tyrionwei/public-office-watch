// Deliberately invented data; all participation and directory I/O stays here.
const statuses = ['fulfilled', 'in_progress', 'not_fulfilled', 'insufficient_information'];
export function installControls() {
  const parameters = new URLSearchParams(location.search);
  const state = {
    deferLoads: parameters.has('defer'),
    deferWrites: false,
    failRegions: false,
    deferRegions: false,
    loads: [],
    writes: [],
    regions: [],
    ownVotes: parameters.has('own') ? { 'result-a': { 'item-a': 'fulfilled' } } : {},
  };
  const controlled = (requests, deferred, details, result) => {
    const record = { ...details, done: false };
    requests.push(record);
    return new Promise((resolve, reject) => {
      record.resolve = () => { record.done = true; resolve(result()); };
      record.reject = () => { record.done = true; reject(new Error('Controlled fixture failure')); };
      if (!deferred) record.resolve();
    });
  };
  state.load = (id) => {
    // Preserve the response at request time so delayed deliveries can be stale.
    const snapshot = {
    claimId: id,
    available: true,
    items: [{ itemKey: id.replace('result-', 'item-'), displayOrder: 1, promiseText: `${id.toUpperCase()} ONLY POLICY`,
      counts: Object.fromEntries(statuses.map(status => [status, 0])), totalCount: 0 }],
    ownVotes: { ...(state.ownVotes[id] ?? {}) },
    votingIsOpen: true,
    resultsAnnouncedOn: null,
    votingOpensOn: null,
    };
    return controlled(state.loads, state.deferLoads, { id }, () => snapshot);
  };
  state.write = (kind, id, itemKey, status) => controlled(state.writes, state.deferWrites, { kind, id, itemKey, status }, () => {
    const votes = state.ownVotes[id] ??= {};
    if (kind === 'withdraw') delete votes[itemKey];
    else votes[itemKey] = status;
  });
  state.loadRegions = () => {
    if (state.failRegions) return Promise.reject(new Error('Controlled directory failure'));
    return controlled(state.regions, state.deferRegions, {}, () => undefined);
  };
  window.__uiState = state;
}
