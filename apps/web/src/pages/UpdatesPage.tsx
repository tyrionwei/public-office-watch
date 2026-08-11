import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import type { PublicUpdate, PublicUpdateType } from '../types/publicViews';

const updateLabelKeys: Record<PublicUpdateType, TranslationKey> = {
  candidate: 'updates.type.candidate',
  person: 'updates.type.person',
  party: 'updates.type.party',
  election: 'updates.type.election',
  correction: 'updates.type.correction',
  site: 'updates.type.site',
};

function formatPublishedAt(value: string, language: 'zh-TW' | 'en') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language, {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function UpdatesPage() {
  const { language, t } = useI18n();
  const [updates, setUpdates] = useState<PublicUpdate[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    setStatus('loading');
    void publicDataProvider.loadPublicUpdates(50)
      .then((rows) => {
        if (!active) return;
        setUpdates(rows);
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell>
      <div className="space-y-3">
        <PixelFrame title={t('updates.frameTitle')}>
          <div className="max-w-4xl">
            <p className="text-xs uppercase tracking-[0.22em] text-accent">{t('updates.eyebrow')}</p>
            <h2 className="mt-2 font-display text-3xl text-white sm:text-4xl">{t('updates.heading')}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{t('updates.description')}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{t('updates.scopeNote')}</p>
          </div>
        </PixelFrame>

        <SectionPanel title={t('updates.listTitle')} eyebrow={t('updates.listEyebrow')}>
          {status === 'loading' ? (
            <p className="text-sm text-slate-400" aria-live="polite">{t('updates.loading')}</p>
          ) : null}
          {status === 'error' ? (
            <p className="border border-red-400/35 bg-red-400/8 p-4 text-sm text-red-200">{t('updates.error')}</p>
          ) : null}
          {status === 'ready' && updates.length === 0 ? (
            <p className="border border-line/70 bg-bg/35 p-4 text-sm text-slate-400">{t('updates.empty')}</p>
          ) : null}
          {status === 'ready' && updates.length > 0 ? (
            <ol className="space-y-3">
              {updates.map((update) => (
                <li key={update.update_id}>
                  <article className="pixel-corners border border-line/75 bg-bg/35 p-4 transition hover:border-accent/40 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="border border-accent/45 bg-accent/10 px-2 py-1 font-display text-accent">
                        {t(updateLabelKeys[update.update_type])}
                      </span>
                      <time dateTime={update.published_at} className="text-slate-500">
                        {formatPublishedAt(update.published_at, language)}
                      </time>
                    </div>
                    <h3 className="mt-3 font-display text-lg text-white">{update.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{update.summary}</p>
                    {update.entity_href || update.source_url ? (
                      <div className="mt-4 flex flex-wrap gap-3 text-xs">
                        {update.entity_href ? (
                          <Link className="text-accent hover:text-white" to={update.entity_href}>
                            {t('updates.viewRelated')} →
                          </Link>
                        ) : null}
                        {update.source_url ? (
                          <a
                            className="text-signal hover:text-white"
                            href={update.source_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {update.source_name || t('updates.viewSource')} ↗
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                </li>
              ))}
            </ol>
          ) : null}
        </SectionPanel>
      </div>
    </AppShell>
  );
}
