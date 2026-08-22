export const publicUpdateTypes = ['candidate', 'person', 'party', 'election', 'correction', 'site'] as const;
export const publicUpdateEntityTypes = ['person', 'party', 'election', 'race', 'region'] as const;
export const publicUpdateReviewActions = ['approve', 'reject', 'withdraw'] as const;

export type PublicUpdateType = typeof publicUpdateTypes[number];
export type PublicUpdateEntityType = typeof publicUpdateEntityTypes[number];
export type PublicUpdateReviewAction = typeof publicUpdateReviewActions[number];

type DraftPayload = {
  updateType: PublicUpdateType;
  title: string;
  summary: string;
  entityType: PublicUpdateEntityType | null;
  entityId: string | null;
  entityHref: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  occurredAt: string | null;
};

function optionalText(value: unknown, maxLength: number) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) return undefined;
  return normalized;
}

export function normalizePublicUpdateDraft(payload: Record<string, unknown>): DraftPayload | null {
  const updateType = typeof payload.updateType === 'string' && publicUpdateTypes.includes(payload.updateType as PublicUpdateType)
    ? payload.updateType as PublicUpdateType
    : null;
  const title = optionalText(payload.title, 120);
  const summary = optionalText(payload.summary, 500);
  const entityType = payload.entityType == null || payload.entityType === ''
    ? null
    : typeof payload.entityType === 'string' && publicUpdateEntityTypes.includes(payload.entityType as PublicUpdateEntityType)
      ? payload.entityType as PublicUpdateEntityType
      : undefined;
  const entityId = optionalText(payload.entityId, 160);
  const entityHref = optionalText(payload.entityHref, 300);
  const sourceName = optionalText(payload.sourceName, 160);
  const sourceUrl = optionalText(payload.sourceUrl, 1000);
  const occurredAt = optionalText(payload.occurredAt, 40);

  if (!updateType || !title || !summary || entityType === undefined || entityId === undefined
    || entityHref === undefined || sourceName === undefined || sourceUrl === undefined || occurredAt === undefined) return null;
  if (entityId && !entityType) return null;
  if (entityHref && (!entityHref.startsWith('/') || entityHref.startsWith('//') || entityHref.startsWith('/internal/'))) return null;
  if (sourceUrl && !/^https?:\/\//iu.test(sourceUrl)) return null;
  if (occurredAt && Number.isNaN(Date.parse(occurredAt))) return null;

  return { updateType, title, summary, entityType, entityId, entityHref, sourceName, sourceUrl, occurredAt };
}

export function normalizePublicUpdateReview(payload: Record<string, unknown>) {
  const action = typeof payload.reviewAction === 'string' && publicUpdateReviewActions.includes(payload.reviewAction as PublicUpdateReviewAction)
    ? payload.reviewAction as PublicUpdateReviewAction
    : null;
  const updateId = typeof payload.updateId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(payload.updateId)
    ? payload.updateId
    : null;
  const reason = optionalText(payload.reason, 300);
  if (!action || !updateId || reason === undefined) return null;
  if ((action === 'reject' || action === 'withdraw') && (!reason || reason.length < 2)) return null;
  return { action, updateId, reason };
}
