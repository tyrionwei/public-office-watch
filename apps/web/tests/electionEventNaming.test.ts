import assert from 'node:assert/strict';
import test from 'node:test';
import { buildElectionEvents } from '../src/data/electionEvents.ts';
import { translateElectionEventTitle } from '../src/data/electionI18n.ts';
import type { PublicElection } from '../src/types/publicViews.ts';

function election(overrides: Partial<PublicElection> & Pick<PublicElection, 'election_id' | 'name' | 'year' | 'election_type' | 'voting_date'>): PublicElection {
  return {
    status: 'completed',
    source_name: '中央選舉委員會',
    source_url: null,
    ...overrides,
  };
}

test('keeps pre-2014 local offices as separate election events', () => {
  const events = buildElectionEvents([
    election({
      election_id: '2010-mayor',
      name: '2010年直轄市長選舉',
      year: 2010,
      election_type: 'local',
      voting_date: '2010-11-27',
    }),
    election({
      election_id: '2010-councilor',
      name: '2010年直轄市議員選舉',
      year: 2010,
      election_type: 'councilor',
      voting_date: '2010-11-27',
    }),
  ], []);

  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => event.title).sort(), [
    '2010年直轄市議員選舉',
    '2010年直轄市長選舉',
  ]);
  assert.deepEqual(events.map((event) => event.key).sort(), [
    '2010-2010-11-27-local',
    '2010-2010-11-27-local-councilor',
  ]);
});

test('continues grouping local offices as a nine-in-one event from 2014 onward', () => {
  const events = buildElectionEvents([
    election({
      election_id: '2014-mayor',
      name: '2014年直轄市及縣市長選舉',
      year: 2014,
      election_type: 'local',
      voting_date: '2014-11-29',
    }),
    election({
      election_id: '2014-councilor',
      name: '2014年直轄市及縣市議員選舉',
      year: 2014,
      election_type: 'councilor',
      voting_date: '2014-11-29',
    }),
  ], []);

  assert.equal(events.length, 1);
  assert.equal(events[0].key, '2014-2014-11-29-local');
  assert.match(events[0].title, /九合一/);
});

test('translates legacy local election titles by their actual office scope', () => {
  const [event] = buildElectionEvents([
    election({
      election_id: '2009-county-mayor',
      name: '2009年縣市長選舉',
      year: 2009,
      election_type: 'local',
      voting_date: '2009-12-05',
    }),
  ], []);
  const t = ((key: string, values?: Record<string, string | number>) => `${key}:${values?.year}`) as never;

  assert.equal(translateElectionEventTitle(event, t), 'event.title.countyCityMayor:2009');
});
