import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useMyBallot } from '../lib/useMyBallot';
import type { BallotItem, BallotOffice, BallotSetting } from '../types/ballot';
import { useVotingRegion, type VotingRegionPreference } from '../votingRegion';

const officeLabels: Record<BallotOffice, { 'zh-TW': string; en: string }> = {
  mayor: { 'zh-TW': '縣市長', en: 'County or city mayor' },
  councilor: { 'zh-TW': '縣市議員', en: 'Councilor' },
  townshipMayor: { 'zh-TW': '鄉鎮市長', en: 'Township mayor' },
  townshipRepresentative: { 'zh-TW': '鄉鎮市民代表', en: 'Township representative' },
  indigenousDistrictMayor: { 'zh-TW': '山地原住民區長', en: 'Indigenous district mayor' },
  indigenousDistrictRepresentative: { 'zh-TW': '山地原住民區民代表', en: 'Indigenous district representative' },
  villageChief: { 'zh-TW': '村里長', en: 'Village chief' },
};

const settingLabels: Record<BallotSetting, { 'zh-TW': string; en: string }> = {
  county: { 'zh-TW': '縣市', en: 'county/city' },
  district: { 'zh-TW': '鄉鎮市區', en: 'district/township' },
  village: { 'zh-TW': '村里', en: 'village' },
  neighborhood: { 'zh-TW': '鄰別', en: 'neighborhood' },
  category: { 'zh-TW': '選票查詢類別', en: 'ballot lookup category' },
};

export function MyBallots({ eventKey, preference, onOpenEditor, onNavigate, desktop = false }: {
  eventKey: string;
  preference: VotingRegionPreference;
  onOpenEditor?: () => void;
  onNavigate?: () => void;
  desktop?: boolean;
}) {
  const { language } = useI18n();
  const { setEditorOpen } = useVotingRegion();
  const openEditor = onOpenEditor ?? (() => setEditorOpen(true));
  const english = language === 'en';
  const { result, loading, error, retry } = useMyBallot(eventKey, preference);
  const label = result?.estimatedLocalBallots === undefined
    ? (english ? 'My ballots' : '我的選票')
    : (english ? `My ballots | Estimated ${result.estimatedLocalBallots} local-election ballot(s)` : `我的選票｜依設定預估 ${result.estimatedLocalBallots} 張地方選舉票`);
  const statusText = (item: BallotItem) => {
    if (item.status === 'confirmed') return english ? 'Confirmed' : '已確認';
    if (item.status === 'ambiguous') return english ? 'Assignment needs verification' : '分配有疑義';
    if (item.status === 'missing-data') return english ? 'Official mapping pending' : '資料待補';
    const missing = item.missing.map((setting) => settingLabels[setting][language]).join(english ? ', ' : '、');
    return english ? `Add ${missing}` : `需補設定：${missing}`;
  };

  return (
    <section id={desktop ? 'desktop-my-ballots' : 'my-ballots'} data-my-ballots className="pixel-corners border border-line/80 bg-panel p-4" aria-label={label}>
      <h2 className="font-display text-lg text-white">{label}</h2>
      {loading ? <p role="status" className="mt-3 text-sm text-slate-400">{english ? 'Loading ballot information…' : '正在載入選票資料…'}</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-amber-200">{english ? 'Could not load ballot information.' : '選票資料載入失敗。'} <button type="button" onClick={retry} className="underline underline-offset-4">{english ? 'Retry' : '重試'}</button></p> : null}
      {result && !result.supported ? <p className="mt-3 text-sm text-slate-400">{english ? 'Election mapping is pending.' : '這場選舉的選區對應資料待補。'}</p> : null}
      <div className="mt-3 grid gap-2">
        {result?.items.map((item) => {
          const content = <>
            <span className="font-display text-sm text-white">{officeLabels[item.office][language]}</span>
            <span className="mt-1 block text-xs text-slate-300">{item.constituencyName ?? (english ? 'District pending' : '正式選區待確認')}</span>
            <span className={`mt-2 block text-[11px] ${item.status === 'confirmed' ? 'text-signal' : 'text-amber-200'}`}>{statusText(item)}</span>
          </>;
          return item.href ? (
            <Link key={item.office} to={item.href} onClick={onNavigate} className="block min-h-20 border border-line/70 bg-bg/45 p-3 focus:outline-none focus:ring-2 focus:ring-accent/35">{content}<span className="sr-only">{english ? 'View district' : '查看選區'}</span></Link>
          ) : (
            <div key={item.office} className="min-h-20 border border-line/70 bg-bg/45 p-3">{content}
              {item.status === 'needs-setting' ? <button type="button" onClick={openEditor} className="mt-2 block min-h-9 text-xs text-accent underline underline-offset-4">{english ? 'Complete settings' : '補充設定'}</button> : null}
              {item.status === 'confirmed' ? <p className="mt-1 text-[11px] text-slate-400">{english ? 'District page pending' : '選區頁連結待補'}</p> : null}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-500">{english ? 'Actual ballots are determined by the electoral roll.' : '實際可領選票以選舉人名冊為準。'}</p>
    </section>
  );
}
