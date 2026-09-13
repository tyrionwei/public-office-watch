// Feedback administration must never bridge the local and hosted databases.
export function feedbackEnvironmentMatches(siteOrigin: string, databaseUrl: string): boolean {
  try {
    const site = new URL(siteOrigin); const database = new URL(databaseUrl);
    const loopback = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host);
    if (loopback(site.hostname)) return loopback(database.hostname) && ['http:', 'https:'].includes(database.protocol);
    return site.protocol === 'https:' && database.protocol === 'https:' && !loopback(database.hostname);
  } catch { return false; }
}
