import assert from 'node:assert/strict';
import test from 'node:test';
import { platformClaimsForCandidate, platformItemsForClaim } from '../src/lib/candidatePlatform.ts';
import type { PublicPersonClaim } from '../src/types/publicViews.ts';

function platformClaim(claimId: string, electionContext?: Record<string, string>, candidateId?: string): PublicPersonClaim {
  return {
    claim_id: claimId,
    candidate_id: candidateId,
    person_id: 'person-1',
    claim_type: 'platform',
    claim_value: claimId,
    claim_json: electionContext ? { electionContext } : {},
    confidence_level: 'A',
    review_score: 100,
    source_name: 'test',
    source_url: null,
    observed_at: null,
    updated_at: '2026-08-11T00:00:00Z',
  };
}

test('returns only platform claims linked to the current candidacy or race', () => {
  const claims = [
    platformClaim('candidate-match', { candidateId: 'candidate-1', raceId: 'race-1' }),
    platformClaim('same-race-other-candidate', { candidateId: 'candidate-2', raceId: 'race-1' }),
    platformClaim('race-only-match', { raceId: 'race-1' }),
    platformClaim('other-election', { candidateId: 'candidate-3', raceId: 'race-2' }),
    platformClaim('legacy-unscoped'),
    platformClaim('direct-candidate-match', undefined, 'candidate-1'),
  ];

  assert.deepEqual(
    platformClaimsForCandidate(claims, 'candidate-1', 'race-1').map((claim) => claim.claim_id),
    ['candidate-match', 'race-only-match', 'direct-candidate-match'],
  );
});

test('does not guess the election for legacy unscoped platform claims', () => {
  assert.deepEqual(
    platformClaimsForCandidate([platformClaim('legacy-unscoped')], 'candidate-1', 'race-1'),
    [],
  );
});


  const intentionallyEmpty = platformClaim('intentionally-empty');
  intentionallyEmpty.claim_json.items = [];
  assert.deepEqual(platformItemsForClaim(intentionallyEmpty), []);
test('uses stored platform items and safely splits explicit numbered originals', () => {
  const stored = platformClaim('stored');
  stored.claim_json.items = ['第一項', '第二項'];
  assert.deepEqual(platformItemsForClaim(stored), ['第一項', '第二項']);

  const numbered = platformClaim('numbered');
  numbered.claim_value = '一、增設公共托育據點。二、推動地下停車場。三、改善市場周邊交通。';
  assert.deepEqual(platformItemsForClaim(numbered), [
    '增設公共托育據點。',
    '推動地下停車場。',
    '改善市場周邊交通。',
  ]);
});

test('uses source newlines as platform item boundaries', () => {
  const claim = platformClaim('newline-list');
  claim.claim_value = '監督縣政建設\n爭取鄉親福利';
  assert.deepEqual(platformItemsForClaim(claim), ['監督縣政建設', '爭取鄉親福利']);
});

test('drops a past-achievement intro and joins region headings to their platform sections', () => {
  const claim = platformClaim('sectioned');
  claim.claim_value = [
    '兩屆八年任期，獲評11次優秀立委；114個法律提案共30案獲三讀。',
    '',
    '樹林',
    '',
    '爭取捷運動工與道路改善，未來串聯鐵路沿線產業與自然景觀。',
    '',
    '鶯歌',
    '',
    '爭取車站改善與地方創生，未來建立藝術學院並培育一流職人。',
    '',
    '新莊',
    '',
    '汰換自來水管並推動電桿地下化，未來促使產業再創生並接軌國際。',
  ].join('\n');

  assert.deepEqual(platformItemsForClaim(claim), [
    '樹林：爭取捷運動工與道路改善，未來串聯鐵路沿線產業與自然景觀。',
    '鶯歌：爭取車站改善與地方創生，未來建立藝術學院並培育一流職人。',
    '新莊：汰換自來水管並推動電桿地下化，未來促使產業再創生並接軌國際。',
  ]);
});

test('joins topic headings to policies and excludes explicit past-achievement sections', () => {
  const claim = platformClaim('topic-sections');
  claim.claim_value = [
    '【政績】',
    '已完成公園整建。',
    '【政見】',
    '【交通建設】',
    '改善主要道路壅塞。',
    '增設公共運輸路線。',
    '能源政策',
    '建立穩定低碳供電。',
  ].join('\n');

  assert.deepEqual(platformItemsForClaim(claim), [
    '交通建設：改善主要道路壅塞。',
    '交通建設：增設公共運輸路線。',
    '能源政策：建立穩定低碳供電。',
  ]);
});
