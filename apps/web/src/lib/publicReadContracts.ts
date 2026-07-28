export const PUBLIC_PEOPLE_PAGE_SIZE = 20;
export const PUBLIC_ELECTION_RACE_PAGE_SIZE = 20;
export const PUBLIC_SEARCH_RESULT_LIMIT = 12;

export type PublicPageRange = {
  from: number;
  to: number;
};

export function toPublicPageRange(page: number, pageSize: number): PublicPageRange {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePageSize = Math.min(
    Number.isInteger(pageSize) && pageSize > 0 ? pageSize : PUBLIC_PEOPLE_PAGE_SIZE,
    PUBLIC_PEOPLE_PAGE_SIZE,
  );
  const from = (safePage - 1) * safePageSize;

  return { from, to: from + safePageSize - 1 };
}

export function normalizePublishedSearchQuery(query: string) {
  return query
    .normalize('NFC')
    .replace(/臺/g, '台')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('zh-TW');
}
