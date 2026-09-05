function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function latestClaimEvidenceReview(claimJson: Record<string, unknown> | undefined) {
  const history = claimJson?.evidenceReviews;
  if (!Array.isArray(history) || history.length === 0) return null;
  // Evidence reviews are append-only; never fall back to an older recommendation.
  const latest = record(history[history.length - 1]);
  if (!latest) return null;
  const sources = (Array.isArray(latest.sources) ? latest.sources : []).flatMap((value) => {
    const source = record(value);
    const url = text(source?.url);
    if (!url) return [];
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return [];
      return [{ url: parsed.href, publisher: text(source?.publisher) ?? parsed.hostname }];
    } catch {
      return [];
    }
  });
  return {
    route: text(latest.route),
    reason: text(latest.reason),
    confidence: text(latest.confidence),
    sources,
  };
}
