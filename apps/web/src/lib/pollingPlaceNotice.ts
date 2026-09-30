import { taiwanRegions } from '../data/taiwanRegions.ts';

const missingAddressNoticeByCounty: Readonly<Record<string, string>> = {
  '10009': 'https://web.cec.gov.tw/ylec/article/64366',
  '10016': 'https://web.cec.gov.tw/phec/article/63671',
};

/** Saved settings use slugs; older callers may still use county IDs or codes. */
export function pollingPlaceMissingAddressNoticeUrl(eventKey: string, countyId: string): string | null {
  if (eventKey !== '2026-local-general-election-day') return null;
  const county = taiwanRegions.find(({ id, slug, code }) => (
    countyId === id || countyId === slug || countyId === code
  ));
  return county ? missingAddressNoticeByCounty[county.code] ?? null : null;
}
