import { useSearchParams } from 'react-router-dom';
import { candidateSpriteCredits } from '../data/candidateSpriteCredits';
import sourceManifestUrl from '../data/candidateSpriteSources.json?url';
import { useI18n } from '../i18n';
import { SectionPanel } from './SectionPanel';

export function CandidateSpriteCreditsSection() {
  const { t, language } = useI18n();
  const [params] = useSearchParams();
  const selected = params.get('imageCredit')?.toLowerCase();
  const records = [...candidateSpriteCredits].sort((a, b) =>
    Number(b.canonicalId === selected) - Number(a.canonicalId === selected));
  return (
    <section data-sprite-credits>
      <SectionPanel title={t('spriteCredit.title')} eyebrow={t('spriteCredit.eyebrow')}>
        <p className="text-sm leading-6 text-slate-300">{t('spriteCredit.scope')}</p>
        <div className="mt-4 space-y-3">
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
        <a data-credit-manifest href={sourceManifestUrl} download="candidate-sprite-sources.json" className="mt-4 inline-block text-xs text-accent underline">{t('spriteCredit.download')}</a>
      </SectionPanel>
    </section>
  );
}
