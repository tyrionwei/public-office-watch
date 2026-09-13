import assert from 'node:assert/strict';
import test from 'node:test';
import { feedbackEnvironmentMatches } from '../src/lib/feedbackEnvironment.ts';
test('feedback environments cannot cross local and hosted boundaries', () => {
  assert.equal(feedbackEnvironmentMatches('http://127.0.0.1:5181','http://127.0.0.1:54321'),true);
  assert.equal(feedbackEnvironmentMatches('http://localhost:5179','https://production.supabase.co'),false);
  assert.equal(feedbackEnvironmentMatches('https://pow4vote.org','http://127.0.0.1:54321'),false);
  assert.equal(feedbackEnvironmentMatches('https://pow4vote.org','https://production.supabase.co'),true);
  assert.equal(feedbackEnvironmentMatches('http://localhost:5179','http://localhost.evil.test'),false);
  assert.equal(feedbackEnvironmentMatches('http://localhost:5179','bad-url'),false);
});
