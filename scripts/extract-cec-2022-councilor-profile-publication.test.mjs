import assert from 'node:assert/strict';
import test from 'node:test';
import { assessPublication } from './extract-cec-2022-councilor-profile-review.mjs';

const cleanExtraction = {
  education: '國立臺灣大學政治學系',
  experience: '第十九屆縣議員',
};

test('passes a clean candidate profile', () => {
  const result = assessPublication({ race_title: '嘉義市第1選舉區議員選舉', raceCandidates: [] }, cleanExtraction);
  assert.deepEqual(result, { status: 'passed', reasons: [] });
});

test('keeps Taipei special layouts private', () => {
  const result = assessPublication({ race_title: '臺北市第3選舉區議員選舉', raceCandidates: [] }, cleanExtraction);
  assert.equal(result.status, 'private_review_required');
  assert.ok(result.reasons.includes('taipei_special_layout'));
});

test('keeps cross-column and peer-candidate text private', () => {
  const result = assessPublication({
    candidate_id: 'candidate-a',
    race_title: '苗栗縣第5選舉區議員選舉',
    raceCandidates: [
      { candidateId: 'candidate-a', personName: '甲候選人' },
      { candidateId: 'candidate-b', personName: '乙候選人' },
    ],
  }, {
    education: '國立大學社\n無會學系',
    experience: '乙候選人服務處主任',
  });
  assert.equal(result.status, 'private_review_required');
  assert.ok(result.reasons.includes('education_may_include_party_column'));
  assert.ok(result.reasons.some((reason) => reason.startsWith('profile_contains_peer_name:')));
});
