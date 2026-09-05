import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseLastJsonOutput, resultNeedsAttention } from './run-daily-monitor.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dailyProducers = {
  'daily-person-news.json': ['generalNews', 'discover:daily-person-news'],
  'daily-person-research-news.json': ['researchNews', 'run:daily-person-enrichment'],
  'daily-person-research-queue.json': ['researchQueue', 'run:daily-person-enrichment'],
  'daily-person-enrichment-targets.json': ['researchQueue', 'run:daily-person-enrichment'],
  'daily-person-enrichment-claims.json': ['wikidata', 'run:daily-person-enrichment'],
  'daily-person-enrichment-skipped.json': ['wikidata', 'run:daily-person-enrichment'],
  'daily-person-enrichment-progress.json': ['wikidata', 'run:daily-person-enrichment'],
  'daily-person-enrichment-state.json': ['wikidata', 'run:daily-person-enrichment'],
  'cec-election-announcements.json': ['cec', 'monitor:cec-election-sources'],
};
const weeklyProducers = {
  'cec-candidate-sources.json': 'cec-candidate-sources',
  'cec-election-announcements.json': 'cec-election-announcements',
  'cec-referendum-sources.json': 'cec-referendum-sources',
  'weekly-person-news.json': 'weekly-person-news',
  'person-data-quality.json': 'person-data-quality',
  'party-candidate-freshness.json': 'party-candidate-freshness',
  'dpp-mayors.json': 'party-dpp-mayors',
  'dpp-councilors.json': 'party-dpp-councilors',
  'kmt.json': 'party-kmt',
  'pfp.json': 'party-pfp',
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function normalizeSteps(value) {
  if (Array.isArray(value)) return value;
  return value && typeof value === 'object'
    ? Object.entries(value).map(([name, step]) => ({ name, ...step }))
    : [];
}

function timestampBelongsToRun(value, started, archived) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= started && timestamp <= archived;
}

