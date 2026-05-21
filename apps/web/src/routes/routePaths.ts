export function homePath() {
  return '/';
}

export function regionPath(regionId: string) {
  return `/regions/${regionId}`;
}

export function electionPath(electionId: string) {
  return `/elections/${electionId}`;
}

export function peoplePath(searchParams?: URLSearchParams | Record<string, string | null | undefined>) {
  if (!searchParams) {
    return '/people';
  }

  const params = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams();

  if (!(searchParams instanceof URLSearchParams)) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
  }

  const query = params.toString();
  return query ? `/people?${query}` : '/people';
}

export function personPath(personId: string) {
  return `/people/${personId}`;
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
