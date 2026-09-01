import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCandidateComparisonShareUrl,
  buildLineShareUrl,
  buildPolicyShareUrl,
  policyShareAnchorId,
} from '../src/lib/socialSharing.ts';

test('builds a policy share URL that targets one exact platform item', () => {
  const url = new URL(buildPolicyShareUrl(
    'https://pow4vote.org',
    'person-1',
    'claim-1',
    'item-1',
  ));

  assert.equal(url.pathname, '/people/person-1');
  assert.equal(url.searchParams.get('policy'), 'claim-1:item-1');
  assert.equal(url.hash, `#${policyShareAnchorId('claim-1', 'item-1')}`);
});

test('builds an official LINE share URL with editable text and the exact link', () => {
  const url = new URL(buildLineShareUrl(
    '候選人比較\n第二行',
    'https://pow4vote.org/elections/races/race-1?compare=person-1%2Cperson-2#candidate-comparison',
  ));

  assert.equal(url.origin, 'https://social-plugins.line.me');
  assert.equal(url.pathname, '/lineit/share');
  assert.equal(url.searchParams.get('text'), '候選人比較\n第二行');
  assert.equal(url.searchParams.get('url'), 'https://pow4vote.org/elections/races/race-1?compare=person-1%2Cperson-2#candidate-comparison');
});

test('builds a comparison share URL with unique candidates and a four-person limit', () => {
  const url = new URL(buildCandidateComparisonShareUrl(
    'https://pow4vote.org',
    'race-1',
    ['person-1', 'person-2', 'person-1', 'person-3', 'person-4', 'person-5'],
  ));

  assert.equal(url.pathname, '/elections/races/race-1');
  assert.equal(url.searchParams.get('compare'), 'person-1,person-2,person-3,person-4');
  assert.equal(url.hash, '#candidate-comparison');
});

test('rejects missing identifiers instead of producing a misleading share URL', () => {
  assert.throws(() => buildPolicyShareUrl('https://pow4vote.org', '', 'claim-1', 'item-1'));
  assert.throws(() => buildCandidateComparisonShareUrl('https://pow4vote.org', 'race-1', ['person-1']));
});
