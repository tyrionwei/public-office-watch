import type { PublicCandidate } from '../types/publicViews';

export type HomeCandidateOfficeTitle = {
  kind: 'current' | 'former';
  label: string;
};

type CandidateOfficeFields = Pick<PublicCandidate, 'current_office_label' | 'former_office_label'>;

const candidacyOnlyPattern = /候選人|參選|擬參選|candidate/iu;
const formerPrefixPattern = /^(?:曾任|前任|卸任)\s*/u;

function cleanOfficeLabel(value: string | null | undefined) {
  const label = value?.trim();
  if (!label || candidacyOnlyPattern.test(label)) return null;
  return label;
}

export function getHomeCandidateOfficeTitle(candidate: CandidateOfficeFields): HomeCandidateOfficeTitle | null {
  const currentOffice = cleanOfficeLabel(candidate.current_office_label);
  if (currentOffice) {
    return { kind: 'current', label: currentOffice };
  }

  const formerOffice = cleanOfficeLabel(candidate.former_office_label);
  if (!formerOffice) return null;

  const label = formerOffice.replace(formerPrefixPattern, '').trim();
  if (!label) return null;

  return { kind: 'former', label };
}
