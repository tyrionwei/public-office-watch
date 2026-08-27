import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { useI18n } from '../i18n';

const presetAmounts = [100, 300, 500, 1_000] as const;
const supportEmail = 'support@pow4vote.org';

export function SupportPage() {
  const { language, t } = useI18n();
  const [selectedAmount, setSelectedAmount] = useState<number | 'custom'>(300);
  const [customAmount, setCustomAmount] = useState('');
  const amount = selectedAmount === 'custom' ? Number(customAmount) : selectedAmount;
  const amountLabel = Number.isFinite(amount) && amount > 0
    ? `NT$${new Intl.NumberFormat(language === 'en' ? 'en-US' : 'zh-TW').format(amount)}`
    : t('support.customAmount');

  return (
    <AppShell>
      <div className="space-y-3">
        <PixelFrame title={t('support.frameTitle')}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] lg:items-end">
            <div className="max-w-4xl">
              <p className="text-xs uppercase tracking-[0.22em] text-signal">{t('support.eyebrow')}</p>
              <h2 className="mt-2 font-display text-3xl text-white sm:text-4xl">{t('support.heading')}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{t('support.description')}</p>
            </div>
            <div className="pixel-corners border border-signal/45 bg-signal/8 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-signal">{t('support.paymentProvider')}</p>
              <p className="mt-2 font-display text-lg text-white">{t('support.providerName')}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">{t('support.providerStatusDetail')}</p>
            </div>
          </div>
        </PixelFrame>

        <SectionPanel title={t('support.amountTitle')} eyebrow={t('support.amountEyebrow')}>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
            <div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" data-support-amounts>
                {presetAmounts.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedAmount(value)}
                    aria-pressed={selectedAmount === value}
                    className={[
                      'pixel-corners min-h-14 border px-3 py-3 font-display text-sm transition focus:outline-none focus:ring-2 focus:ring-accent/35',
                      selectedAmount === value
                        ? 'border-signal bg-signal/12 text-white'
                        : 'border-line/70 bg-bg/35 text-slate-300 hover:border-signal/55 hover:text-white',
                    ].join(' ')}
                  >
                    NT${new Intl.NumberFormat(language === 'en' ? 'en-US' : 'zh-TW').format(value)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedAmount('custom')}
                  aria-pressed={selectedAmount === 'custom'}
                  className={[
                    'pixel-corners min-h-14 border px-3 py-3 font-display text-sm transition focus:outline-none focus:ring-2 focus:ring-accent/35',
                    selectedAmount === 'custom'
                      ? 'border-signal bg-signal/12 text-white'
                      : 'border-line/70 bg-bg/35 text-slate-300 hover:border-signal/55 hover:text-white',
                  ].join(' ')}
                >
                  {t('support.customAmount')}
                </button>
              </div>

              {selectedAmount === 'custom' ? (
                <label className="mt-3 block max-w-sm text-sm text-slate-300">
                  <span className="mb-2 block">{t('support.customAmountLabel')}</span>
                  <span className="flex items-center border border-line/80 bg-bg/45 focus-within:border-accent">
                    <span className="px-3 font-display text-sm text-slate-400">NT$</span>
                    <input
                      type="number"
                      min="50"
                      step="1"
                      inputMode="numeric"
                      value={customAmount}
                      onChange={(event) => setCustomAmount(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent px-3 py-3 text-white outline-none"
                      placeholder="300"
                    />
                  </span>
                </label>
              ) : null}

              <p className="mt-4 text-sm leading-6 text-slate-400">{t('support.amountNote')}</p>
            </div>

            <div className="pixel-corners border border-accent/35 bg-accent/8 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-accent">{t('support.selectedAmount')}</p>
              <p className="mt-2 font-display text-3xl text-white" data-selected-support-amount>{amountLabel}</p>
              <button
                type="button"
                disabled
                className="pixel-corners mt-4 w-full cursor-not-allowed border border-line/70 bg-bg/55 px-4 py-3 font-display text-sm text-slate-400"
              >
                {t('support.paymentPending')}
              </button>
              <p className="mt-3 text-xs leading-5 text-slate-400">{t('support.paymentPendingDetail')}</p>
              <p className="mt-3 border-t border-line/60 pt-3 text-xs leading-5 text-slate-300">
                {t('support.paymentMethods')}
              </p>
            </div>
          </div>
        </SectionPanel>

        <SectionPanel title={t('support.serviceTitle')} eyebrow={t('support.serviceEyebrow')}>
          <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {([
              ['support.serviceNameLabel', 'support.serviceNameValue'],
              ['support.serviceTypeLabel', 'support.serviceTypeValue'],
              ['support.servicePriceLabel', 'support.servicePriceValue'],
              ['support.serviceRightsLabel', 'support.serviceRightsValue'],
            ] as const).map(([labelKey, valueKey]) => (
              <div key={labelKey} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                <dt className="text-xs uppercase tracking-[0.14em] text-slate-500">{t(labelKey)}</dt>
                <dd className="mt-2 text-sm leading-6 text-slate-200">{t(valueKey)}</dd>
              </div>
            ))}
          </dl>
        </SectionPanel>

        <div className="grid gap-3 xl:grid-cols-2">
          <SectionPanel title={t('support.usesTitle')} eyebrow={t('support.usesEyebrow')}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {([
                'support.useHosting',
                'support.useDatabase',
                'support.useData',
                'support.useDevelopment',
                'support.useSources',
                'support.useAdministration',
              ] as const).map((key) => (
                <li key={key} className="flex gap-3 border-t border-line/60 pt-3 text-sm leading-6 text-slate-300">
                  <span className="mt-2 h-2 w-2 shrink-0 bg-signal" aria-hidden="true" />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </SectionPanel>

          <SectionPanel title={t('support.independenceTitle')} eyebrow={t('support.independenceEyebrow')}>
            <div className="space-y-3 text-sm leading-7 text-slate-300">
              <p>{t('support.independenceDescription')}</p>
              <p>{t('support.noInfluence')}</p>
              <p>{t('support.noTaxDeduction')}</p>
            </div>
          </SectionPanel>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <SectionPanel title={t('support.refundTitle')} eyebrow={t('support.refundEyebrow')}>
            <div className="space-y-3 text-sm leading-7 text-slate-300">
              <p>{t('support.cancelPolicy')}</p>
              <p>{t('support.refundPolicy')}</p>
              <p>{t('support.refundTiming')}</p>
            </div>
          </SectionPanel>

          <SectionPanel title={t('support.contactTitle')} eyebrow={t('support.contactEyebrow')}>
            <p className="text-sm leading-7 text-slate-300">{t('support.contactDescription')}</p>
            <a
              href={`mailto:${supportEmail}`}
              className="pixel-corners mt-4 inline-flex border border-accent/55 bg-accent/8 px-4 py-3 font-display text-sm text-accent transition hover:border-accent hover:text-white"
            >
              {supportEmail}
            </a>
            <p className="mt-3 text-xs leading-5 text-slate-400">{t('support.responseTime')}</p>
          </SectionPanel>
        </div>
      </div>
    </AppShell>
  );
}
