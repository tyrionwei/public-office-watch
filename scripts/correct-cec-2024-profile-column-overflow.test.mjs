import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCorrections } from './correct-cec-2024-profile-column-overflow.mjs';

test('creates a missing profile field from the same official bulletin record', () => {
  const seed = {
    personClaims: [{
      claimKey: 'official-profile:party-list:person:experience',
      personId: 'person-id',
      personName: '測試人物',
      claimType: 'experience',
      claimValue: '學歷誤併入經歷',
      claimJson: { value: '學歷誤併入經歷', items: ['學歷誤併入經歷'], sourceDocument: { page: 2 } },
      sourceName: '中央選舉委員會：選舉公報',
    }],
  };

  applyCorrections(seed, { 測試人物: { education: '正式學歷', experience: '正式經歷' } });

  assert.equal(seed.personClaims.length, 2);
  const education = seed.personClaims.find((claim) => claim.claimType === 'education');
  assert.equal(education.claimKey, 'official-profile:party-list:person:education');
  assert.equal(education.claimValue, '正式學歷');
  assert.equal(education.claimJson.sourceDocument.page, 2);
  assert.equal(seed.personClaims.find((claim) => claim.claimType === 'experience').claimValue, '正式經歷');
});
