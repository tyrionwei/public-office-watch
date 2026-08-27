import assert from 'node:assert/strict';
import test from 'node:test';

import {
  candidateAgeGroup,
  defaultFemaleCandidateSprites,
  defaultMaleCandidateSprites,
  pickDefaultCandidateSprite,
  pickDefaultCandidateSpriteForAgeGroup,
  pickPersonCandidateSprite,
  personCandidateSprites,
  xiezhiMascotSprite,
} from '../src/data/defaultCharacterAssets.ts';

const referenceDate = new Date(2026, 7, 9);

test('maps complete birth dates to the agreed four age groups', () => {
  assert.equal(candidateAgeGroup('1986-08-10', referenceDate), 'under-40');
  assert.equal(candidateAgeGroup('1986-08-09', referenceDate), '40-49');
  assert.equal(candidateAgeGroup('1976/08/09', referenceDate), '50-59');
  assert.equal(candidateAgeGroup('1966\u5e7408\u670809\u65e5', referenceDate), '60-plus');
  assert.equal(candidateAgeGroup('\u6c11\u570b75\u5e7408\u670809\u65e5', referenceDate), '40-49');
});

test('uses gender and age together to select one deterministic sprite', () => {
  assert.equal(
    pickDefaultCandidateSprite('person-a', 'male', '1990-01-01', referenceDate),
    defaultMaleCandidateSprites[0],
  );
  assert.equal(
    pickDefaultCandidateSprite('person-b', 'female', '1980-01-01', referenceDate),
    defaultFemaleCandidateSprites[1],
  );
  assert.equal(
    pickDefaultCandidateSprite('person-c', 'male', '1970-01-01', referenceDate),
    defaultMaleCandidateSprites[2],
  );
  assert.equal(
    pickDefaultCandidateSprite('person-d', 'female', '1960-01-01', referenceDate),
    defaultFemaleCandidateSprites[3],
  );
});

test('uses a server-provided age group without exposing the birth date', () => {
  assert.equal(
    pickDefaultCandidateSpriteForAgeGroup('female', '50-59'),
    defaultFemaleCandidateSprites[2],
  );
  assert.equal(pickDefaultCandidateSpriteForAgeGroup('male', null), xiezhiMascotSprite);
});

test('falls back to the Xiezhi mascot when gender or exact birth date is unavailable', () => {
  assert.equal(pickDefaultCandidateSprite('person-a', null, '1980-01-01', referenceDate), xiezhiMascotSprite);
  assert.equal(pickDefaultCandidateSprite('person-b', 'unknown', '1980-01-01', referenceDate), xiezhiMascotSprite);
  assert.equal(pickDefaultCandidateSprite('person-c', 'female', null, referenceDate), xiezhiMascotSprite);
  assert.equal(pickDefaultCandidateSprite('person-d', 'male', '1980', referenceDate), xiezhiMascotSprite);
  assert.equal(pickDefaultCandidateSprite('person-e', 'male', 'not-a-date', referenceDate), xiezhiMascotSprite);
});

test('uses canonical person IDs for configured candidate sprites', () => {
  assert.equal(Object.keys(personCandidateSprites).length, 45);
  for (const [personId, spritePath] of Object.entries(personCandidateSprites)) {
    assert.match(personId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.equal(spritePath, `/assets/characters/candidates/${personId}.png`);
  }

  assert.equal(
    pickPersonCandidateSprite('A4A44DFF-EFA9-45CC-8371-CBAA4CF6772D'),
    '/assets/characters/candidates/a4a44dff-efa9-45cc-8371-cbaa4cf6772d.png',
  );
  assert.equal(
    pickPersonCandidateSprite('20915299-0469-47b7-ae81-cf499a806a1a'),
    '/assets/characters/candidates/20915299-0469-47b7-ae81-cf499a806a1a.png',
  );
  for (const personId of [
    '7ceadf52-bdeb-45ae-9542-9fd3ace7a502',
    '880f8fb6-84d7-44e1-a38a-818707dcd22e',
    'e333ae37-8821-4f98-8a90-54a4d217dbce',
    '1d6d74ef-ea70-4503-bc59-6bf36d9f25cf',
    '0d12b2a3-6c0f-4533-bc7b-d130f8604443',
    '997ccfba-3c27-41e0-a6cf-cdfd42dbcbf0',
  ]) {
    assert.equal(
      pickPersonCandidateSprite(personId),
      `/assets/characters/candidates/${personId}.png`,
    );
  }
  assert.equal(pickPersonCandidateSprite('b81440cf-865f-419a-96a0-c362a4e7eaba'), null);
  assert.equal(pickPersonCandidateSprite(null), null);
});
