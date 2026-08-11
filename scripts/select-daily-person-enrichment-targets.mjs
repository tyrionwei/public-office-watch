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
    schemaVersion: 1,
    attempts: payload?.attempts && typeof payload.attempts === 'object' ? payload.attempts : {},
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

function recordDailyTargets(state, targets, now = new Date()) {
  const attemptedAt = now.toISOString();
  const attempts = { ...(state?.attempts ?? {}) };
  for (const target of targets) {
    attempts[target.personId] = {
      name: target.name,
      attemptedAt,
      missingSignals: Array.isArray(target.missingSignals) ? target.missingSignals : [],
    };
  }
  return { schemaVersion: 1, updatedAt: attemptedAt, attempts };
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const state = readState(options.statePath);

  if (options.recordInputPath) {
    const skippedIds = new Set(options.skipInputPath && fs.existsSync(options.skipInputPath)
      ? readTargets(options.skipInputPath).map((target) => target.personId)
      : []);
    const targets = readTargets(options.recordInputPath).filter((target) => !skippedIds.has(target.personId));
    writeJson(options.statePath, recordDailyTargets(state, targets));
    console.log(JSON.stringify({ status: 'recorded', targetCount: targets.length, skippedCount: skippedIds.size, statePath: options.statePath }, null, 2));
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
    targets: targets.map(({ personId, name, priorityGroup, missingSignals }) => ({ personId, name, priorityGroup, missingSignals })),
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

export { parseArgs, recordDailyTargets, selectDailyTargets };
