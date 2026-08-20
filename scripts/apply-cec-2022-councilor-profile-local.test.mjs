import assert from 'node:assert/strict';
import test from 'node:test';
import { basicValuesCompatible, canonicalPersonId, isNewerOfficialProfileClaim, personTypeKey } from './apply-cec-2022-councilor-profile-local.mjs';

test('protects a newer official CEC profile claim', () => {
  assert.equal(isNewerOfficialProfileClaim({
    claim_type: 'education',
    claim_json: { profileSource: 'cec_election_bulletin', electionYear: 2024 },
    visibility: 'public',
  }), true);
  assert.equal(isNewerOfficialProfileClaim({
    claim_type: 'education',
    claim_json: { profileSource: 'cec_election_bulletin', electionYear: 2022 },
    visibility: 'public',
  }), false);
});

test('deduplicates exact basic values and compatible partial birth years', () => {
  assert.equal(basicValuesCompatible('gender', '女', '女'), true);
  assert.equal(basicValuesCompatible('gender', '男', '女'), false);
  assert.equal(basicValuesCompatible('birth_date', '1979', '1979-02-11'), true);
  assert.equal(basicValuesCompatible('birth_date', '1978-02-11', '1979-02-11'), false);
});

test('targets canonical people when a reviewed bulletin claim belongs to a merged source person', () => {
  const canonicalMap = new Map([['source-person', 'canonical-person']]);
  assert.equal(canonicalPersonId('source-person', canonicalMap), 'canonical-person');
  assert.equal(canonicalPersonId('unmerged-person', canonicalMap), 'unmerged-person');
  assert.equal(personTypeKey('source-person', 'education', canonicalMap), 'canonical-person:education');
});
