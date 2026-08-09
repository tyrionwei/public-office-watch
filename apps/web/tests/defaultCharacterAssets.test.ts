import assert from 'node:assert/strict';
import test from 'node:test';

import {
  candidateAgeGroup,
  defaultFemaleCandidateSprites,
  defaultMaleCandidateSprites,
  pickDefaultCandidateSprite,
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

test('falls back to the Xiezhi mascot when gender or exact birth date is unavailable', () => {
  assert.equal(pickDefaultCandidateSprite('person-a', null, '1980-01-01', referenceDate), xiezhiMascotSprite);
  assert.equal(pickDefaultCandidateSprite('person-b', 'unknown', '1980-01-01', referenceDate), xiezhiMascotSprite);
  assert.equal(pickDefaultCandidateSprite('person-c', 'female', null, referenceDate), xiezhiMascotSprite);
  assert.equal(pickDefaultCandidateSprite('person-d', 'male', '1980', referenceDate), xiezhiMascotSprite);
  assert.equal(pickDefaultCandidateSprite('person-e', 'male', 'not-a-date', referenceDate), xiezhiMascotSprite);
});
