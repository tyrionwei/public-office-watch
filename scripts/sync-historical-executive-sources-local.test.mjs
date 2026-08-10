import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  buildHistoricalChiefRows,
  isLocalSupabaseUrl,
} from './sync-historical-executive-sources-local.mjs';

test('refuses production-style Supabase URLs', () => {
  assert.equal(isLocalSupabaseUrl('http://127.0.0.1:54321'), true);
  assert.equal(isLocalSupabaseUrl('http://localhost:54321'), true);
  assert.equal(isLocalSupabaseUrl('https://example.supabase.co'), false);
});

test('builds private C-confidence historical local-chief source people', () => {
  const source = JSON.parse(fs.readFileSync('data-sources/historical-local-chief-winners-1950-1993.raw.json', 'utf8'));
  const rows = buildHistoricalChiefRows(source);
  assert.equal(rows.length, 165);
  assert.ok(rows.every((row) => row.source_type === 'wikipedia'));
  assert.ok(rows.every((row) => row.confidence_suggestion === 'C'));
  assert.ok(rows.every((row) => row.is_public === false));
  assert.ok(rows.every((row) => row.source_payload.publicationStatus === 'archived'));
  assert.ok(rows.every((row) => row.ingest_batch_key === 'historical-executive-archive-20260810'));
});
