import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { buildCecPollingPlaceLookupUrl } from '../lib/cecPollingPlaceLookup';
import { dedupePollingPlaces, matchPollingPlaces, pollingPlaceMapUrl, validNeighborhood } from '../lib/pollingPlace';
import { publicDataProvider } from '../lib/publicData';
import type { PollingPlace } from '../types/pollingPlace';
import { useVotingRegion } from '../votingRegion';

export function MyPollingPlace({ eventKey, lookupUrl, onClose }: { eventKey: string; lookupUrl: string; onClose: () => void }) {
  const { language } = useI18n();
  const english = language === 'en';
  const { preference, confirmPreference } = useVotingRegion();
  const villageCode = preference?.village?.id.replace(/^village-/, '') ?? '';
  const key = eventKey + ':' + villageCode;
  const [state, setState] = useState<{ key: string; places: PollingPlace[]; error: boolean } | null>(null);
  useEffect(() => {
    if (!villageCode) return;
    let active = true;
    publicDataProvider.loadPollingPlaces(eventKey, villageCode)
      .then((places) => { if (active) setState({ key, places, error: false }); })
      .catch(() => { if (active) setState({ key, places: [], error: true }); });
    return () => { active = false; };
  }, [eventKey, villageCode, key]);
  if (!preference) return null;
  const current = state?.key === key ? state : null;
  const places = dedupePollingPlaces(current?.places ?? []);
  const matching = matchPollingPlaces(places, preference.neighborhood);
  const source = current?.places[0];
  return (
    <section data-my-polling-place className="pixel-corners border border-line/80 bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-white">{english ? 'Polling place for your saved area' : '戶籍地區的投開票所'}</h3>
          <p className="mt-1 text-xs text-slate-400">{[preference.county.name, preference.district?.name, preference.village?.name].filter(Boolean).join(' ')}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={english ? 'Close polling places' : '關閉投開票所'} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center border border-line text-lg text-slate-300 hover:border-accent/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/35">×</button>
      </div>
      {villageCode ? <>
        <label className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <span>{english ? 'Neighborhood (optional)' : '鄰別（選填）'}</span>
          <input data-polling-neighborhood type="number" inputMode="numeric" min="1" max="999"
            value={preference.neighborhood ?? ''}
            onChange={(event) => confirmPreference({ ...preference, neighborhood: validNeighborhood(Number(event.target.value)) })}
            className="min-h-11 w-24 border border-line bg-bg px-3 text-white" />
          <span className="text-[11px] text-slate-500">{english ? 'Saved only on this device' : '僅儲存在此裝置'}</span>
        </label>
        {!current ? <p role="status" className="mt-3 text-sm text-slate-400">{english ? 'Loading official data…' : '載入官方資料中…'}</p>
          : current.error ? <p role="status" className="mt-3 text-sm text-amber-200">{english ? 'Could not load polling places. Use the official lookup below.' : '投開票所資料暫時無法載入，請使用下方官方查詢。'}</p>
          : places.length === 0 ? <p className="mt-3 text-sm text-slate-400">{english ? 'We have not yet added official station data for this village and election.' : '本站尚未收錄此村里本次投票的官方投開票所資料。'}</p>
          : <>
            <p data-polling-match-status className="mt-3 text-sm text-signal">{matching.exact
              ? (english ? 'One station matches the official village assignment' : '依官方村里公告對應到 1 個投開票所')
              : preference.neighborhood ? (english ? 'The official data cannot identify one station from neighborhood alone. Possible stations:' : '依目前官方資料無法僅靠鄰別唯一判定，可能場所如下：')
                : (english ? 'Add your neighborhood to narrow these stations:' : '填入鄰別可進一步縮小範圍，目前可能場所：')}</p>
            <ul className="mt-3 grid max-h-[28rem] gap-3 overflow-y-auto">
              {matching.places.map((place) => <li key={place.id} className="border border-line/70 bg-bg/45 p-3">
                <p className="text-[11px] text-accent">{english ? 'Station ' : '第 '}{place.station_no}{english ? '' : ' 投開票所'}</p>
                <h4 className="mt-1 text-sm font-semibold text-white">{place.station_name}</h4>
                <p className="mt-1 text-xs leading-5 text-slate-300">{place.address}</p>
                <p className="mt-1 whitespace-pre-line text-xs leading-5 text-slate-400">{place.village_name} · {place.raw_neighborhoods}</p>
                <a href={pollingPlaceMapUrl(place)} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center text-xs text-accent underline underline-offset-4">{english ? 'Open in Google Maps' : '在 Google Maps 開啟'} ↗</a>
              </li>)}
            </ul>
            {source ? <p className="mt-3 text-[11px] text-slate-400"><a href={source.source_url} target="_blank" rel="noreferrer" className="underline underline-offset-4">{source.source_name} ↗</a>{source.source_published_on ? ' · ' + source.source_published_on : ''}</p> : null}
          </>}
      </> : <p className="mt-3 text-sm text-slate-400">{english ? 'Add a village in your voting-area settings to find nearby assignments.' : '請先在投票地區設定村里，再查詢對應場所。'}</p>}
      <a href={buildCecPollingPlaceLookupUrl(lookupUrl, preference)} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center text-xs text-accent underline underline-offset-4">{english ? 'CEC official lookup' : '中選會官方查詢'} ↗</a>
      <p className="mt-2 text-[11px] leading-5 text-slate-500">{english ? 'Confirm with your voting notice. For indigenous elections, check the voter category in the official lookup.' : '實際投票所請以投票通知單為準；原住民選舉請至中選會依投票類別確認。'}</p>
    </section>
  );
}
