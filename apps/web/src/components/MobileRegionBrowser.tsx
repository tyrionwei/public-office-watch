import { useEffect, useRef, useState } from 'react';
import { taiwanRegions } from '../data/taiwanRegions';
import { useI18n } from '../i18n';

type MobileRegionBrowserProps = {
  selectedRegionId: string | null;
  selectedRegionLabel: string;
  browsing: boolean;
  onSelectRegion: (regionId: string | null) => void;
  onReturnToMyArea: () => void;
};

const regionGroups = [
  {
    key: 'north',
    labels: { 'zh-TW': '北部', en: 'North' },
    slugs: ['taipei-city', 'new-taipei-city', 'keelung-city', 'taoyuan-city', 'hsinchu-city', 'hsinchu-county'],
  },
  {
    key: 'central',
    labels: { 'zh-TW': '中部', en: 'Central' },
    slugs: ['miaoli-county', 'taichung-city', 'changhua-county', 'nantou-county', 'yunlin-county'],
  },
  {
    key: 'south',
    labels: { 'zh-TW': '南部', en: 'South' },
    slugs: ['chiayi-city', 'chiayi-county', 'tainan-city', 'kaohsiung-city', 'pingtung-county'],
  },
  {
    key: 'east-islands',
    labels: { 'zh-TW': '東部與離島', en: 'East and islands' },
    slugs: ['yilan-county', 'hualien-county', 'taitung-county', 'penghu-county', 'kinmen-county', 'lienchiang-county'],
  },
] as const;

export function MobileRegionBrowser({
  selectedRegionId,
  selectedRegionLabel,
  browsing,
  onSelectRegion,
  onReturnToMyArea,
}: MobileRegionBrowserProps) {
  const { language } = useI18n();
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isEnglish = language === 'en';

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const choose = (regionId: string | null) => {
    onSelectRegion(regionId);
    setOpen(false);
  };

  return (
    <>
      <section data-mobile-region-browser className="pixel-corners border border-line/80 bg-panel p-4 md:hidden">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-accent">
              {isEnglish ? 'EXPLORE' : '自由瀏覽'}
            </p>
            <h2 className="mt-1 font-display text-lg text-white">
              {browsing
                ? (isEnglish ? 'Browsing ' + selectedRegionLabel : '正在瀏覽 ' + selectedRegionLabel)
                : (isEnglish ? 'Browse other areas' : '瀏覽其他地區')}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {isEnglish
                ? 'Browsing never changes your saved voting area.'
                : '瀏覽其他縣市不會變更已儲存的戶籍投票地區。'}
            </p>
          </div>
          {browsing ? (
            <button type="button" onClick={onReturnToMyArea} className="min-h-11 shrink-0 text-xs text-accent underline underline-offset-4">
              {isEnglish ? 'My area' : '回到我的地區'}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 flex min-h-12 w-full items-center justify-between border border-accent/65 bg-accent/8 px-4 text-left font-display text-sm text-accent focus:outline-none focus:ring-2 focus:ring-accent/35"
        >
          <span>{isEnglish ? 'Browse area' : '瀏覽地區'}：{browsing ? selectedRegionLabel : (isEnglish ? 'Choose' : '選擇')}</span>
          <span aria-hidden="true">⌄</span>
        </button>
      </section>

      {open ? (
        <div className="fixed inset-0 z-[90] md:hidden">
          <button type="button" aria-label={isEnglish ? 'Close' : '關閉'} onClick={() => setOpen(false)} className="absolute inset-0 bg-black/75" />
          <section role="dialog" aria-modal="true" aria-labelledby="mobile-region-browser-title" className="pixel-corners absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto border-2 border-accent/60 bg-panel px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_40px_rgba(0,0,0,0.55)]">
            <header className="flex items-start justify-between gap-3 border-b border-line/70 pb-3">
              <div>
                <h2 id="mobile-region-browser-title" className="font-display text-lg text-white">{isEnglish ? 'Browse area' : '瀏覽地區'}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">{isEnglish ? 'Choose nationwide or a county / city.' : '選擇全國總覽或任一現行縣市。'}</p>
              </div>
              <button ref={closeButtonRef} type="button" onClick={() => setOpen(false)} aria-label={isEnglish ? 'Close' : '關閉'} className="grid h-11 w-11 shrink-0 place-items-center border border-line text-xl text-slate-300 focus:outline-none focus:ring-2 focus:ring-accent/40">×</button>
            </header>

            <button
              type="button"
              aria-pressed={selectedRegionId === null}
              onClick={() => choose(null)}
              className="mt-4 min-h-12 w-full border border-signal/65 bg-signal/8 px-3 text-left font-display text-sm text-signal"
            >
              {isEnglish ? 'Nationwide overview' : '全國總覽'}
            </button>

            <div className="mt-4 grid gap-4">
              {regionGroups.map((group) => (
                <section key={group.key}>
                  <h3 className="text-xs font-semibold text-slate-400">{group.labels[language]}</h3>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {group.slugs.map((slug) => {
                      const region = taiwanRegions.find((item) => item.slug === slug);
                      if (!region) return null;
                      const selected = selectedRegionId === region.slug;
                      return (
                        <button
                          type="button"
                          key={region.slug}
                          aria-pressed={selected}
                          onClick={() => choose(region.slug)}
                          className={'min-h-11 border px-3 text-left text-sm ' + (selected ? 'border-accent bg-accent/12 text-accent' : 'border-line bg-bg/45 text-slate-200')}
                        >
                          {region.name}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
