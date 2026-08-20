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
