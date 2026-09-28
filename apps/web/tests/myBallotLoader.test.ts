import assert from 'node:assert/strict';
import test from 'node:test';
import { loadMyBallotModule } from '../src/lib/useMyBallot.ts';

test('parallel ballot lookups share one mapping load', async () => {
  const first = loadMyBallotModule();
  const second = loadMyBallotModule();
  assert.strictEqual(first, second);
  const module = await first;
  assert.ok(module.localBallotMappings.length > 0);
  assert.strictEqual((await loadMyBallotModule()).queryMyBallot, module.queryMyBallot);
});
