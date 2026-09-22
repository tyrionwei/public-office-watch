import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildTnlLegalClaimPreview } from '../preview-tnl-dark-guide-legal-claims.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('the reviewed dataset remains 177 classified rows and 32 safe preview candidates', () => {
  const report = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'data-sources', 'tnl-dark-guide', 'source-research-report.json'),
    'utf8',
  ));
  const legalRows = report.claims.filter((row) => row.category === '涉案紀錄');
  const people = [...new Map(legalRows.map((row) => [
    row.canonicalPersonId,
    { id: row.canonicalPersonId, name: row.personName, is_public: true },
  ])).values()];
  const preview = buildTnlLegalClaimPreview({
    sourceResearchReport: report,
    people,
  });

  assert.equal(preview.summary.legalResearchRows, 177);
  assert.equal(preview.summary.autoReviewableResearchRows, 32);
  assert.equal(preview.summary.plannedReviewClaims, 32);
  assert.equal(preview.summary.heldResearchRows, 0);
  assert.equal(preview.policy.databaseWrites, false);
  assert.equal(preview.policy.originalGuideTextPublished, false);
  assert.equal(preview.policy.legalCasePublicEligible, false);
});
