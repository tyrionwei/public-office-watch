import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanExperienceText,
  findProfileSection,
  findVerticalPhraseMatches,
  parseRocBirthDate,
} from './extract-cec-2022-councilor-profile-review.mjs';

function word(text, xMin, yMin, xMax, yMax) {
  return { text, xMin, yMin, xMax, yMax };
}

function vertical(text, x, y, gap = 13) {
  return [...text].map((character, index) => word(character, x, y + (index * gap), x + 10, y + 10 + (index * gap)));
}

test('finds vertically printed candidate names', () => {
  const page = { page: 1, width: 800, height: 600, words: vertical('鄭光宏', 120, 100) };
  const matches = findVerticalPhraseMatches(page, '鄭光宏');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].orientation, 'vertical');
});

test('uses the exact candidate number when the candidate name is absent from the PDF text layer', () => {
  const words = [
    ...vertical('出生地', 220, 30),
    ...vertical('推薦之政黨', 260, 20),
    word('學歷', 340, 40, 370, 52),
    word('經歷', 500, 40, 530, 52),
    word('政見', 680, 40, 710, 52),
    word('1', 50, 100, 70, 126),
    word('54年5月30日', 120, 100, 170, 112),
    word('男', 180, 100, 190, 112),
    ...vertical('無', 260, 100),
    word('國立大學', 300, 100, 390, 112),
    word('現任議員', 470, 100, 540, 112),
    word('2', 50, 200, 70, 226),
    word('不應混入', 300, 200, 390, 212),
  ];
  const page = { page: 1, width: 800, height: 600, words };
  const entry = {
    person_name: '文字層沒有姓名',
    candidate_no: '1',
    race_title: '測試縣第1選舉區議員選舉',
    raceCandidates: [{ candidateNo: '1' }, { candidateNo: '2' }],
  };
  const result = findProfileSection(entry, [page]);
  assert.equal(result.status, 'extracted_text_layer');
  assert.equal(result.locator, 'candidate_number_and_race');
  assert.equal(result.birthDate, '1965-05-30');
  assert.equal(result.gender, '男');
  assert.match(result.education, /國立大學/u);
  assert.doesNotMatch(result.education, /不應混入/u);
});

test('converts a complete ROC birth date and rejects partial dates', () => {
  assert.equal(parseRocBirthDate('54\n年\n5\n月\n30\n日'), '1965-05-30');
  assert.equal(parseRocBirthDate('54年5月'), null);
});

test('removes policy list markers accidentally interleaved with experience text', () => {
  assert.equal(cleanExperienceText('1.\n原轉會委員\n主任委員6.\n7.'), '原轉會委員\n主任委員');
});

test('extracts one candidate row without including the next candidate', () => {
  const words = [
    ...vertical('出生年月日', 140, 30),
    ...vertical('性別', 180, 30),
    ...vertical('出生地', 220, 30),
    ...vertical('推薦之政黨', 260, 30),
    word('學歷', 340, 40, 370, 52),
    word('經歷', 500, 40, 530, 52),
    word('政見', 680, 40, 710, 52),
    ...vertical('鄭光宏', 100, 100),
    word('54年', 135, 100, 165, 112),
    word('5月', 140, 114, 160, 126),
    word('30日', 135, 128, 165, 140),
    word('男', 180, 100, 190, 112),
    ...vertical('無', 260, 100),
    word('國立大學', 310, 100, 390, 112),
    word('公共行政系', 310, 116, 390, 128),
    word('現任議員', 470, 100, 540, 112),
    ...vertical('下一位', 100, 200),
    word('不應混入', 310, 200, 390, 212),
  ];
  const page = { page: 1, width: 800, height: 600, words };
  const entry = {
    person_name: '鄭光宏',
    raceCandidates: [{ personName: '鄭光宏' }, { personName: '下一位' }],
  };
  const result = findProfileSection(entry, [page]);
  assert.equal(result.status, 'extracted_text_layer');
  assert.equal(result.birthDate, '1965-05-30');
  assert.equal(result.gender, '男');
  assert.match(result.education, /國立大學/u);
  assert.doesNotMatch(result.education, /不應混入/u);
});

test('uses a unique Han name when the official bulletin separates the Latin name', () => {
  const words = [
    word('學歷', 340, 40, 370, 52),
    word('經歷', 500, 40, 530, 52),
    word('政見', 680, 40, 710, 52),
    word('蔡依靜', 100, 100, 150, 112),
    word('72', 190, 100, 210, 107), word('年', 190, 108, 210, 115),
    word('8', 190, 116, 210, 123), word('月', 190, 124, 210, 131),
    word('16', 190, 132, 210, 139), word('日', 190, 140, 210, 147),
    word('女', 240, 120, 250, 132), word('無', 280, 120, 290, 132),
    word('國立大學', 310, 100, 390, 112),
    word('現任議員', 470, 100, 540, 112),
  ];
  const page = { page: 1, width: 800, height: 600, words };
  const result = findProfileSection({ person_name: '蔡依靜 Lamen Panay', raceCandidates: [] }, [page]);
  assert.equal(result.status, 'extracted_text_layer');
  assert.match(result.education, /國立大學/u);
  assert.match(result.experience, /現任議員/u);
  assert.equal(result.birthDate, '1983-08-16');
  assert.equal(result.gender, '女');
  assert.equal(result.electionParty, '無');
  assert.doesNotMatch(result.education, /無/u);
  assert.equal(findProfileSection({ person_name: '蔡依靜‧顗賚', raceCandidates: [] }, [page]).birthDate, '1983-08-16');
});
