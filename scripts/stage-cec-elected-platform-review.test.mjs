import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertLocalSupabase,
  buildPendingClaim,
  sanitizeExtractedText,
} from './stage-cec-elected-platform-review.mjs';

test('assertLocalSupabase rejects non-local writes', () => {
  assert.doesNotThrow(() => assertLocalSupabase('http://127.0.0.1:54321'));
  assert.throws(() => assertLocalSupabase('https://project.supabase.co'), /local-only/u);
});

test('buildPendingClaim keeps OCR variants private and non-canonical', () => {
  const row = buildPendingClaim({
    candidate_id: 'candidate-id',
    person_id: 'person-id',
    race_id: 'race-id',
    election_id: 'election-id',
    election_name: '2022年測試選舉',
    sourceDocument: {
      file: 'tmp/source.pdf',
      url: 'https://eebulletin.cec.gov.tw/source.pdf',
      sha256: 'a'.repeat(64),
    },
    extraction: {
      status: 'ocr_ready',
      crop: { page: 1 },
      cropFile: 'tmp/crop.png',
      textLayer: 'PDF文字',
      ocrText: 'OCR文字',
      bestOcrText: '高精度OCR文字',
    },
  }, 'candidate-external-id');
  assert.equal(row.review_status, 'pending');
  assert.equal(row.visibility, 'private');
  assert.equal(row.is_public, false);
  assert.equal('platformText' in row.claim_json, false);
  assert.equal(row.claim_json.publicationGate.status, 'pending_manual_transcription');
  assert.equal(row.claim_key, 'cec-platform:2022:candidate-external-id');
});

test('buildPendingClaim uses the current canonical local person ID', () => {
  const row = buildPendingClaim({
    candidate_id: 'candidate-id', person_id: 'source-person-id', race_id: 'race-id', election_id: 'election-id',
    election_name: '2022年測試選舉', sourceDocument: { file: 'tmp/source.pdf', url: 'https://eebulletin.cec.gov.tw/source.pdf', sha256: 'a'.repeat(64) },
    extraction: { status: 'ocr_ready', crop: { page: 1 }, cropFile: 'tmp/crop.png', ocrText: '文字' },
  }, 'candidate-external-id', 'canonical-person-id');
  assert.equal(row.person_id, 'canonical-person-id');
});

test('sanitizeExtractedText removes Postgres-invalid control characters', () => {
  assert.equal(sanitizeExtractedText('政見\u0000文字\u0007'), '政見文字');
});

test('buildPendingClaim supports 2024 and lowers unverified-name claims', () => {
  const row = buildPendingClaim({
    candidate_id: 'candidate-id',
    person_id: 'person-id',
    race_id: 'race-id',
    election_id: 'election-id',
    election_year: 2024,
    election_name: '第11屆立法委員選舉',
    matchStatus: 'matched_unique_path_name_unverified',
    sourceDocument: { file: 'tmp/source.pdf', url: 'https://bulletin.cec.gov.tw/source.pdf', sha256: 'a'.repeat(64) },
    extraction: { status: 'ocr_ready', crop: { page: 1 }, cropFile: 'tmp/crop.png', ocrText: '文字' },
  }, 'candidate-external-id');
  assert.equal(row.claim_key, 'cec-platform:2024:candidate-external-id');
  assert.equal(row.confidence_level, 'C');
  assert.equal(row.review_score, 55);
  assert.equal(row.observed_at, '2024-01-13T00:00:00+08:00');
});

test('buildPendingClaim keeps unresolved layouts private for manual localization', () => {
  const row = buildPendingClaim({
    candidate_id: 'candidate-id',
    person_id: 'person-id',
    race_id: 'race-id',
    election_id: 'election-id',
    election_year: 2024, election_name: '第11屆立法委員選舉',
    matchStatus: 'matched_unique_name',
    sourceDocument: { file: 'tmp/source.pdf', url: 'https://bulletin.cec.gov.tw/source.pdf', sha256: 'a'.repeat(64) },
    extraction: { status: 'needs_manual_localization' },
  }, 'candidate-external-id');
  assert.equal(row.claim_json.publicationGate.status, 'pending_manual_localization');
  assert.equal(row.is_public, false);
  assert.equal(row.review_score, 60);
});
