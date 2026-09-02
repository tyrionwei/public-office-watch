import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  scoreEntityMatch,
  isRetryableWikidataError,
  wikidataRetryDelayMs,
} from './fetch-wikidata-person-enrichment.mjs';

test('scheduled daily enrichment limits Wikidata retries', () => {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.match(packageJson.scripts['fetch:daily-person-enrichment'], /--retry-count 3(?:\s|$)/);
});

test('maxlag errors wait at least five seconds', () => {
  const error = new Error('Wikidata API failed: maxlag');
  error.wikidataErrorCode = 'maxlag';

  assert.equal(
    wikidataRetryDelayMs(error, { requestDelayMs: 1000 }, 0),
    5000,
  );
  assert.equal(isRetryableWikidataError(error), true);
});

test('retry delay uses exponential backoff capped at one minute', () => {
  const error = new Error('too many requests');

  assert.equal(
    wikidataRetryDelayMs(error, { requestDelayMs: 2500 }, 0),
    2500,
  );
  assert.equal(
    wikidataRetryDelayMs(error, { requestDelayMs: 2500 }, 3),
    20000,
  );
  assert.equal(
    wikidataRetryDelayMs(error, { requestDelayMs: 2500 }, 10),
    60000,
  );
});

test('server Retry-After takes precedence over local backoff', () => {
  const error = new Error('too many requests');
  error.retryAfterMs = 30000;

  assert.equal(
    wikidataRetryDelayMs(error, { requestDelayMs: 2500 }, 2),
    30000,
  );
});

test('non-retryable identity and input errors fail immediately', () => {
  assert.equal(isRetryableWikidataError(new Error('invalid target file')), false);
  assert.equal(isRetryableWikidataError({ httpStatus: 503 }), true);
});

const maleClaim = {
  mainsnak: {
    datavalue: {
      value: { id: 'Q6581097' },
    },
  },
};

const presidentClaim = {
  mainsnak: {
    datavalue: {
      value: { id: 'Q1' },
    },
  },
};

const identityEntity = {
  labels: { zh: { value: '測試人' } },
  descriptions: { zh: { value: '台灣政治人物' } },
  aliases: {},
  claims: {
    P21: [maleClaim],
    P39: [presidentClaim],
  },
};

const relatedEntities = {
  Q1: {
    labels: { zh: { value: '中華民國總統' } },
    descriptions: {},
  },
};

test('strong Wikidata identity evidence still qualifies for claims', () => {
  const match = scoreEntityMatch(
    { name: '測試人', gender: 'male', position: '中華民國總統' },
    identityEntity,
    { label: '測試人', description: '台灣政治人物' },
    relatedEntities,
  );

  assert.equal(match.matched, true);
  assert.equal(match.reviewEligible, true);
  assert.equal(match.evidenceCount, 4);
  assert.equal(match.evidence.position, true);
});

test('two-condition Wikidata candidates are retained for identity review', () => {
  const match = scoreEntityMatch(
    { name: '測試人', gender: 'unknown', position: '市長' },
    identityEntity,
    { label: '測試人', description: '台灣政治人物' },
    relatedEntities,
  );

  assert.equal(match.matched, false);
  assert.equal(match.reviewEligible, true);
  assert.equal(match.evidenceCount, 2);
  assert.deepEqual(match.hardConflicts, []);
});

test('missing target gender does not block otherwise supported identity matches', () => {
  const match = scoreEntityMatch(
    { name: '測試人', gender: 'unknown', position: '中華民國總統' },
    identityEntity,
    { label: '測試人', description: '台灣政治人物' },
    relatedEntities,
  );

  assert.equal(match.matched, true);
  assert.equal(match.reviewEligible, true);
  assert.equal(match.evidence.gender, false);
  assert.equal(match.evidence.position, true);
  assert.equal(match.evidenceCount, 3);
});

test('identity evidence records hard conflicts instead of hiding candidates', () => {
  const match = scoreEntityMatch(
    { name: '測試人', gender: 'female', position: '中華民國總統' },
    identityEntity,
    { label: '測試人', description: '台灣政治人物' },
    relatedEntities,
  );

  assert.equal(match.matched, false);
  assert.equal(match.reviewEligible, false);
  assert.match(match.hardConflicts[0], /gender mismatch/);
});
