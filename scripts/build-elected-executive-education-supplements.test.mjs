import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data-sources', 'elected-executive-education-reviewed-targets-2026-08-10.json'), 'utf8')).targets;
const seed = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data-sources', 'elected-executive-education-supplements-2026-08-10.seed.json'), 'utf8'));

test('covers every elected executive education target exactly once', () => {
  assert.equal(seed.personClaims.length, targets.length);
  assert.equal(new Set(seed.personClaims.map((claim) => claim.personId)).size, targets.length);
  assert.deepEqual(
    [...new Set(seed.personClaims.map((claim) => claim.personId))].sort(),
    targets.map((target) => target.personId).sort(),
  );
});

test('publishes only manually reviewed education claims with sources', () => {
  for (const claim of seed.personClaims) {
    assert.equal(claim.claimType, 'education');
    assert.equal(claim.reviewStatus, 'verified');
    assert.equal(claim.visibility, 'public');
    assert.equal(claim.claimJson.manualReview.status, 'approved');
    assert.match(claim.sourceUrl, /^https:\/\//);
  }
});

test('does not mix lower schools into university-level profiles', () => {
  const allowedHighestBelowUniversity = new Set(['王慶豐', '張榮味', '傅學鵬', '廖永來', '謝深山']);
  for (const claim of seed.personClaims) {
    if (allowedHighestBelowUniversity.has(claim.personName)) continue;
    assert.doesNotMatch(claim.claimValue, /國民小學|國小|國民中學|國中|高級中學|高中|高工/);
  }
});
