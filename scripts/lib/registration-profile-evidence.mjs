import { datePrecision, officialHost } from './official-profile-policy.mjs';

const proposalSourceId = 'cec-registration-profile-evidence';
const masked = /^[*＊xX?？○〇●□Ｘ]+$/u;

function dateParts(raw) {
  const original = String(raw ?? '').normalize('NFKC').trim();
  if (!original) return null;
  const value = original.replace(/^(?:中華民國|民國)\s*/u, '')
    .replace(/[年月.\-]/gu, '/')
    .replace(/日$/u, '')
    .replace(/\s+/gu, '')
    .replace(/\/$/u, '');
  let parts;
  if (/^[0-9*＊xX?？○〇●□Ｘ]{7,8}$/u.test(value)) {
    parts = value.length === 8
      ? [value.slice(0, 4), value.slice(4, 6), value.slice(6, 8)]
      : [value.slice(0, 3), value.slice(3, 5), value.slice(5, 7)];
  } else if (/^[0-9*＊xX?？○〇●□Ｘ]+(?:\/[0-9*＊xX?？○〇●□Ｘ]+){0,2}$/u.test(value)) {
    parts = value.split('/');
  } else return null;
  const [yearPart, monthPart, dayPart] = parts;
  if (!/^\d{2,4}$/u.test(yearPart)) return null;
  const year = yearPart.length === 4 ? Number(yearPart) : 1911 + Number(yearPart);
  if (year < 1801 || year > 2199) return null;
  const prefix = String(year);
  if (monthPart === undefined || masked.test(monthPart) || /\D/u.test(monthPart)) {
    if (monthPart !== undefined && !masked.test(monthPart) && !/^\d?[*＊xX?？○〇●□Ｘ]+$/u.test(monthPart)) return null;
    return { value: prefix, precision: 'year', raw: original };
  }
  if (!/^\d{1,2}$/u.test(monthPart) || Number(monthPart) < 1 || Number(monthPart) > 12) return null;
  const monthValue = `${prefix}-${monthPart.padStart(2, '0')}`;
  if (dayPart === undefined || masked.test(dayPart) || /\D/u.test(dayPart)) {
    if (dayPart !== undefined && !masked.test(dayPart) && !/^\d?[*＊xX?？○〇●□Ｘ]+$/u.test(dayPart)) return null;
    return { value: monthValue, precision: 'month', raw: original };
  }
  if (!/^\d{1,2}$/u.test(dayPart)) return null;
  const dayValue = `${monthValue}-${dayPart.padStart(2, '0')}`;
  return datePrecision(dayValue) === 'day' ? { value: dayValue, precision: 'day', raw: original } : null;
}

function rawField(evidence, key, fallback) {
  const primary = evidence[key];
  const raw = evidence.raw?.[fallback];
  const values = [primary, raw].filter((value) => value !== null && value !== undefined && String(value).trim());
  if (values.length === 0) return null;
  if (values.length > 1 && String(values[0]).trim() !== String(values[1]).trim()) return null;
  return String(values[0]).trim();
}

/**
 * Converts a stored candidacy claim or seed personClaim with registrationEvidence
 * into private profile proposals. No identity or publication approval is inferred.
 * `options.identityStatus` may be verified, pending, or isolated; only a later
 * separate review can adopt a proposal.
 */
export function buildRegistrationProfileProposals(parentClaim, options = {}) {
  const json = parentClaim?.claim_json ?? parentClaim?.claimJson ?? {};
  const evidence = json.registrationEvidence;
  const claimType = parentClaim?.claim_type ?? parentClaim?.claimType;
  const parentClaimKey = parentClaim?.claim_key ?? parentClaim?.claimKey ?? parentClaim?.id;
  if (claimType !== 'candidacy' || !evidence || !parentClaimKey) return [];
  const sourceUrl = evidence.source?.url ?? parentClaim.source_url ?? parentClaim.sourceUrl;
  if (!officialHost(sourceUrl)) return [];
  const personId = parentClaim.person_id ?? parentClaim.personId ?? null;
  const candidateId = parentClaim.candidate_id ?? parentClaim.candidateId ?? null;
  const candidateExternalId = json.candidateExternalId ?? null;
  const parentReviewStatus = parentClaim.review_status ?? parentClaim.reviewStatus ?? 'pending';
  const identityStatus = options.identityStatus ?? json.registrationProfileIdentityStatus
    ?? (parentReviewStatus === 'verified' ? 'unconfirmed' : 'pending');
  const birthRaw = rawField(evidence, 'birth_date_raw', '出生年月日');
  const birth = dateParts(birthRaw);
  const educationRaw = rawField(evidence, 'education_raw', '學歷');
  const values = [birth && ['birth_date', birth.value, birth.raw, birth.precision],
    educationRaw && ['education', educationRaw, educationRaw, null]].filter(Boolean);
  return values.map(([type, value, raw, precision]) => ({
    claimKey: `registration-profile:${parentClaimKey}:${type}`,
    claimType: type,
    claimValue: value,
    claimJson: {
      value,
      registrationProposal: {
        version: 'registration-profile-proposal-v1', reviewOnly: true,
        parentClaimId: parentClaim.id ?? null, parentClaimKey,
        parentReviewStatus, identityStatus,
        personId, candidateId, candidateExternalId,
        rawValue: raw, datePrecision: precision,
        registrationEvidence: evidence,
      },
    },
    personId, candidateId,
    personExternalId: json.personExternalId ?? parentClaim.personExternalId ?? null,
    sourcePersonId: parentClaim.source_person_id ?? parentClaim.sourcePersonId ?? null,
    personName: evidence.name ?? parentClaim.personName ?? null,
    sourceId: parentClaim.sourceId ?? json.sourceId ?? proposalSourceId,
    sourceName: parentClaim.source_name ?? parentClaim.sourceName ?? evidence.source?.name ?? '官方登記資料',
    sourceUrl,
    observedAt: parentClaim.observed_at ?? parentClaim.observedAt ?? null,
    confidenceLevel: 'D', reviewStatus: 'pending', visibility: 'review_only', isPublic: false,
  }));
}
