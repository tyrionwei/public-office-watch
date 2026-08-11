import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isAdministrativeCurrentOfficial,
  isGrassrootsPerson,
  missingSignals,
  parseArgs,
  processingPriority,
  priorityGroup,
} from './build-person-enrichment-targets.mjs';

const emptyHistory = { years: [], hasElectedHistory: false, electionCount: 0, latestElectionYear: null };

test('daily options are explicit and keep the default profile report unchanged', () => {
  assert.equal(parseArgs([]).includeResearchSignals, false);
  assert.deepEqual(parseArgs([
    '--include-research-signals',
    '--exclude-first-time-2026',
    '--exclude-administrative-current',
    '--include-grassroots-last',
    '--include-former',
  ]), {
    outputPath: parseArgs([]).outputPath,
    limit: 500,
    includeResearchSignals: true,
    excludeFirstTime2026: true,
    excludeAdministrativeCurrent: true,
    includeGrassrootsLast: true,
    includeFormer: true,
  });
});

test('research mode adds only missing family and legal signals', () => {
  const claims = new Map([['person-1', new Set(['family_relation'])]]);
  const missing = missingSignals({ person_id: 'person-1', education: '大學', experience: '議員' }, claims, true);
  assert.equal(missing.includes('family_relation'), false);
  assert.equal(missing.includes('legal_case'), true);
});

test('distinguishes first-time candidates and administrative current officials', () => {
  const firstTime = { list_status: 'candidate', election_year: 2026 };
  assert.equal(priorityGroup(firstTime, emptyHistory), 'first_time_2026_candidate');
  const administrator = { list_status: 'current', current_office_label: '臺北市副市長' };
  assert.equal(isAdministrativeCurrentOfficial(administrator), true);
  assert.equal(priorityGroup(administrator, emptyHistory), 'administrative_current_official');
});

test('puts grassroots current and elected people before never-elected candidates', () => {
  const current = { list_status: 'current', current_office_label: '大安區區長' };
  const former = { list_status: 'candidate', position: '里長' };
  const electedHistory = { years: [2022], hasElectedHistory: true, electionCount: 1, latestElectionYear: 2022 };
  const repeatedLosses = { years: [2022, 2018], hasElectedHistory: false, electionCount: 2, latestElectionYear: 2022 };
  const oneLoss = { years: [2022], hasElectedHistory: false, electionCount: 1, latestElectionYear: 2022 };

  assert.equal(isGrassrootsPerson(current), true);
  assert.equal(priorityGroup(current, oneLoss), 'grassroots_current');
  assert.equal(priorityGroup(former, electedHistory), 'grassroots_former_elected');
  assert.equal(priorityGroup(former, oneLoss), 'grassroots_never_elected');
  assert.ok(processingPriority(current, oneLoss) < processingPriority(former, electedHistory));
  assert.ok(processingPriority(former, electedHistory) < processingPriority(former, repeatedLosses));
  assert.ok(processingPriority(former, repeatedLosses) < processingPriority(former, oneLoss));
});

test('uses the current higher office instead of an older grassroots candidacy', () => {
  const currentCouncilor = {
    list_status: 'current',
    list_is_grassroots: true,
    current_office_label: '臺中市第13區議員',
  };
  assert.equal(isGrassrootsPerson(currentCouncilor), false);
  assert.equal(processingPriority(currentCouncilor, emptyHistory), 2);
});

test('prioritizes national and county leaders before councilors and grassroots roles', () => {
  const electedHistory = { years: [2022], hasElectedHistory: true, electionCount: 1, latestElectionYear: 2022 };
  assert.ok(processingPriority({ position: '總統' }, emptyHistory) < processingPriority({ position: '立法委員' }, emptyHistory));
  assert.ok(processingPriority({ position: '立法委員' }, emptyHistory) < processingPriority({ position: '臺北市議員' }, emptyHistory));
  assert.ok(processingPriority({ position: '臺北市議員' }, emptyHistory) < processingPriority({ position: '鎮長' }, emptyHistory));
  assert.ok(processingPriority({ position: '鎮長' }, emptyHistory) < processingPriority({ position: '里長' }, electedHistory));
});
