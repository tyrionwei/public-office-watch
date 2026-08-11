import assert from 'node:assert/strict';
import test from 'node:test';
import { getPartyChangeAffiliations, getPreviousPartyName } from '../src/lib/personData.ts';
import type { PublicPersonPartyAffiliation } from '../src/types/publicViews.ts';

function affiliation(
  affiliationId: string,
  partyName: string,
  options: Partial<PublicPersonPartyAffiliation> = {},
): PublicPersonPartyAffiliation {
  return {
    affiliation_id: affiliationId,
    affiliation_key: affiliationId,
    person_id: 'person-1',
    person_name: '測試人物',
    source_claim_key: null,
    party_name: partyName,
    role_context: 'candidate',
    role_title: null,
    organization_unit: null,
    display_order: null,
    role_tier: 'primary',
    observed_year: 2022,
    observed_date: null,
    start_date: null,
    end_date: null,
    is_current: false,
    confidence_level: 'A',
    source_name: '測試來源',
    source_url: null,
    updated_at: '2026-08-11T00:00:00Z',
    ...options,
  };
}

test('hides repeated candidacies under the same canonical party', () => {
  assert.deepEqual(getPartyChangeAffiliations([
    affiliation('independent-2022', '無黨籍'),
    affiliation('independent-2018', '無黨'),
  ], '無黨籍'), []);
});

test('keeps one representative for every distinct party state', () => {
  const result = getPartyChangeAffiliations([
    affiliation('dpp-current', '民主進步黨', { is_current: true }),
    affiliation('dpp-2022', '民主進步黨'),
    affiliation('independent-2018', '無黨籍'),
  ], '民主進步黨');

  assert.deepEqual(result.map((item) => item.affiliation_id), [
    'dpp-current',
    'independent-2018',
  ]);
});

test('shows a historical affiliation when the current party proves a change', () => {
  const result = getPartyChangeAffiliations([
    affiliation('kmt-history', '中國國民黨'),
    affiliation('party-office', '中國國民黨', { role_context: 'party_officer', is_current: true }),
  ], '台灣民眾黨');

  assert.deepEqual(result.map((item) => item.affiliation_id), ['kmt-history']);
});

test('shows the latest earlier different party for a candidacy', () => {
  const result = getPreviousPartyName([
    affiliation('independent-2026', '無黨籍', { observed_year: 2026 }),
    affiliation('kmt-2022', '中國國民黨', { observed_year: 2022 }),
    affiliation('kmt-2018', '中國國民黨', { observed_year: 2018 }),
    affiliation('pfp-2014', '親民黨', { observed_year: 2014 }),
  ], '無黨', 2026);

  assert.equal(result, '中國國民黨');
});

test('does not show a later affiliation on a historical election page', () => {
  const result = getPreviousPartyName([
    affiliation('tpp-2026', '台灣民眾黨', { observed_year: 2026 }),
    affiliation('independent-2022', '無黨籍', { observed_year: 2022 }),
  ], '無黨籍', 2022);

  assert.equal(result, null);
});

test('does not show repeated aliases of the same party as a previous party', () => {
  const result = getPreviousPartyName([
    affiliation('independent-2022', '無黨', { observed_year: 2022 }),
    affiliation('independent-2018', '無黨籍', { observed_year: 2018 }),
  ], '無黨籍', 2026);

  assert.equal(result, null);
});
