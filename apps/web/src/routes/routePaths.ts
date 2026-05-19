export function homePath() {
  return '/';
}

export function regionPath(regionId: string) {
  return `/regions/${regionId}`;
}

export function electionPath(electionId: string) {
  return `/elections/${electionId}`;
}

export function partiesPath() {
  return '/parties';
}

export function partyPath(partySlug: string) {
  return `/parties/${partySlug}`;
}

export function dataGuidancePath() {
  return '/data-guidance';
}

export function aboutPath() {
  return '/about';
}
