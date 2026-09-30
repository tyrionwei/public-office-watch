import assert from 'node:assert/strict';
import test from 'node:test';
import { pollingPlaceMissingAddressNoticeUrl } from '../src/lib/pollingPlaceNotice.ts';

const eventKey = '2026-local-general-election-day';

for (const county of [
  { slug: 'yunlin-county', code: '10009', url: 'https://web.cec.gov.tw/ylec/article/64366' },
  { slug: 'penghu-county', code: '10016', url: 'https://web.cec.gov.tw/phec/article/63671' },
]) {
  for (const countyId of [county.slug, `county-${county.code}`, county.code]) {
    test(`missing-address notice resolves ${countyId} to its own announcement`, () => {
      assert.equal(pollingPlaceMissingAddressNoticeUrl(eventKey, countyId), county.url);
    });
  }
}

for (const countyId of ['tainan-city', 'county-10004', '', 'unknown-county']) {
  test(`missing-address notice does not default ${countyId || '(empty)'} to Penghu`, () => {
    assert.equal(pollingPlaceMissingAddressNoticeUrl(eventKey, countyId), null);
  });
}

test('missing-address notices do not apply to a different election event', () => {
  assert.equal(pollingPlaceMissingAddressNoticeUrl('2022-local-general-election-day', 'yunlin-county'), null);
});
