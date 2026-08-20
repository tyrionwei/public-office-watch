import assert from 'node:assert/strict';
import test from 'node:test';
import { findProfileSection, lineText } from './extract-cec-2024-profile-review.mjs';

function word(text, xMin, yMin, xMax, yMax) {
  return { text, xMin, yMin, xMax, yMax };
}

test('joins adjacent Chinese words and preserves separated Latin words', () => {
  assert.equal(lineText([
    word('國立', 10, 10, 30, 20),
    word('大學', 31, 10, 50, 20),
    word('Master', 60, 10, 90, 20),
    word('Degree', 94, 10, 125, 20),
  ]), '國立大學Master Degree');
});

test('extracts education and experience from candidate profile columns', () => {
  const page = {
    page: 1,
    width: 800,
    height: 600,
    words: [
      word('號次·姓名', 40, 40, 100, 50),
      word('學歷', 150, 40, 180, 50),
      word('經歷', 280, 40, 310, 50),
      word('徐欣瑩', 55, 75, 100, 90),
      word('國立交通大學', 130, 70, 210, 82),
      word('博士', 130, 86, 160, 98),
      word('第八屆立法委員', 250, 70, 340, 82),
      word('專業測量技師', 250, 86, 330, 98),
      word('政見', 180, 130, 210, 142),
    ],
  };
  const result = findProfileSection({ person_name: '徐欣瑩' }, [page]);
  assert.equal(result.status, 'extracted');
  assert.equal(result.education, '國立交通大學\n博士');
  assert.equal(result.experience, '第八屆立法委員\n專業測量技師');
});
