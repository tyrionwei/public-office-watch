import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertNoMigrationDrift,
  parseMigrationDryRunOutput,
} from '../scripts/check-production-migration-drift.mjs';

test('accepts an up-to-date migration report', () => {
  const report = assertNoMigrationDrift('Connecting...\n{"upToDate":true,"migrations":[]}');

  assert.deepEqual(report, {
    upToDate: true,
    migrations: [],
  });
});

test('rejects pending production migrations', () => {
  assert.throws(
    () =>
      assertNoMigrationDrift(
        '{"upToDate":false,"migrations":["20260901010101_example.sql"]}',
      ),
    /20260901010101_example\.sql/u,
  );
});

test('rejects malformed dry-run output', () => {
  assert.throws(
    () => parseMigrationDryRunOutput('Connecting...\nNo JSON report'),
    /did not return a migration report/u,
  );
});
