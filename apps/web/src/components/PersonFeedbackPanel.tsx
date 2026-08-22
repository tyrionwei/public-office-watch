import { useEffect, useMemo, useState } from 'react';
import { SectionPanel } from './SectionPanel';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n';
import {
  feedbackSectionKeys,
  fetchPersonFeedbackContext,
  submitPersonFeedback,
  type FeedbackSectionKey,
  type PersonFeedbackContext,
  type ProblemType,
} from '../lib/personFeedback';

const sectionLabels: Record<FeedbackSectionKey, TranslationKey> = {
  basic: 'personFeedback.section.basic',
  candidacies: 'personFeedback.section.candidacies',
  timeline: 'personFeedback.section.timeline',
  affiliations: 'personFeedback.section.affiliations',
  resume: 'personFeedback.section.resume',
  platform: 'personFeedback.section.platform',
  finance: 'personFeedback.section.finance',
  legal: 'personFeedback.section.legal',
  family: 'personFeedback.section.family',
  sources: 'personFeedback.section.sources',
};

const problemTypes: ProblemType[] = ['inaccurate', 'outdated', 'broken_source', 'misleading', 'other'];

const problemTypeLabels: Record<ProblemType, TranslationKey> = {
  inaccurate: 'personFeedback.problem.inaccurate',
  outdated: 'personFeedback.problem.outdated',
  broken_source: 'personFeedback.problem.brokenSource',
  misleading: 'personFeedback.problem.misleading',
  other: 'personFeedback.problem.other',
};

type FeedbackMode = 'supplement' | 'problem';

