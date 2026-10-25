import { useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { candidateSpriteCredits } from '../data/candidateSpriteCredits';
import sourceManifestUrl from '../data/candidateSpriteSources.json?url';
import { useI18n } from '../i18n';
import { SectionPanel } from './SectionPanel';

export function CandidateSpriteCreditsSection() {
  const location = useLocation();
  return <SpriteCredits key={location.key + location.search} />;
}

function SpriteCredits() {
  const { t, language } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const [params] = useSearchParams();
  const selected = params.get('imageCredit')?.toLowerCase();
  const selectedCredit = candidateSpriteCredits.find((credit) => credit.canonicalId === selected);
  const records = expanded ? candidateSpriteCredits : selectedCredit ? [selectedCredit] : [];
  const collapse = () => {
    setExpanded(false);
    toggle.current?.focus();
  };
  return (
    <section data-sprite-credits>
      <SectionPanel title={t('spriteCredit.title')} eyebrow={t('spriteCredit.eyebrow')}>
        <p className="text-sm leading-6 text-slate-300">{t('spriteCredit.scope')}</p>
        {selected && !selectedCredit ? <p role="status" className="mt-3 text-sm text-slate-300">{t('spriteCredit.notFound')}</p> : null}
        <button ref={toggle} type="button" aria-expanded={expanded} aria-controls="sprite-credit-list"
          onClick={() => setExpanded(!expanded)} className="mt-4 text-sm text-accent underline">
          {t(expanded ? 'spriteCredit.collapse' : 'spriteCredit.viewAll')}
        </button>
        <div id="sprite-credit-list" className="mt-4 space-y-3">
          {records.map((credit) => (
            <article key={credit.canonicalId} data-sprite-credit={credit.canonicalId}
              className={`pixel-corners border p-4 text-sm leading-6 [overflow-wrap:anywhere] ${credit.canonicalId === selected ? 'border-accent bg-accent/5' : 'border-line/70 bg-bg/35'}`}>
              <h3 className="font-display text-base text-white">{credit.person}</h3>
              <p data-credit-attribution className="mt-2 text-slate-300">{credit.attribution}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                <a data-credit-source href={credit.sourceUrl} target="_blank" rel="noreferrer" className="text-accent underline">{t('spriteCredit.source')}</a>
                <a data-credit-license href={credit.licenseUrl} target="_blank" rel="noreferrer" className="text-accent underline">{credit.licenseName}</a>
              </div>
              {credit.sourceDate ? <p className="mt-2 text-xs text-slate-400">{t('spriteCredit.sourceDate')}: {credit.sourceDate}</p> : null}
              <p data-credit-modifications className="mt-2 text-slate-300">{language === 'en' ? credit.modificationsEn : credit.modifications}</p>
              {credit.adaptationLicense ? <p data-credit-adaptation className="mt-2 text-slate-300">{t('spriteCredit.adaptation')}: {credit.adaptationLicense}</p> : null}
            </article>
          ))}
        </div>
        {expanded ? <button type="button" onClick={collapse} className="mt-4 block text-sm text-accent underline">{t('spriteCredit.collapseReturn')}</button> : null}
        <a data-credit-manifest href={sourceManifestUrl} download="candidate-sprite-sources.json" className="mt-4 inline-block text-xs text-accent underline">{t('spriteCredit.download')}</a>
      </SectionPanel>
    </section>
  );
}
