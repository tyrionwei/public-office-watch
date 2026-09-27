import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('registration SQL rejects a missing or different claim candidate before inserting events', () => {
  const source = fs.readFileSync(new URL('./import-cec-registration-lifecycle.mjs', import.meta.url), 'utf8');
  const check = source.slice(source.indexOf('DO $check$'), source.indexOf('INSERT INTO public.candidate_lifecycle_events'));
  assert.match(check, /LEFT JOIN public\.person_claims claim ON claim\.id = i\.claim_id/);
  assert.match(check, /OR claim\.candidate_id IS DISTINCT FROM c\.id/);
  assert.match(check, /THEN RAISE EXCEPTION 'Registration evidence no longer matches reviewed local data'/);
  assert.doesNotMatch(check, /person_id/);
});
