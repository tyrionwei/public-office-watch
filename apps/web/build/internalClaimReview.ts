type ClaimApprovalTarget = {
  person_id: string | null;
  claim_type: string;
  candidate_id: string | null;
};

type EditableProfileClaim = {
  claim_type: string;
  claim_value: string | null;
  claim_json: Record<string, unknown> | null;
};

const editableProfileClaimTypes = new Set(['education', 'experience']);

export function claimReviewStatusFilters(status: string | undefined): Record<string, string> | null {
  if (!status) return {};
  if (status === 'ready_for_publication') {
    return {
      review_status: 'in.(pending,needs_more_evidence)',
      'claim_json->evidenceReviews->-1->>route': 'eq.ready_for_publication',
      order: 'updated_at.desc',
    };
  }
  if (status === 'pending' || status === 'needs_more_evidence') {
    return { review_status: 'eq.' + status };
  }
  return null;
}

export function isEditableProfileClaimType(claimType: string) {
  return editableProfileClaimTypes.has(claimType);
}

export function buildEditableProfileClaimRevision(
  claim: EditableProfileClaim,
  submittedValue: string | undefined,
  reviewedAt: string,
) {
  if (!isEditableProfileClaimType(claim.claim_type)) return null;

  const value = (submittedValue ?? claim.claim_value ?? '').replace(/\r\n?/g, '\n').trim();
  if (!value) throw new Error('學歷或經歷內容不能留空。');
  if (value.length > 20_000) throw new Error('學歷或經歷內容不能超過 20,000 字。');

  const originalValue = claim.claim_value?.trim() ?? '';
  const changed = value !== originalValue;
  return {
    value,
    changed,
    claimJson: {
      ...(claim.claim_json ?? {}),
      value,
      ...(changed ? {
        reviewEdit: {
          version: 'internal-review-ui-profile-edit-v1',
          originalValue,
          reviewedValue: value,
          reviewedAt,
        },
      } : {}),
    },
  };
}

export function canUpdateProfileField(currentValue: string | null, originalClaimValue: string | null) {
  const current = currentValue?.trim() ?? '';
  const original = originalClaimValue?.trim() ?? '';
  return !current || current === original;
}

export function claimApprovalBlockReason(claim: ClaimApprovalTarget) {
  if (!claim.person_id) return '這筆資料尚未對應到既有人物，請先完成身分比對。';
  if (claim.claim_type === 'platform' && !claim.candidate_id) {
    return '這筆政見尚未配對到確切參選紀錄，不能公開。';
  }
  return null;
}

/** Generic identity actions cannot bypass the reviewed grassroots candidate writer. */
export function grassrootsIdentityReviewBlockReason(
  source: { source_type?: string; normalized_role?: string | null; position?: string | null; source_payload?: Record<string, unknown> | null },
  targetRaceType?: string | null,
) {
  const message = '基層候選人請使用官方候選審核流程，保存姓名；只有核對成功的較高層級人物才能連結。';
  const payload = source.source_payload ?? {};
  const hints = [source.position, source.normalized_role, payload.kind, payload.position, payload.normalizedRole, payload.race_type, payload.raceType, (payload.race as Record<string, unknown> | undefined)?.race_type, (payload.targetRace as Record<string, unknown> | undefined)?.race_type].filter(value => typeof value === 'string').join(' ');
  const grassroots = /村里長|村長|里長|(?:鄉|鎮|市)(?:鎮市)?民?代表|village[-_]chief|township[-_]representative/i;
  if (grassroots.test(hints) || (targetRaceType && grassroots.test(targetRaceType))) return message;
  if (targetRaceType !== undefined) {
    const higher = new Set(['president', 'vice_president', 'legislator', 'party_list_legislator', 'municipality_mayor', 'county_mayor', 'city_councilor', 'county_councilor', 'township_mayor', 'legislative_district', 'councilor_district', 'local_chief', 'indigenous']);
    if (!targetRaceType || !higher.has(targetRaceType)) return '候選職類尚未確認，請使用官方候選審核流程。';
  } else if (source.source_type === 'official_election' && !/總統|立法委員|立委|議員|縣長|市長|鄉長|鎮長|鄉鎮市長/.test(hints)) {
    return '選舉來源職類尚未確認，請使用官方候選審核流程。';
  }
  return null;
}
