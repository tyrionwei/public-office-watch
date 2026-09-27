import assert from 'node:assert/strict';
import test from 'node:test';
import { mapPublicCandidateRow } from '../src/lib/supabasePublicViewMappers.ts';
import { hasCandidatePerson } from '../src/lib/candidateIdentity.ts';
import { groupRaceCandidates } from '../src/lib/raceCandidateGroups.ts';
import { buildPersonListItems } from '../src/lib/personData.ts';
import { buildElectionEducationDistribution } from '../src/lib/electionStatistics.ts';
import type { PublicRace } from '../src/types/publicViews.ts';

const nameOnly = (id: string) => mapPublicCandidateRow({
  candidate_id: id, person_id: null, person_name: '同名候選人',
  race_id: 'race-1', race_title: '里長選舉', election_id: 'election-1', vote_count: 123,
});

test('name-only public rows retain null identity, display name and election facts', () => {
  const candidate = nameOnly('candidate-1');
  assert.equal(candidate.person_id, null);
  assert.equal(candidate.person_name, '同名候選人');
  assert.equal(candidate.vote_count, 123);
  assert.equal(mapPublicCandidateRow({}).person_id, null);
  assert.equal(hasCandidatePerson(candidate), false);
  assert.equal(hasCandidatePerson(mapPublicCandidateRow({ person_id: 'person-1' })), true);
});

test('same-name records remain separate candidates and never enter person comparison or lists', () => {
  const records = [nameOnly('candidate-1'), nameOnly('candidate-2')];
  assert.equal(groupRaceCandidates(records, '里長選舉').length, 2);
  // Also keep candidate identity when a caller groups a ticket without person IDs.
  assert.equal(groupRaceCandidates(records, '總統副總統選舉')[0].members.length, 2);
  assert.deepEqual(records.filter(hasCandidatePerson), []);
  assert.deepEqual(buildPersonListItems([], records, []), []);
});

test('name-only candidates still count in education statistics without sharing a null person', () => {
  const rows = buildElectionEducationDistribution(
    [nameOnly('candidate-1'), nameOnly('candidate-2')],
    [{ race_id: 'race-1', election_id: 'election-1', race_type: 'village_chief' } as PublicRace],
    [], [], ['election-1'],
  );
  assert.equal(rows.reduce((sum, row) => sum + row.candidate_count, 0), 2);
});
