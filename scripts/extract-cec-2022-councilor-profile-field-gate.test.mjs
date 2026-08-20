import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanProfileField } from './extract-cec-2022-councilor-profile-ocr-review.mjs';

test('rejects OCR that contains only a profile heading or Latin noise', () => {
  assert.equal(cleanProfileField('學   歷', '學歷'), '');
  assert.equal(cleanProfileField('ASS e', '學歷'), '');
});

test('keeps substantive Chinese profile content and removes a repeated heading', () => {
  assert.equal(cleanProfileField('學 歷\n國立臺灣大學畢業', '學歷'), '國立臺灣大學畢業');
});
