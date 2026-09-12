import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
test('release generator and migration preserve the same person and party voting rules', () => {
  const canonical = read('../../../scripts/sql/platform-fulfillment-results.sql');
  const migration = read('../../../supabase/migrations/20260912143207_add_elected_office_term_calendar.sql');
  const functionSql = canonical.slice(canonical.indexOf('CREATE OR REPLACE FUNCTION')).trim();
  assert.ok(migration.includes(functionSql), 'migration must ship the canonical function');
  const generator = read('../../../scripts/build-platform-fulfillment-release-migration.mjs');
  assert.ok(generator.includes("'scripts/sql/platform-fulfillment-results.sql'"));
  assert.ok(!generator.includes('CREATE OR REPLACE FUNCTION published.platform_fulfillment_results'));
  assert.ok(!/election\.year/.test(canonical));
  assert.ok(canonical.includes('public.platform_fulfillment_vote_claim_id(p_claim_id)'));
  assert.ok(canonical.includes('FROM public.party_platform_fulfillment_votes'));
});