function readVerifiedFile(root, runDir, entry, archived) {
  const file = fs.realpathSync(path.resolve(root, archived ? entry.archivePath : entry.path));
  const relative = path.relative(fs.realpathSync(runDir), file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('File escapes run directory');
  const bytes = fs.readFileSync(file);
  if (bytes.length !== entry.size || sha256(bytes) !== entry.sha256) throw new Error('Size or SHA-256 mismatch');
  return bytes.toString('utf8');
}

// Read-only eligibility, not semantic review, approval, ingestion or publication.
export function planMonitorReview(runDir, { root = repoRoot, now = Date.now() } = {}) {
  runDir = path.resolve(runDir);
  const summaryBytes = fs.readFileSync(path.join(runDir, 'summary.json'));
  const manifestBytes = fs.readFileSync(path.join(runDir, 'manifest.json'));
  const summary = JSON.parse(summaryBytes);
  const manifest = JSON.parse(manifestBytes);
  const result = { runId: summary.runId, status: 'blocked', reviewCompleted: false,
    inputHashes: { summary: sha256(summaryBytes), manifest: sha256(manifestBytes) },
    eligibleArtifacts: [], blockedArtifacts: [], blockedSteps: [], errors: [], warnings: [] };
  if (!summary.runId || summary.runId !== manifest.runId || summary.runId !== path.basename(runDir)) result.errors.push('runId mismatch');
  const started = Date.parse(summary.startedAt);
  const finished = Date.parse(summary.finishedAt);
  const archived = Date.parse(summary.archivedAt ?? summary.finishedAt);
  const maxAge = (summary.kind === 'weekly' ? 14 : 7) * 86400_000;
  if (![started, finished, archived].every(Number.isFinite) || started > finished || finished > archived
    || archived > now + 60_000 || now - finished > maxAge || summary.status === 'running') result.errors.push('Run incomplete or time window invalid/stale');
  if (!['daily', 'weekly'].includes(summary.kind)) result.errors.push('Unknown run kind');
  if (!Array.isArray(manifest.artifacts) || manifest.artifactCount !== manifest.artifacts.length
    || summary.artifactCount !== manifest.artifacts.length) result.errors.push('Final manifest/summary artifact count mismatch');
  const steps = normalizeSteps(summary.steps);
  const findStep = (name) => steps.find((step) => (step.name ?? step.scriptName) === name);
  result.blockedSteps = steps.filter((step) => resultNeedsAttention(step) || resultNeedsAttention(step.result))
    .map((step) => ({ name: step.name ?? step.scriptName, status: step.status, reason: step.error ?? step.reason ?? step.blocker ?? null }));
  const environmentStep = findStep('environment');
  if (!environmentStep || environmentStep.status !== 'ok') result.errors.push('Environment preflight evidence is missing or failed');

  const logResults = [];
  if (!manifest.logs?.length) result.errors.push('No hashed logs; provenance needs manual reconstruction');
  for (const log of manifest.logs ?? []) {
    try {
      if (!timestampBelongsToRun(log.mtime, started, archived)) throw new Error('Log mtime is outside this run');
      const parsed = parseLastJsonOutput(readVerifiedFile(root, runDir, log, false));
      if (!parsed) continue;
      if (parsed.runId && parsed.runId !== summary.runId) throw new Error('Log runId does not match this run');
      for (const key of ['startedAt', 'finishedAt', 'generatedAt', 'checkedAt', 'fetchedAt']) {
        if (parsed[key] && !timestampBelongsToRun(parsed[key], started, archived)) {
          throw new Error('Log ' + key + ' is outside this run');
        }
      }
      for (const step of normalizeSteps(parsed.steps)) {
        if (step.runId && step.runId !== summary.runId) throw new Error('Log step runId does not match this run');
        if (step.startedAt && !timestampBelongsToRun(step.startedAt, started, archived)) throw new Error('Log step startedAt is outside this run');
        if (step.finishedAt && !timestampBelongsToRun(step.finishedAt, started, archived)) throw new Error('Log step finishedAt is outside this run');
      }
      logResults.push(parsed);
    } catch (error) { result.errors.push('Log: ' + error.message); }
  }
  const terminalSteps = logResults.flatMap((log) => {
    const nested = normalizeSteps(log.steps);
    return nested.length ? nested : log.scriptName || log.name ? [log] : [];
  });
  if (result.errors.length) return result;
  const seen = new Set();
  for (const entry of manifest.artifacts) {
    const item = {
      path: entry.path,
      archivePath: entry.archivePath,
      sha256: entry.sha256,
      dependencies: Array.isArray(entry.dependencies) ? entry.dependencies : [],
    };
    try {
      if (seen.has(entry.archivePath) || seen.has(entry.path)) throw new Error('Duplicate manifest entry');
      if (entry.dependencies != null && !Array.isArray(entry.dependencies)) throw new Error('Malformed artifact dependencies');
      seen.add(entry.archivePath);
      seen.add(entry.path);
      const payload = JSON.parse(readVerifiedFile(root, runDir, entry, true));
      const mtime = Date.parse(entry.mtime);
      if (!Number.isFinite(mtime) || mtime < started || mtime > archived) throw new Error('Artifact outside run time window');
      const name = path.basename(entry.path);
      const mapping = dailyProducers[name];
      const producer = entry.producerStep ?? (summary.kind === 'daily' ? mapping?.[0] : weeklyProducers[name]);
      const parent = entry.commandStep ?? (summary.kind === 'daily' ? mapping?.[1] : producer);
      item.producerStep = producer ?? null;
      const declared = findStep(producer) ?? findStep(parent);
      const logged = terminalSteps.find((step) => (step.scriptName ?? step.name) === parent);
      if (!producer || !declared || !logged) throw new Error('Missing producer/log evidence; manual verification required');
      if (!timestampBelongsToRun(logged.startedAt, started, archived)
        || !timestampBelongsToRun(logged.finishedAt, started, archived)
        || Date.parse(logged.startedAt) > Date.parse(logged.finishedAt)) {
        throw new Error('Producer log is not tied to this run time window');
      }
      if (declared.status !== 'ok' || resultNeedsAttention(declared) || resultNeedsAttention(declared.result)
        || logged.status !== 'ok' || logged.exitCode !== 0 || resultNeedsAttention(logged)
        || resultNeedsAttention(logged.result)) throw new Error('Producer failed/degraded or log disagrees');
      if (resultNeedsAttention(payload)) throw new Error('Artifact reports partial/failed collection; isolate successful rows with evidence first');
      // A plan does not treat metadata files or raw hit counts as new facts.
      result.eligibleArtifacts.push(item);
    } catch (error) {
      result.blockedArtifacts.push({ ...item, reason: error.message });
    }
  }
  let dependencyChanged = true;
  while (dependencyChanged) {
    dependencyChanged = false;
    const eligiblePaths = new Set(result.eligibleArtifacts.map((item) => item.path));
    for (const item of [...result.eligibleArtifacts]) {
      const blockedDependency = item.dependencies.find((dependency) => !eligiblePaths.has(dependency));
      if (!blockedDependency) continue;
      result.eligibleArtifacts = result.eligibleArtifacts.filter((candidate) => candidate !== item);
      result.blockedArtifacts.push({
        ...item,
        reason: 'Dependency is missing or blocked: ' + blockedDependency,
      });
      dependencyChanged = true;
    }
  }

  if (fs.existsSync(path.join(runDir, 'command-result.json'))) {
    const command = JSON.parse(fs.readFileSync(path.join(runDir, 'command-result.json'), 'utf8'));
    if (command.artifactCount !== manifest.artifactCount) result.warnings.push('Command-stage count differs from final manifest; supplemental artifacts need their own provenance, not a rewritten command log');
  }
  result.status = result.eligibleArtifacts.length ? result.blockedArtifacts.length || result.blockedSteps.length ? 'partial_reviewable' : 'reviewable' : 'blocked';
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3) throw new Error('Usage: node scripts/plan-monitor-review.mjs <archived-run-directory>');
  console.log(JSON.stringify(planMonitorReview(process.argv[2]), null, 2));
}
