import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function lastSuccessfulSources(previous) {
  return previous?.lastSuccessfulSources ?? previous?.sources ?? [];
}

export function compareSourceDiscoveries(current, previous = null) {
  const previousSources = new Map(lastSuccessfulSources(previous).map((source) => [source.key, source]));
  return current.map((source) => {
    const candidate = previousSources.get(source.key);
    const before = candidate && (!source.requestedUrl || !candidate.requestedUrl
      || source.requestedUrl === candidate.requestedUrl) ? candidate : null;
    const beforeUrls = new Set((before?.discoveries ?? []).map((item) => item.url));
    const currentUrls = new Set(source.discoveries.map((item) => item.url));
    return {
      ...source,
      baseline: before == null,
      changed: before != null && before.contentHash !== source.contentHash,
      newDiscoveries: before == null ? [] : source.discoveries.filter((item) => !beforeUrls.has(item.url)),
      removedDiscoveries: before == null ? [] : (before.discoveries ?? []).filter((item) => !currentUrls.has(item.url)),
    };
  });
}

export function monitorState(configuredSources, sources, errors, previous, attemptedAt) {
  const good = new Map(lastSuccessfulSources(previous).map((source) => [source.key, source]));
  const fresh = new Map(sources.map((source) => [source.key, source]));
  const failures = new Map(errors.map((error) => [error.key, error.message]));
  return {
    lastSuccessfulSources: configuredSources.flatMap((configured) => {
      const source = fresh.get(configured.key);
      if (source) {
        const { baseline, changed, newDiscoveries, removedDiscoveries, ...snapshot } = source;
        return [{ ...snapshot, lastSuccessAt: attemptedAt }];
      }
      const retained = good.get(configured.key);
      // A reused key with a new URL must not inherit an unrelated baseline.
      return retained && (!retained.requestedUrl || retained.requestedUrl === configured.url) ? [retained] : [];
    }),
    latestAttempts: configuredSources.map((source) => ({
      key: source.key,
      requestedUrl: source.url,
      attemptedAt,
      status: fresh.has(source.key) ? 'ok' : 'failed',
      ...(failures.has(source.key) ? { error: failures.get(source.key) } : {}),
    })),
  };
}

export function writeMonitorReport(outputPath, report) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`);
    fs.renameSync(temporary, outputPath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}
