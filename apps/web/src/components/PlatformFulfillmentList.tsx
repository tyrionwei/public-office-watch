import { useEffect, useMemo, useState } from 'react';
import { useI18n, type TranslationKey } from '../i18n';
import { platformItemsForClaim } from '../lib/candidatePlatform';
import { buildPolicyShareUrl, policyShareAnchorId } from '../lib/socialSharing';
import { ShareButton } from './ShareButton';
import {
  fulfillmentPercent,
  loadPlatformFulfillment,
  platformFulfillmentStatuses,
  platformFulfillmentSummaryMinimumVotes,
  summarizePlatformFulfillment,
  submitPlatformFulfillmentVote,
  withdrawPlatformFulfillmentVote,
  type PlatformFulfillmentItem,
  type PlatformFulfillmentParticipation,
  type PlatformFulfillmentStatus,
} from '../lib/platformFulfillment';
import type { PublicPersonClaim } from '../types/publicViews';

type StatusPresentation = {
  label: TranslationKey;
  button: string;
  segment: string;
  dot: string;
};

const statusPresentation: Record<PlatformFulfillmentStatus, StatusPresentation> = {
  fulfilled: {
    label: 'person.fulfillment.fulfilled',
    button: 'border-emerald-400/60 text-emerald-200 hover:bg-emerald-400/10',
    segment: 'bg-emerald-400',
    dot: 'bg-emerald-400',
  },
  in_progress: {
    label: 'person.fulfillment.inProgress',
    button: 'border-cyan-400/60 text-cyan-100 hover:bg-cyan-400/10',
    segment: 'bg-cyan-400',
    dot: 'bg-cyan-400',
  },
  not_fulfilled: {
    label: 'person.fulfillment.notFulfilled',
    button: 'border-rose-400/60 text-rose-200 hover:bg-rose-400/10',
    segment: 'bg-rose-400',
    dot: 'bg-rose-400',
  },
  insufficient_information: {
    label: 'person.fulfillment.insufficientInformation',
    button: 'border-slate-400/60 text-slate-200 hover:bg-slate-300/10',
    segment: 'bg-slate-400',
    dot: 'bg-slate-400',
  },
};

type PolicyShareContext = {
  personId: string;
  personName: string;
};

function PolicyShareButton({
  targetId,
  itemKey,
  context,
  content,
  className,
}: {
  targetId: string;
  itemKey: string;
  context: PolicyShareContext;
  content: string;
  className?: string;
}) {
  const { t } = useI18n();
  const url = buildPolicyShareUrl(
    window.location.origin,
    context.personId,
    targetId,
    itemKey,
  );
  return (
    <ShareButton
      title={t('share.policyTitle', { person: context.personName })}
      text={t('share.policyText', { person: context.personName })}
      url={url}
      imageEyebrow={t('share.policyEyebrow')}
      imageBody={content}
      imageAlt={t('share.policyPreviewAlt')}
      imageFileName="policy.png"
      className={className}
    />
  );
}

