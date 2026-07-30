export function normalizeElectionDistrict(value) {
  if (value == null) return null;

  let normalized = String(value).normalize('NFKC').trim();
  if (!normalized) return normalized;

  if (/^0+\d+$/.test(normalized)) {
    return String(Number.parseInt(normalized, 10));
  }

  normalized = normalized.replace(
    /第\s*0+(\d+)\s*(選舉區|選區)/gu,
    (_, digits, suffix) => `第${Number.parseInt(digits, 10)}${suffix}`,
  );

  return normalized.replace(
    /(^|[^\d第])0+(\d+)\s*(選舉區|選區)/gu,
    (_, prefix, digits, suffix) => `${prefix}${Number.parseInt(digits, 10)}${suffix}`,
  );
}
