import assert from 'node:assert/strict';
import test from 'node:test';
import { getPersonRole } from '../src/lib/personData.ts';
import { mapPublicCandidateRow } from '../src/lib/supabasePublicViewMappers.ts';

test('county and city leaders require an actual county or county-level city title', () => {
  for (const title of ['屏東縣長', '花蓮縣縣長', '新竹縣縣長', '臺北市長', '新竹市市長', '嘉義市長選舉', '縣市長']) {
    assert.equal(getPersonRole(title), 'local_chief', title);
  }
  assert.equal(getPersonRole('市長', [], '臺北市'), 'local_chief');
  assert.equal(getPersonRole('市長', [], '新竹縣'), 'other');
});

test('township titles and township names containing 縣長 do not become county leaders', () => {
  for (const title of [
    '屏東縣長治鄉鄉長',
    '屏東縣長治鄉第1區鄉民代表',
    '臺東縣長濱鄉鄉長',
    '苗栗縣頭份市市長',
    '新竹縣竹北市市長',
    '宜蘭市長',
    '鄉鎮市長',
  ]) {
    assert.notEqual(getPersonRole(title), 'local_chief', title);
  }
});

test('deputy mayors follow the same county-level boundary', () => {
  assert.equal(getPersonRole('臺北市副市長'), 'local_deputy');
  assert.equal(getPersonRole('副市長', [], '臺北市'), 'local_deputy');
  assert.notEqual(getPersonRole('新竹縣竹北市副市長'), 'local_deputy');
});

test('current township mayor candidacy is not reclassified from a broad 市長 label', () => {
  const candidate = mapPublicCandidateRow({
    candidate_id: 'candidate-township-mayor',
    person_id: 'person-township-mayor',
    person_name: '測試人',
    person_position: '市長',
    race_id: 'township-race',
    race_title: '新竹縣竹北市市長選舉',
    election_id: '2022-local',
    election_name: '2022年地方公職人員選舉',
    election_year: 2022,
    region_name: '新竹縣',
    election_result: 'elected',
    is_elected: true,
  });
  assert.notEqual(getPersonRole('市長', [candidate], '新竹縣'), 'local_chief');
});
