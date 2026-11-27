import type { PollingPlace } from '../types/pollingPlace';

// These are supplemental citations for the reviewed canonical venue rows, not data overrides.
const notices = [
  {
    "village": "65000100033",
    "station": "0146",
    "name": "亞東科技大學淡水校區",
    "address": "新北市淡水區濱海路三段25號",
    "url": "https://web.cec.gov.tw/api/file/aa005d85-4b77-47d2-a858-e9a12c52a48b.pdf#page=2"
  },
  {
    "village": "10013290006",
    "station": "0705",
    "name": "萬安耶穌聖心堂",
    "address": "屏東縣萬巒鄉成志路51之3號",
    "url": "https://web.cec.gov.tw/api/file/ca55e649-b85e-49ad-a5a8-5fa470ced522.pdf#page=57"
  }
];

const normalized = (value: string) => value.normalize('NFKC').replace(/\s+/g, '');

export function pollingPlaceVenueNotice(eventKey: string, place: PollingPlace): string | undefined {
  if (eventKey !== '2026-local-general-election-day' || place.voting_date !== '2026-11-28') return undefined;
  return notices.find((notice) => notice.village === place.village_code
    && notice.station === place.station_no
    && normalized(notice.name) === normalized(place.station_name)
    && normalized(notice.address) === normalized(place.address))?.url;
}
