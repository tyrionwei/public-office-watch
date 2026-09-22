import { useI18n } from '../i18n';
import { legalRecordDisplay, type legalCaseClassification, type legalRecordPresentation } from '../lib/legalRecordPresentation';

type Props = {
  legal: ReturnType<typeof legalRecordPresentation>;
  classification: ReturnType<typeof legalCaseClassification> | null;
  documentStatus: string;
};

export function LegalRecordSummary({ legal, classification, documentStatus }: Props) {
  const { t } = useI18n();
  const display = legalRecordDisplay(legal, classification ?? { status: 'other', result: 'unknown' });
  return (
    <div data-legal-summary className="mt-3 space-y-3">
      <dl className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {display.showOffense ? <div>
          <dt className="text-xs text-slate-400">{t('person.legal.offense')}</dt>
          <dd className="mt-1 text-base font-semibold text-white">{legal.offenses.join('、')}</dd>
        </div> : null}
        <div>
          <dt className="text-xs text-slate-400">{t('person.legal.status')}</dt>
          <dd className="mt-1 text-sm font-semibold text-accent">{documentStatus}</dd>
        </div>
        {legal.action ? <div>
          <dt className="text-xs text-slate-400">{t('person.legal.currentAction')}</dt>
          <dd className="mt-1 text-sm text-white">{t(legal.action === 'revised' ? 'person.legal.revised' : 'person.legal.dismissed')}</dd>
        </div> : null}
        {display.showResult && classification ? <div className="sm:col-span-2">
          <dt className="text-xs text-slate-400">{t('person.legal.result')}</dt>
          <dd className="mt-1 text-sm font-semibold text-white">{t(`person.legal.result.${classification.result}`)}</dd>
        </div> : null}
        {display.showSentence ? <div className="sm:col-span-2">
          <dt className="text-xs text-slate-400">{t('person.legal.sentence')}</dt>
          <dd className="mt-1 text-sm leading-6 text-white"><ul className="space-y-1">
            {legal.penalties.map(penalty => <li key={penalty}>{penalty}</li>)}
          </ul></dd>
        </div> : null}
      </dl>
      {display.notice ? <p data-legal-summary-notice className="text-xs leading-6 text-slate-400">
        {t(display.notice === 'legacy' ? 'person.legal.mainPending' : 'person.legal.linkPending')}
      </p> : null}
      {legal.basis ? <div data-legal-prior-basis className="space-y-2 border-l-2 border-line pl-3 text-xs leading-6 text-slate-300">
        <p>{t('person.legal.upheldBasis')}</p>
        <a href={legal.basis.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:text-white">
          {legal.basis.caseNumber} · {legal.basis.judgmentDate} ↗
        </a>
        <p className="whitespace-pre-line">{legal.basis.text}</p>
      </div> : null}
      {legal.notes.length ? <p className="text-sm leading-6 text-slate-300">{legal.notes.join('；')}</p> : null}
      {display.showDate ? <p className="text-xs text-slate-400">{t('person.legal.judgmentDate')}：{legal.judgmentDate}</p> : null}
      {legal.showNarrative ? <p className="whitespace-pre-line text-sm leading-6 text-slate-200">{legal.narrative || t('person.noContent')}</p> : null}
      {legal.basis ? <p className="text-xs leading-6 text-slate-400">{t('person.legal.recordScope')}</p> : null}
    </div>
  );
}
