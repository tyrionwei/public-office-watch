import { internalReviewFetch } from './internalReviewClient';
import type { DataProgressSummary } from './dataProgressContract';

export async function fetchInternalDataProgress(params: URLSearchParams): Promise<DataProgressSummary> {
  const response = await internalReviewFetch(`/internal-api/data-progress?${params}`);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || '無法讀取本機進度。');
  return body as DataProgressSummary;
}
