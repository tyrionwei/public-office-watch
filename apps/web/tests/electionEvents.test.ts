import assert from 'node:assert/strict';
import test from 'node:test';
import { getElectionEventForElection } from '../src/data/electionEventLookup.ts';

test('resolves every election in a grouped event to the same bounded event page', () => {
  const events = [
    {
      key: '2022-2022-11-26-local',
      elections: [
        { election_id: 'election-mayor' },
        { election_id: 'election-councilor' },
      ],
    },
  ];

  assert.equal(
    getElectionEventForElection(events, 'election-mayor')?.key,
    '2022-2022-11-26-local',
  );
  assert.equal(
    getElectionEventForElection(events, 'election-councilor')?.key,
    '2022-2022-11-26-local',
  );
});

test('returns null for an election id outside the bounded index', () => {
  const events = [{
    key: '2022-2022-11-26-local',
    elections: [{ election_id: 'election-1' }],
  }];

  assert.equal(getElectionEventForElection(events, 'missing-election'), null);
});
