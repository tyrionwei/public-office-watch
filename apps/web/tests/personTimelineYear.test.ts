import assert from 'node:assert/strict';
import test from 'node:test';
import { extractTimelineYear } from '../src/lib/personData.ts';

test('extracts western and Republic of China years for timeline items', () => {
  assert.equal(extractTimelineYear('2024年立法委員選舉'), 2024);
  assert.equal(extractTimelineYear('民國91年擔任主任'), 2002);
  assert.equal(extractTimelineYear('臺中市政府105年模範公務人員'), 2016);
});

test('does not treat short service durations as Republic of China years', () => {
  assert.equal(extractTimelineYear('幼兒園教師23年'), null);
  assert.equal(extractTimelineYear('義消經歷30年'), null);
});
