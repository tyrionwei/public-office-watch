import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildMigration,
  releaseRows,
  validateReviewedSnapshot,
} from './build-reviewed-candidate-finance-release-migration.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snapshotPath = path.join(
  repoRoot,
  'data-sources',
  'cy',
  '2022-election',
  'reviewed-mayor-finance-summaries-2026-08-24.json',
);

function loadSnapshot() {
  return JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
}

test('validates the reviewed 71-row candidate finance release', () => {
  const snapshot = validateReviewedSnapshot(loadSnapshot());
  assert.equal(snapshot.rows.length, 71);
  assert.equal(releaseRows(snapshot).length, 71);
});

test('builds an atomic migration with identity and published-layer checks', () => {
  const sql = buildMigration(loadSnapshot());
  assert.match(sql, /^BEGIN;/u);
  assert.match(sql, /Candidate finance release identity or publication boundary is invalid/u);
  assert.match(sql, /FROM published\.person_claims claim/u);
  assert.match(sql, /JOIN public\.person_claims stored ON stored\.id = claim\.claim_id/u);
  assert.match(sql, /candidate_aggregate_only_no_donor_payee_or_transaction_details/u);
  assert.match(sql, /COMMIT;\n$/u);
});

test('keeps candidate finance summaries in production-shaped rehearsal data', () => {
  const rehearsalScript = fs.readFileSync(path.join(repoRoot, 'scripts', 'production-rehearsal.sh'), 'utf8');
  assert.match(rehearsalScript, /claim_type IN \([^)]*'finance_summary'/u);
});

test('omits private audit payloads from the production-shaped rehearsal copy', () => {
  const rehearsalScript = fs.readFileSync(path.join(repoRoot, 'scripts', 'production-rehearsal.sh'), 'utf8');
  assert.match(rehearsalScript, /copy_table person_merge_decisions TRUE[\s\S]*'\{\}'::JSONB/u);
  assert.match(rehearsalScript, /copy_table person_party_affiliations[\s\S]*'\{\}'::JSONB/u);
  assert.match(rehearsalScript, /local projection="\$\{3:-\*\}"/u);
});

test('rejects count drift, ambiguity and privacy-boundary drift', () => {
  const countDrift = loadSnapshot();
  countDrift.rows.pop();
  assert.throws(() => validateReviewedSnapshot(countDrift), /count or ambiguity drift/u);

  const ambiguous = loadSnapshot();
  ambiguous.ambiguousCount = 1;
  ambiguous.ambiguous = [{ candidateName: '測試' }];
  assert.throws(() => validateReviewedSnapshot(ambiguous), /count or ambiguity drift/u);

  const privacyDrift = loadSnapshot();
  privacyDrift.rows[0].claim_json.privacyBoundary = 'includes_transaction_details';
  assert.throws(() => validateReviewedSnapshot(privacyDrift), /evidence is incomplete/u);
});