export function PersonFeedbackPanel({
  personId,
  personName,
  requestedSection,
  requestVersion,
}: {
  personId: string;
  personName: string;
  requestedSection?: FeedbackSectionKey | null;
  requestVersion?: number;
}) {
  const { t } = useI18n();
  const [context, setContext] = useState<PersonFeedbackContext>({ priorities: [], ownSubmissions: [] });
  const [mode, setMode] = useState<FeedbackMode | null>(null);
  const [sectionKey, setSectionKey] = useState<FeedbackSectionKey>('basic');
  const [problemType, setProblemType] = useState<ProblemType>('inaccurate');
  const [message, setMessage] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchPersonFeedbackContext(personId)
      .then((result) => {
        if (!cancelled) setContext(result);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(t('personFeedback.loadError'));
        if (import.meta.env.DEV) console.warn('Failed to load person feedback context', loadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [personId, t]);

  const priorityCounts = useMemo(
    () => new Map(context.priorities.map((priority) => [priority.sectionKey, priority.requestCount])),
    [context.priorities],
  );
  const requestedSections = useMemo(
    () => new Set(
      context.ownSubmissions
        .filter((submission) => submission.feedbackKind === 'supplement_request' && submission.active)
        .map((submission) => submission.sectionKey),
    ),
    [context.ownSubmissions],
  );
  const reportedSections = useMemo(
    () => new Set(
      context.ownSubmissions
        .filter((submission) => submission.feedbackKind === 'problem_report' && submission.active)
        .map((submission) => submission.sectionKey),
    ),
    [context.ownSubmissions],
  );
  const problemMessageValid = message.trim().length >= 20 && message.trim().length <= 1500;
  const evidenceUrlValid = !evidenceUrl.trim() || /^https?:\/\//i.test(evidenceUrl.trim());
  const canSubmit = mode === 'supplement' || (problemMessageValid && evidenceUrlValid);

  useEffect(() => {
    if (!requestedSection) return;
    setMode('problem');
    setSectionKey(requestedSection);
    setNotice(null);
    setError(null);
    document.getElementById('person-feedback')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [requestedSection, requestVersion]);

  async function handleSubmit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    setNotice(null);
    setError(null);

    try {
      const nextContext = await submitPersonFeedback({
        personId,
        feedbackKind: mode === 'supplement' ? 'supplement_request' : 'problem_report',
        sectionKey,
        problemType: mode === 'problem' ? problemType : undefined,
        message: mode === 'problem' ? message.trim() : undefined,
        evidenceUrl: mode === 'problem' ? evidenceUrl.trim() : undefined,
      });
      setContext(nextContext);
      setNotice(t(mode === 'supplement' ? 'personFeedback.supplementSaved' : 'personFeedback.problemSaved'));
      if (mode === 'problem') {
        setMessage('');
        setEvidenceUrl('');
      }
    } catch (submitError: unknown) {
      setError(t('personFeedback.submitError'));
      if (import.meta.env.DEV) console.warn('Failed to submit person feedback', submitError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="person-feedback" className="scroll-mt-4">
      <SectionPanel title={t('personFeedback.title')} eyebrow={t('personFeedback.eyebrow')}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 pb-4">
          <p className="max-w-3xl text-sm leading-6 text-slate-300">
            {t('personFeedback.summary', { name: personName })}
          </p>
          <div className="flex shrink-0 border border-line/70 bg-bg/45 p-1">
            <button
              type="button"
              aria-pressed={mode === 'supplement'}
              onClick={() => {
                setMode('supplement');
                setNotice(null);
                setError(null);
              }}
              className={`px-4 py-2 text-sm font-semibold ${mode === 'supplement' ? 'bg-accent text-bg' : 'text-slate-300 hover:text-white'}`}
            >
              {t('personFeedback.supplement')}
            </button>
            <button
              type="button"
              aria-pressed={mode === 'problem'}
              onClick={() => {
                setMode('problem');
                setNotice(null);
                setError(null);
              }}
              className={`px-4 py-2 text-sm font-semibold ${mode === 'problem' ? 'bg-signal text-bg' : 'text-slate-300 hover:text-white'}`}
            >
              {t('personFeedback.problem')}
            </button>
          </div>
        </div>

        {mode === 'supplement' ? (
          <div>
            <p className="mb-3 text-sm text-slate-400">{t('personFeedback.supplementPrompt')}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {feedbackSectionKeys.map((key) => {
                const selected = sectionKey === key;
                const requested = requestedSections.has(key);
                const count = priorityCounts.get(key) ?? 0;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setSectionKey(key);
                      setNotice(null);
                    }}
                    className={`min-h-20 border px-3 py-3 text-left ${
                      selected
                        ? 'border-accent bg-accent/15 text-white'
                        : 'border-line/70 bg-bg/35 text-slate-300 hover:border-accent/60'
                    }`}
                  >
                    <span className="block text-sm font-semibold">{t(sectionLabels[key])}</span>
                    <span className="mt-2 block text-xs text-slate-500">
                      {requested ? t('personFeedback.requested') : t('personFeedback.requestCount', { count })}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : mode === 'problem' ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-300">
              <span>{t('personFeedback.sectionLabel')}</span>
              <select
                value={sectionKey}
                onChange={(event) => setSectionKey(event.target.value as FeedbackSectionKey)}
                className="border border-line/70 bg-bg/70 px-3 py-3 text-white outline-none focus:border-accent"
              >
                {feedbackSectionKeys.map((key) => (
                  <option key={key} value={key}>{t(sectionLabels[key])}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              <span>{t('personFeedback.problemTypeLabel')}</span>
              <select
                value={problemType}
                onChange={(event) => setProblemType(event.target.value as ProblemType)}
                className="border border-line/70 bg-bg/70 px-3 py-3 text-white outline-none focus:border-accent"
              >
                {problemTypes.map((type) => (
                  <option key={type} value={type}>{t(problemTypeLabels[type])}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-slate-300 lg:col-span-2">
              <span>{t('personFeedback.messageLabel')}</span>
              <textarea
                value={message}
                maxLength={1500}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={t('personFeedback.messagePlaceholder')}
                rows={5}
                className="resize-y border border-line/70 bg-bg/70 px-3 py-3 text-white outline-none placeholder:text-slate-600 focus:border-accent"
              />
              <span className={problemMessageValid || message.length === 0 ? 'text-xs text-slate-500' : 'text-xs text-rose-300'}>
                {t('personFeedback.messageCount', { count: message.trim().length })}
              </span>
            </label>
            <label className="grid gap-2 text-sm text-slate-300 lg:col-span-2">
              <span>{t('personFeedback.evidenceLabel')}</span>
              <input
                type="url"
                value={evidenceUrl}
                onChange={(event) => setEvidenceUrl(event.target.value)}
                placeholder="https://"
                className="border border-line/70 bg-bg/70 px-3 py-3 text-white outline-none placeholder:text-slate-600 focus:border-accent"
              />
              {!evidenceUrlValid ? <span className="text-xs text-rose-300">{t('personFeedback.evidenceError')}</span> : null}
            </label>
          </div>
        ) : null}

        {mode ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-4">
          <p className="text-xs leading-5 text-slate-500">
            {t(mode === 'supplement' ? 'personFeedback.supplementPrivacy' : 'personFeedback.problemPrivacy')}
          </p>
          <button
            type="button"
            disabled={loading || saving || !canSubmit}
            onClick={() => void handleSubmit()}
            className="pixel-corners min-w-36 border border-signal/80 bg-signal px-5 py-3 text-sm font-semibold text-bg hover:bg-[#fff07a] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {saving
              ? t('personFeedback.saving')
              : t(mode === 'supplement' ? 'personFeedback.submitSupplement' : 'personFeedback.submitProblem')}
          </button>
        </div>

        ) : null}
        {reportedSections.has(sectionKey) && mode === 'problem' && !notice ? (
          <p className="text-sm text-accent">{t('personFeedback.alreadyReported')}</p>
        ) : null}
        {notice ? <p className="text-sm text-signal">{notice}</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>
      </SectionPanel>
    </div>
  );
}
