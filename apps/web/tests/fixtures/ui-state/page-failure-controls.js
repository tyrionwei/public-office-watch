// Invented public data only. Every asynchronous operation is observable and controllable.
export function installPageFailureControls() {
  if (!new URLSearchParams(location.search).has('pageFailures')) return;
  const elections = [2026, 2022].map(year => ({ election_id: 'election-' + year,
    name: 'Fixture election ' + year, year, voting_date: year + '-11-28', election_type: 'local', status: 'upcoming' }));
  const parties = ['a', 'b'].map(id => ({ party_id: id, slug: id, name: 'PARTY ' + id.toUpperCase(), theme_key: 'other' }));
  const candidates = ['a', 'b', 'c'].map((id, index) => ({ candidate_id: 'candidate-' + id, person_id: id,
    person_name: 'CANDIDATE ' + id.toUpperCase(), candidate_no: String(index + 1), party: 'TEST',
    election_result: 'pending', candidacy_status: 'registered', vote_count: null, vote_rate: null }));
  const params = new URLSearchParams(location.search);
  const state = { calls: [], failures: (params.get('fail') ?? '').split(',').filter(Boolean), deferred: [], empty: [], financeSummaries: [], elections, parties };
  const call = (method, args, value) => {
    const row = { method, args, done: false };
    state.calls.push(row);
    return new Promise((resolve, reject) => {
      row.resolve = (override = value) => { row.done = true; resolve(override); };
      row.reject = () => { row.done = true; reject(new Error('Controlled ' + method + ' failure')); };
      if (!state.deferred.includes(method)) {
        if (state.failures.includes(method)) row.reject();
        else row.resolve(state.empty.includes(method) ? (Array.isArray(value) ? [] : { ...value, items: [], total: 0 }) : value);
      }
    });
  };
  const emptyPage = { items: [], total: 0 };
  state.provider = {
    loadElectionIndex: () => call('index', [], { elections: state.elections, raceSummaries: [] }),
    loadElectionRaceFacets: ids => call('facets', [ids], []),
    loadElectionRacePage: (...args) => call('races', args, emptyPage),
    loadElectionEducationDistribution: (...args) => call('education', args, []),
    loadElectionPartyPerformance: (...args) => call('performance', args, []),
    loadRaceDetail: id => call('race', [id], { race: { race_id: id, election_id: elections[0].election_id,
      title: 'Fixture race', race_type: 'county_mayor', status: 'upcoming', region_name: 'Fixture county' },
      election: elections[0], candidates, partyAffiliations: [], partyListResults: [],
      referendumQuestion: null, referendumOptions: [], referendumRegionResults: [] }),
    loadPersonProfiles: ids => call('profiles', [ids], ids.map(id => ({ person: { person_id: id, name: id, education: 'EDUCATION ' + id },
      public_claims: [], candidate_records: [], party_affiliations: [] }))),
    loadPartyDirectory: () => call('directory', [], parties),
    loadPartyFinanceData: () => call('finance', [], null),
    loadPartyCompanyContributionCounts: () => call('counts', [], parties.map(p => ({ party_id: p.party_id, contribution_count: 1 }))),
    getParties: () => parties,
    getPartyBySlug: slug => parties.find(p => p.slug === slug),
    getPartyFinanceSummaries: id => state.financeSummaries.filter(row => row.party_id === id),
    getPartyAnnualFinanceFilings: () => [],
    loadPartyCompanyContributionPage: (id, page, size) => call('companies', [id, page, size], {
      total: 12, items: [{ party_id: id, company_id: id + page, company_name: 'COMPANY ' + id.toUpperCase() + ' PAGE ' + page,
        amount_total: 100 * page, donation_count: 1, director_names: [], confidence_level: 'A', report_year: 2025 }],
    }),
    loadPeoplePage: (...args) => call('people', args, emptyPage),
    loadPartyCandidatePage: (...args) => call('candidates', args, emptyPage),
    loadPartyOfficers: (...args) => call('officers', args, []),
    loadPartyPlatformHistory: (...args) => call('platforms', args, []),
    loadPartyPeopleStatistics: (...args) => call('peopleStats', args, []),
    loadPartyLegalStatistics: (...args) => call('legalStats', args, null),
  };
  window.__pageFailures = state;
}
