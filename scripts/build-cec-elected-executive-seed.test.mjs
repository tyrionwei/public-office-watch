import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seed = JSON.parse(fs.readFileSync(
  path.join(repoRoot, 'data-sources', 'cec-elected-executive-election-history-1994-2014.seed.json'),
  'utf8',
));

function assertUnique(items, field) {
  assert.equal(new Set(items.map((item) => item[field])).size, items.length);
}

test('builds the complete elected executive scope with stable unique identifiers', () => {
  assert.equal(seed.summary.personCount, 85);
  assert.equal(seed.summary.newHistoricalPersonCount, 42);
  assert.equal(seed.summary.candidateCount, 131);
  assert.equal(seed.summary.raceCount, 126);
  assertUnique(seed.people, 'externalId');
  assertUnique(seed.elections, 'externalId');
  assertUnique(seed.races, 'externalId');
  assertUnique(seed.candidates, 'externalId');
  assertUnique(seed.sourcePeople, 'sourcePersonKey');
  assert.ok(seed.people.every((person) => person.isPublic));
});

test('new historical people are not presented as current officeholders', () => {
  const newPeople = seed.people.filter((person) =>
    person.sourcePayload.identitySelection === 'new_person_from_official_elected_record');
  assert.equal(newPeople.length, 42);
  for (const person of newPeople) {
    assert.match(person.position, /^曾任/);
    assert.equal(person.party, null);
    assert.match(person.sourcePayload.currentStatusPolicy, /Historical elected office/);
  }
});

test('reviewed duplicate identities select the intended canonical public people', () => {
  assert.equal(seed.people.find((person) => person.name === '黃敏惠')?.externalId, 'votetw-person-050c1cb8f8324450');
  assert.equal(seed.people.find((person) => person.name === '賴清德')?.externalId, 'votetw-person-dfa78bb8c53fc15c');
  assert.equal(seed.people.find((person) => person.name === '陳福海')?.externalId, 'cec-2022-local-mayor-person-1a37920d575e');
});

test('does not reuse same-name people whose office and region contradict the official record', () => {
  for (const name of ['陳建年', '楊秋興', '蘇文雄']) {
    const person = seed.people.find((candidate) => candidate.name === name);
    assert.match(person?.externalId ?? '', /^cec-elected-executive-person-/);
    assert.match(person?.position ?? '', /^曾任/);
    assert.equal(person?.sourcePayload.identityResolution, 'created_from_official_elected_record');
  }
});

test('election-time incumbency and ticket role remain historical candidate facts', () => {
  assert.equal(seed.candidates.filter((candidate) => candidate.sourcePayload.ticketRole === 'president').length, 5);
  assert.equal(seed.candidates.filter((candidate) => candidate.sourcePayload.ticketRole === 'vice_president').length, 5);
  assert.equal(seed.candidates.filter((candidate) => candidate.sourcePayload.ticketRole === 'local_chief').length, 121);
  assert.ok(seed.candidates.every((candidate) => candidate.isElected));
  assert.ok(seed.candidates.every((candidate) => Number.isFinite(candidate.voteCount)));
  assert.ok(seed.candidates.every((candidate) => Number.isFinite(candidate.voteRate)));
});

test('reuses the existing 2012 presidential election and race identifiers', () => {
  assert.ok(seed.elections.some((election) => election.externalId === 'cec-2012-president-vice-president'));
  assert.ok(seed.races.some((race) => race.externalId === 'cec-2012-president-national'));
});