function StaticPlatformItems({
  items,
  targetId,
  shareContext,
}: {
  items: string[];
  targetId: string;
  shareContext?: PolicyShareContext;
}) {
  return items.length > 0 ? (
    <ol className="mt-3 max-h-[34rem] list-decimal space-y-3 overflow-auto pl-5 pr-2 text-sm leading-6 text-slate-200">
      {items.map((item, index) => {
        const itemKey = `static-${index + 1}`;
        return (
          <li
            id={policyShareAnchorId(targetId, itemKey)}
            key={`${targetId}:${index}`}
            className="scroll-mt-24 target:border-accent target:bg-accent/5"
          >
            <div className="flex items-start justify-between gap-3">
              <span>{item}</span>
              {shareContext ? (
                <PolicyShareButton
                  targetId={targetId}
                  itemKey={itemKey}
                  context={shareContext}
                  content={item}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  ) : null;
}

function PlatformFulfillmentLegend() {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-[10px] text-slate-400" aria-label={t('person.fulfillment.legend')}>
      {platformFulfillmentStatuses.map((status) => (
        <span key={status} className="inline-flex items-center gap-1">
          <span className={`h-2 w-2 ${statusPresentation[status].dot}`} aria-hidden="true" />
          {t(statusPresentation[status].label)}
        </span>
      ))}
    </div>
  );
}

function VoteButtons({
  selected,
  savingStatus,
  busy,
  enabled,
  onVote,
}: {
  selected?: PlatformFulfillmentStatus;
  savingStatus?: PlatformFulfillmentStatus;
  busy: boolean;
  enabled: boolean;
  onVote: (status: PlatformFulfillmentStatus) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-4" role="group" aria-label={t('person.fulfillment.question')}>
      {platformFulfillmentStatuses.map((status) => (
        <button
          key={status}
          type="button"
          disabled={busy || !enabled}
          aria-pressed={selected === status}
          onClick={() => onVote(status)}
          className={[
            'min-h-9 border px-2 py-1 text-[11px] transition focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:cursor-wait disabled:opacity-50',
            statusPresentation[status].button,
            selected === status ? 'bg-white/10 ring-1 ring-white/30' : 'bg-bg/50',
          ].join(' ')}
        >
          {savingStatus === status
            ? t('person.fulfillment.saving')
            : t(statusPresentation[status].label)}
        </button>
      ))}
    </div>
  );
}

function ResultBar({
  item,
  countLabel,
}: {
  item: PlatformFulfillmentItem;
  countLabel?: string;
}) {
  const { t } = useI18n();
  const description = platformFulfillmentStatuses
    .map((status) => {
      const percentage = fulfillmentPercent(item.counts[status], item.totalCount);
      return `${t(statusPresentation[status].label)} ${percentage.toFixed(1)}%`;
    })
    .join('、');

  return (
    <>
      <div
        className="flex h-3 min-w-24 flex-1 overflow-hidden bg-line/35"
        role="img"
        aria-label={t('person.fulfillment.resultAria', { result: description })}
      >
        {platformFulfillmentStatuses.map((status) => {
          const percentage = fulfillmentPercent(item.counts[status], item.totalCount);
          if (percentage <= 0) return null;
          return (
            <span
              key={status}
              className={statusPresentation[status].segment}
              style={{ width: `${percentage}%` }}
              title={`${t(statusPresentation[status].label)} ${percentage.toFixed(1)}%`}
            />
          );
        })}
      </div>
      <span className="shrink-0 text-[10px] text-slate-500">
        {countLabel ?? t('person.fulfillment.voteCount', { count: item.totalCount })}
      </span>
    </>
  );
}

function ResultControls({
  item,
  visible,
  hasOwnVote,
  withdrawing,
  votingIsOpen,
  onToggle,
  onWithdraw,
}: {
  item: PlatformFulfillmentItem;
  visible: boolean;
  hasOwnVote: boolean;
  withdrawing: boolean;
  votingIsOpen: boolean;
  onToggle: () => void;
  onWithdraw: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex min-w-0 items-center gap-2 lg:min-w-[310px]">
      {visible ? (
        <ResultBar item={item} />
      ) : (
        <div
          className="h-3 min-w-24 flex-1 bg-line/35"
          data-testid="fulfillment-result-placeholder"
          aria-hidden="true"
        />
      )}
      {!hasOwnVote ? (
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 text-[11px] text-accent hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          {t(visible ? 'person.fulfillment.hideResults' : 'person.fulfillment.viewResults')}
        </button>
      ) : null}
      {hasOwnVote ? (
        <button
          type="button"
          disabled={withdrawing || !votingIsOpen}
          onClick={onWithdraw}
          className="shrink-0 text-[11px] text-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:cursor-wait disabled:opacity-50"
        >
          {t(withdrawing ? 'person.fulfillment.withdrawing' : 'person.fulfillment.withdraw')}
        </button>
      ) : null}
    </div>
  );
}

function formatEligibilityDate(value: string | null, locale: string) {
  if (!value) return null;
  const date = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

type PlatformFulfillmentListProps = {
  claim: PublicPersonClaim;
  title: string;
  shareContext?: PolicyShareContext;
} | {
  targetId: string;
  staticItems?: string[];
  title: string;
  votingBlockedReason?: 'party_threshold';
  shareContext?: PolicyShareContext;
};

export function PlatformFulfillmentList(props: PlatformFulfillmentListProps) {
  const { title, shareContext } = props;
  const targetId = 'targetId' in props ? props.targetId : props.claim.claim_id;
  const staticItems = 'targetId' in props
    ? props.staticItems ?? []
    : platformItemsForClaim(props.claim);
  const votingBlockedReason = 'targetId' in props
    ? props.votingBlockedReason
    : undefined;
  const { t, language } = useI18n();
  const [participation, setParticipation] = useState<PlatformFulfillmentParticipation | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleResultKeys, setVisibleResultKeys] = useState<Set<string>>(() => new Set());
  const [savingVote, setSavingVote] = useState<{
    itemKey: string;
    status: PlatformFulfillmentStatus;
  } | null>(null);
  const [withdrawingKey, setWithdrawingKey] = useState<string | null>(null);
  const [error, setError] = useState<{
    itemKey: string;
    kind: 'submit' | 'withdraw';
  } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setVisibleResultKeys(new Set());
    void loadPlatformFulfillment(targetId)
      .then((result) => {
        if (active) setParticipation(result);
      })
      .catch((loadError: unknown) => {
        if (active && import.meta.env.DEV) {
          console.warn('Failed to load platform fulfilment voting', loadError);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [targetId]);

  useEffect(() => {
    if (loading || !window.location.hash) return;
    let anchor = window.location.hash.slice(1);
    try {
      anchor = decodeURIComponent(anchor);
    } catch {
      return;
    }
    const target = document.getElementById(anchor);
    if (!target) return;
    window.requestAnimationFrame(() => target.scrollIntoView({ block: 'center' }));
  }, [loading, targetId]);

  const items = useMemo(() => participation?.items ?? [], [participation]);
  const overallSummary = useMemo(() => summarizePlatformFulfillment(items), [items]);
  const votingIsOpen = participation?.votingIsOpen === true && !votingBlockedReason;
  const overallResult: PlatformFulfillmentItem = {
    itemKey: 'overall',
    displayOrder: 0,
    promiseText: '',
    counts: overallSummary.counts,
    totalCount: overallSummary.totalCount,
  };

  const announcedDate = formatEligibilityDate(
    participation?.resultsAnnouncedOn ?? null,
    language,
  );
  const openDate = formatEligibilityDate(
    participation?.votingOpensOn ?? null,
    language,
  );

  async function handleVote(
    itemKey: string,
    status: PlatformFulfillmentStatus,
    currentStatus?: PlatformFulfillmentStatus,
  ) {
    if (!votingIsOpen || status === currentStatus) return;
    setSavingVote({ itemKey, status });
    setError(null);
    try {
      await submitPlatformFulfillmentVote(targetId, itemKey, status);
      const refreshed = await loadPlatformFulfillment(targetId);
      setParticipation(refreshed);
    } catch (submitError: unknown) {
      if (import.meta.env.DEV) {
        console.warn('Failed to submit platform fulfilment vote', submitError);
      }
      setError({ itemKey, kind: 'submit' });
    } finally {
      setSavingVote(null);
    }
  }

  async function handleWithdraw(itemKey: string) {
    if (!votingIsOpen) return;
    setWithdrawingKey(itemKey);
    setError(null);
    try {
      await withdrawPlatformFulfillmentVote(targetId, itemKey);
      const refreshed = await loadPlatformFulfillment(targetId);
      setParticipation(refreshed);
      setVisibleResultKeys((current) => {
        const next = new Set(current);
        next.delete(itemKey);
        return next;
      });
    } catch (withdrawError: unknown) {
      if (import.meta.env.DEV) {
        console.warn('Failed to withdraw platform fulfilment vote', withdrawError);
      }
      setError({ itemKey, kind: 'withdraw' });
    } finally {
      setWithdrawingKey(null);
    }
  }

  function toggleResult(itemKey: string) {
    setVisibleResultKeys((current) => {
      const next = new Set(current);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });
  }

  const allResultsVisible = items.length > 0
    && items.every((item) => visibleResultKeys.has(item.itemKey));

  function toggleAllResults() {
    if (allResultsVisible) {
      setVisibleResultKeys(new Set());
      return;
    }
    setVisibleResultKeys(new Set(items.map((item) => item.itemKey)));
  }

  if (!participation?.available) {
    return (
      <>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <StaticPlatformItems
          items={staticItems}
          targetId={targetId}
          shareContext={loading ? undefined : shareContext}
        />
        {loading ? <p className="mt-2 text-[10px] text-slate-500">{t('person.fulfillment.loading')}</p> : null}
      </>
    );
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {votingIsOpen ? (
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={toggleAllResults}
              className="text-[11px] text-accent hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {t(allResultsVisible
                ? 'person.fulfillment.hideAllResults'
                : 'person.fulfillment.viewAllResults')}
            </button>
            <PlatformFulfillmentLegend />
          </div>
        ) : null}
      </div>
      <div className="mt-3 border-b border-line/60 pb-2">
        {votingIsOpen ? (
          <section
            className="mt-3 border border-line/70 bg-bg/35 p-3"
            data-testid="fulfillment-overall-summary"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-slate-200">{t('person.fulfillment.overallDistribution')}</p>
              <span className="text-[10px] text-slate-500">{t('person.fulfillment.summaryProgress', { qualified: overallSummary.qualifyingItemCount, total: overallSummary.itemCount })}</span>
            </div>
            {overallSummary.ready ? (
              <div className="mt-2 flex min-w-0 items-center gap-2">
                <ResultBar item={overallResult} countLabel={t('person.fulfillment.summaryVoteCount', { count: overallSummary.totalVoteCount })} />
              </div>
            ) : (
              <p className="mt-2 text-[11px] leading-5 text-slate-400">{t('person.fulfillment.summaryPending', { count: platformFulfillmentSummaryMinimumVotes })}</p>
            )}
          </section>
        ) : null}
        {votingIsOpen ? (
          <p className="text-[10px] leading-4 text-slate-500">{t('person.fulfillment.disclaimer')}</p>
        ) : null}
        <div
          className="mt-1 flex flex-wrap items-start justify-between gap-x-4 gap-y-1"
          data-testid="fulfillment-voting-schedule"
        >
          <p className="text-[10px] leading-4 text-slate-400">
            {t('person.fulfillment.votingRule')}
          </p>
          {votingBlockedReason === 'party_threshold' ? (
            <p className="text-[10px] leading-4 text-amber-200" data-testid="party-threshold-voting-locked">
              {t('person.fulfillment.partyThresholdLocked')}
            </p>
          ) : announcedDate && openDate ? (
            <p className={`text-[10px] leading-4 ${
              votingIsOpen ? 'text-slate-500' : 'text-amber-200'
            }`}>
              {t(
                votingIsOpen
                  ? 'person.fulfillment.votingDates'
                  : 'person.fulfillment.votingDatesLocked',
                { announcedDate, openDate },
              )}
            </p>
          ) : (
            <p className="text-[10px] leading-4 text-amber-200">
              {t('person.fulfillment.votingDateMissing')}
            </p>
          )}
        </div>
      </div>
      <ol className="mt-2 max-h-[34rem] list-decimal divide-y divide-line/50 overflow-auto pl-5 pr-2 text-sm text-slate-200">
        {items.map((item) => {
          const ownVote = participation.ownVotes[item.itemKey];
          const itemSavingVote = savingVote?.itemKey === item.itemKey
            ? savingVote.status
            : undefined;
          const withdrawing = withdrawingKey === item.itemKey;
          return (
            <li
              id={policyShareAnchorId(targetId, item.itemKey)}
              key={item.itemKey}
              className="scroll-mt-24 py-3 pl-1 target:bg-accent/5"
            >
              <div className={votingIsOpen
                ? 'grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start'
                : ''}
              >
                <div className={votingIsOpen
                  ? 'flex min-w-0 items-start justify-between gap-3'
                  : 'grid min-w-0 gap-2'}
                >
                  <p className="min-w-0 flex-1 leading-6" data-testid="platform-promise">{item.promiseText}</p>
                  {shareContext ? (
                    <PolicyShareButton
                      targetId={targetId}
                      itemKey={item.itemKey}
                      context={shareContext}
                      content={item.promiseText}
                      className={votingIsOpen ? undefined : 'justify-self-end'}
                    />
                  ) : null}
                </div>
                {votingIsOpen ? (
                  <div className="grid gap-2">
                    <VoteButtons
                      selected={ownVote}
                      savingStatus={itemSavingVote}
                      busy={Boolean(itemSavingVote) || withdrawing}
                      enabled={votingIsOpen}
                      onVote={(status) => void handleVote(item.itemKey, status, ownVote)}
                    />
                    <ResultControls
                      item={item}
                      visible={Boolean(ownVote) || visibleResultKeys.has(item.itemKey)}
                      hasOwnVote={Boolean(ownVote)}
                      withdrawing={withdrawing}
                      votingIsOpen={votingIsOpen}
                      onToggle={() => toggleResult(item.itemKey)}
                      onWithdraw={() => void handleWithdraw(item.itemKey)}
                    />
                  </div>
                ) : null}
              </div>
              {error?.itemKey === item.itemKey ? (
                <p className="mt-1 text-xs text-rose-300" role="alert">
                  {t(error.kind === 'withdraw'
                    ? 'person.fulfillment.withdrawError'
                    : 'person.fulfillment.submitError')}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </>
  );
}
