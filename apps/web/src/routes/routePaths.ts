export function homePath() {
  return '/';
}

export function regionPath(regionId: string) {
  return `/regions/${regionId}`;
}

export function electionPath(electionId: string) {
  return `/elections/${electionId}`;
}
