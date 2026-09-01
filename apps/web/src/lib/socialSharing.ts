const comparisonAnchorId = 'candidate-comparison';

function requiredIdentifier(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function shareUrl(origin: string, pathname: string) {
  return new URL(pathname, requiredIdentifier(origin, 'origin'));
}

export function policyShareAnchorId(claimId: string, itemKey: string) {
  return `policy-${requiredIdentifier(claimId, 'claimId')}-${requiredIdentifier(itemKey, 'itemKey')}`;
}

export function buildPolicyShareUrl(
  origin: string,
  personId: string,
  claimId: string,
  itemKey: string,
) {
  const normalizedPersonId = requiredIdentifier(personId, 'personId');
  const normalizedClaimId = requiredIdentifier(claimId, 'claimId');
  const normalizedItemKey = requiredIdentifier(itemKey, 'itemKey');
  const url = shareUrl(origin, `/people/${encodeURIComponent(normalizedPersonId)}`);
  url.searchParams.set('policy', `${normalizedClaimId}:${normalizedItemKey}`);
  url.hash = policyShareAnchorId(normalizedClaimId, normalizedItemKey);
  return url.toString();
}

export function buildCandidateComparisonShareUrl(
  origin: string,
  raceId: string,
  personIds: string[],
) {
  const normalizedRaceId = requiredIdentifier(raceId, 'raceId');
  const uniquePersonIds = Array.from(new Set(
    personIds.map((personId) => personId.trim()).filter(Boolean),
  )).slice(0, 4);
  if (uniquePersonIds.length < 2) {
    throw new Error('At least two candidates are required');
  }

  const url = shareUrl(origin, `/elections/races/${encodeURIComponent(normalizedRaceId)}`);
  url.searchParams.set('compare', uniquePersonIds.join(','));
  url.hash = comparisonAnchorId;
  return url.toString();
}

export function buildLineShareUrl(text: string, url: string) {
  const lineUrl = new URL('https://social-plugins.line.me/lineit/share');
  lineUrl.searchParams.set('url', requiredIdentifier(url, 'url'));
  const normalizedText = text.trim();
  if (normalizedText) lineUrl.searchParams.set('text', normalizedText);
  return lineUrl.toString();
}

export function shareClipboardText(text: string, url: string) {
  const normalizedText = text.trim();
  const normalizedUrl = requiredIdentifier(url, 'url');
  return normalizedText ? `${normalizedText}\n${normalizedUrl}` : normalizedUrl;
}

export { comparisonAnchorId };
