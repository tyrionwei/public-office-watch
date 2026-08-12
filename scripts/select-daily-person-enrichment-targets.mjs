import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const options = {
    inputPath: null,
    outputPath: path.resolve('tmp/daily-person-enrichment-targets.json'),
    statePath: path.resolve('tmp/daily-person-enrichment-state.json'),
    recordInputPath: null,
    skipInputPath: null,
    progressInputPath: null,
    limit: 25,
    cooldownDays: 30,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') options.inputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--state') options.statePath = path.resolve(argv[++index] ?? '');
    else if (arg === '--record-input') options.recordInputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--skip-input') options.skipInputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--progress-input') options.progressInputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--limit') options.limit = Number.parseInt(argv[++index] ?? '', 10);
    else if (arg === '--cooldown-days') options.cooldownDays = Number.parseInt(argv[++index] ?? '', 10);
    else throw new Error(`Unsupported argument: ${arg}`);
  }

  if (!Number.isInteger(options.limit) || options.limit <= 0) throw new Error('--limit must be a positive integer');
  if (!Number.isInteger(options.cooldownDays) || options.cooldownDays < 0) throw new Error('--cooldown-days must be zero or a positive integer');
  if (!options.recordInputPath && !options.inputPath) throw new Error('Provide --input or --record-input');
  return options;
}

function readTargets(filePath) {
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const records = Array.isArray(payload) ? payload : payload.targets ?? payload.skippedTargets;
  if (!Array.isArray(records)) throw new Error('Target file must contain targets or skippedTargets');
  return records
    .map((record) => record?.target ?? record)
    .filter((target) => target?.personId && target?.name);
}

function readState(filePath) {
  if (!fs.existsSync(filePath)) return { schemaVersion: 1, attempts: {} };
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return {
    schemaVersion: payload?.schemaVersion ?? 1,
    attempts: payload?.attempts && typeof payload.attempts === 'object' ? payload.attempts : {},
    lastBatch: payload?.lastBatch ?? null,
  };
}

function selectDailyTargets(targets, state, now = new Date(), limit = 25, cooldownDays = 30) {
  const cutoff = now.getTime() - (cooldownDays * 24 * 60 * 60 * 1000);
  const seen = new Set();
  const uniqueTargets = targets.filter((target) => {
    if (!target?.personId || seen.has(target.personId)) return false;
    seen.add(target.personId);
    return true;
  });
  const untouched = uniqueTargets.filter((target) => !state?.attempts?.[target.personId]);
  const retryable = uniqueTargets.filter((target) => {
    if (!state?.attempts?.[target.personId]) return false;
    const attemptedAt = Date.parse(state?.attempts?.[target.personId]?.attemptedAt ?? '');
    return !Number.isFinite(attemptedAt) || attemptedAt <= cutoff;
  });
  return [...untouched, ...retryable].slice(0, limit);
}

function readProgressResults(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(payload?.lastResults) ? payload.lastResults : [];
}

function skippedResultStatus(record) {
  const reason = String(record?.reason ?? '');
  if ((record?.identityCandidates?.length ?? 0) > 0
      || reason === 'no confident Wikidata entity match'
      || reason === 'Wikidata identity candidates require downstream review') {
    return 'identity_review_required';
  }
  if (reason === 'no matching Wikidata identity candidate found') return 'no_candidate_found';
  return 'source_error';
}

function readSkippedResults(filePath, targets) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const skippedByPersonId = new Map((payload?.skippedTargets ?? [])
    .map((record) => ({ ...record, target: record?.target ?? record, reason: record?.reason ?? null }))
    .filter((record) => record.target?.personId)
    .map((record) => [record.target.personId, record]));
  return targets.map((target) => {
    const skipped = skippedByPersonId.get(target.personId);
    if (!skipped) return { personId: target.personId, name: target.name, status: 'matched_no_claims', claimCount: 0, reason: null };
    return {
      personId: target.personId,
      name: target.name,
      status: skippedResultStatus(skipped),
      claimCount: 0,
      reason: skipped.reason,
    };
  });
}

function recordDailyTargets(state, targets, now = new Date(), results = []) {
  const attemptedAt = now.toISOString();
  const attempts = { ...(state?.attempts ?? {}) };
  const resultsByPersonId = new Map(results.map((result) => [result.personId, result]));
  for (const target of targets) {
    const result = resultsByPersonId.get(target.personId);
    attempts[target.personId] = {
      name: target.name,
      attemptedAt,
      missingSignals: Array.isArray(target.missingSignals) ? target.missingSignals : [],
      researchSignals: Array.isArray(target.researchSignals) ? target.researchSignals : [],
      outcome: result?.status ?? 'attempted',
      claimCount: Number(result?.claimCount ?? 0),
      reason: result?.reason ?? null,
    };
  }
  return {
    schemaVersion: 2,
    updatedAt: attemptedAt,
    lastBatch: {
      attemptedAt,
      targetCount: targets.length,
      firstPersonId: targets[0]?.personId ?? null,
      firstPersonName: targets[0]?.name ?? null,
      lastPersonId: targets.at(-1)?.personId ?? null,
      lastPersonName: targets.at(-1)?.name ?? null,
      results: targets.map((target) => {
        const result = resultsByPersonId.get(target.personId);
        return {
          personId: target.personId,
          name: target.name,
          outcome: result?.status ?? 'attempted',
          claimCount: Number(result?.claimCount ?? 0),
          reason: result?.reason ?? null,
        };
      }),
    },
    attempts,
  };
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const state = readState(options.statePath);

  if (options.recordInputPath) {
    const targets = readTargets(options.recordInputPath);
    const progressResults = readProgressResults(options.progressInputPath);
    const results = progressResults.length > 0 ? progressResults : readSkippedResults(options.skipInputPath, targets);
    const nextState = recordDailyTargets(state, targets, new Date(), results);
    writeJson(options.statePath, nextState);
    console.log(JSON.stringify({
      status: 'recorded',
      targetCount: targets.length,
      firstPersonName: nextState.lastBatch.firstPersonName,
      lastPersonName: nextState.lastBatch.lastPersonName,
      outcomeCounts: nextState.lastBatch.results.reduce((counts, result) => {
        counts[result.outcome] = (counts[result.outcome] ?? 0) + 1;
        return counts;
      }, {}),
      statePath: options.statePath,
    }, null, 2));
    return;
  }

  const targets = selectDailyTargets(readTargets(options.inputPath), state, new Date(), options.limit, options.cooldownDays);
  const output = {
    schemaVersion: 1,
    name: 'daily-person-enrichment-targets',
    generatedAt: new Date().toISOString(),
    targetCount: targets.length,
    targets,
  };
  writeJson(options.outputPath, output);
  console.log(JSON.stringify({
    status: 'written',
    targetCount: targets.length,
    outputPath: options.outputPath,
    targets: targets.map(({ personId, name, priorityGroup, missingSignals, researchSignals }) => ({ personId, name, priorityGroup, missingSignals, researchSignals })),
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export { parseArgs, recordDailyTargets, selectDailyTargets, skippedResultStatus };
