import { useEffect, useMemo, useState } from 'react';
import { useI18n, type TranslationKey } from '../i18n';
import {
  loadNationalIssueParticipation,
  loadRegionIssueParticipation,
  submitRegionIssueParticipation,
  type RegionIssueResult,
} from '../lib/regionIssueParticipation';
import { PixelFrame } from './PixelFrame';

type RegionIssueConcernPanelProps = {
  regionId: string | null;
  regionLabel: string;
  national?: boolean;
};

const issueTranslationKeys: Record<string, TranslationKey> = {
  transportation: 'homeIssues.issue.transportation',
  housing: 'homeIssues.issue.housing',
  childcare_education: 'homeIssues.issue.childcareEducation',
  healthcare_eldercare: 'homeIssues.issue.healthcareEldercare',
  environment_climate: 'homeIssues.issue.environmentClimate',
  public_safety: 'homeIssues.issue.publicSafety',
  economic_jobs: 'homeIssues.issue.economicJobs',
  urban_rural_development: 'homeIssues.issue.urbanRuralDevelopment',
};

function participantCount(issues: RegionIssueResult[]) {
  return issues[0]?.participantCount ?? 0;
}

export function RegionIssueConcernPanel({ regionId, regionLabel, national = false }: RegionIssueConcernPanelProps) {
  const { t } = useI18n();
  const [issues, setIssues] = useState<RegionIssueResult[]>([]);
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [hasResponse, setHasResponse] = useState(false);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(regionId);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSaved(false);
    setError(null);

    if (!regionId && !national) {
      setIssues([]);
      setSelectedIssueIds([]);
      setAvailable(false);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const participationRequest = national
      ? loadNationalIssueParticipation()
      : loadRegionIssueParticipation(regionId as string);
    void participationRequest
      .then((participation) => {
        if (!active) return;
        setActiveRegionId(participation.regionId);
        setIssues(participation.issues);
        setSelectedIssueIds(participation.selectedIssueIds);
        setHasResponse(participation.hasResponse);
        setAvailable(participation.available);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        if (import.meta.env.DEV) console.warn('Failed to load region issue participation', loadError);
        setError(t('homeIssues.loadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [national, regionId, t]);

  const selectedSet = useMemo(() => new Set(selectedIssueIds), [selectedIssueIds]);
  const reachedLimit = selectedIssueIds.length >= 3;

  function toggleIssue(issueId: string) {
    setSaved(false);
    setError(null);
    setSelectedIssueIds((current) => {
      if (current.includes(issueId)) return current.filter((id) => id !== issueId);
      if (current.length >= 3) return current;
      return [...current, issueId];
    });
  }

  async function handleSubmit() {
    if (!activeRegionId || selectedIssueIds.length < 1 || selectedIssueIds.length > 3) return;

    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await submitRegionIssueParticipation(activeRegionId, selectedIssueIds);
      const participation = national
        ? await loadNationalIssueParticipation()
        : await loadRegionIssueParticipation(activeRegionId);
      setIssues(participation.issues);
      setSelectedIssueIds(participation.selectedIssueIds);
      setHasResponse(true);
      setSaved(true);
    } catch (submitError: unknown) {
      if (import.meta.env.DEV) console.warn('Failed to submit region issue participation', submitError);
      setError(t('homeIssues.submitError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PixelFrame
      title={national ? t('homeIssues.nationalTitle') : t('homeIssues.title')}
      className="xl:h-full"
      action={(
        <span className="text-[11px] text-slate-400">
          {regionLabel} · {t('homeIssues.participants', { count: participantCount(issues) })}
        </span>
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-base text-white">
            {national ? t('homeIssues.nationalPrompt') : t('homeIssues.prompt')}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{t('homeIssues.voluntaryNote')}</p>
        </div>
        <span className="shrink-0 text-xs text-accent">
          {t('homeIssues.selectionCount', { count: selectedIssueIds.length })}
        </span>
      </div>

      {loading ? (
        <div className="mt-4 grid gap-2" aria-label={national ? t('homeIssues.nationalLoading') : t('homeIssues.loading')}>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-11 animate-pulse border border-line/50 bg-bg/35" />
          ))}
        </div>
      ) : !available ? (
        <p className="mt-4 border border-line/60 bg-bg/35 p-3 text-sm text-slate-400">
          {t('homeIssues.unavailable')}
        </p>
      ) : (
        <div className="mt-4 grid gap-x-4 lg:grid-cols-2">
          {issues.map((issue) => {
            const selected = selectedSet.has(issue.issueId);
            const disabled = !selected && reachedLimit;
            const labelKey = issueTranslationKeys[issue.issueKey];

            return (
              <label
                key={issue.issueId}
                className={[
                  'group grid min-h-14 cursor-pointer grid-cols-[20px_minmax(0,1fr)_44px] items-center gap-3 border-b border-line/60 py-2.5',
                  disabled ? 'cursor-not-allowed opacity-45' : '',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={disabled}
                  onChange={() => toggleIssue(issue.issueId)}
                  className="h-4 w-4 accent-accent"
                />
                <span className="min-w-0">
                  <span className="block text-sm text-slate-200 group-hover:text-white">
                    {labelKey ? t(labelKey) : issue.issueKey}
                  </span>
                  <span className="mt-1 block h-1 overflow-hidden bg-line/45" aria-hidden="true">
                    <span
                      className="block h-full bg-accent/75 transition-[width]"
                      style={{ width: `${Math.min(100, issue.selectionRate)}%` }}
                    />
                  </span>
                </span>
                <span className="text-right font-display text-sm text-signal">{issue.selectionRate}%</span>
              </label>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-4 border-t border-line/60 pt-3">
        <p className="text-[11px] leading-relaxed text-slate-500">{t('homeIssues.delayedNote')}</p>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!available || loading || saving || selectedIssueIds.length < 1}
          className="pixel-corners min-w-28 shrink-0 border border-signal/80 bg-signal px-4 py-2 font-display text-sm text-bg transition hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-signal/40 disabled:cursor-not-allowed disabled:border-line disabled:bg-line disabled:text-slate-500"
        >
          {saving ? t('homeIssues.saving') : hasResponse ? t('homeIssues.update') : t('homeIssues.submit')}
        </button>
      </div>

      <p className="mt-2 min-h-4 text-xs" aria-live="polite">
        {saved ? <span className="text-emerald-300">{t('homeIssues.saved')}</span> : null}
        {error ? <span className="text-rose-300">{error}</span> : null}
      </p>
    </PixelFrame>
  );
}
