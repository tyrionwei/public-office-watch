import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const defaultTargetsPath = path.resolve('data-sources/votetw-person-enrichment.targets.json');
const defaultBatchDir = path.resolve('data-sources/votetw-person-enrichment-batches');
const defaultOutputPath = path.resolve('data-sources/votetw-person-enrichment-claims.seed.json');
const importerPath = path.resolve('scripts/fetch-votetw-person-enrichment.mjs');

function parseArgs(argv) {
  const args = {
    targetsPath: defaultTargetsPath,
    batchDir: defaultBatchDir,
    outputPath: defaultOutputPath,
    batchSize: 250,
    offset: 0,
    limit: null,
    requestDelayMs: 250,
    skipFetchErrors: true,
    force: false,
    mergeOnly: false,
    allowPartial: false,
    mergeExisting: false,
    cacheOnly: false,
    verbose: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--target-names') {
      args.targetsPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
    } else if (arg === '--batch-dir') {
      args.batchDir = path.resolve(argv[index + 1] ?? '');
      index += 1;
    } else if (arg === '--output') {
      args.outputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
    } else if (arg === '--batch-size') {
      args.batchSize = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
    } else if (arg === '--offset') {
      args.offset = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
    } else if (arg === '--limit') {
      args.limit = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
    } else if (arg === '--request-delay-ms') {
      args.requestDelayMs = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
    } else if (arg === '--strict-fetch-errors') {
      args.skipFetchErrors = false;
    } else if (arg === '--force') {
      args.force = true;
    } else if (arg === '--merge-only') {
      args.mergeOnly = true;
    } else if (arg === '--allow-partial') {
      args.allowPartial = true;
    } else if (arg === '--merge-existing') {
      args.mergeExisting = true;
    } else if (arg === '--cache-only') {
      args.cacheOnly = true;
    } else if (arg === '--verbose') {
      args.verbose = true;
    } else {
      throw new Error(`Unsupported argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.batchSize) || args.batchSize <= 0) throw new Error('--batch-size must be a positive number.');
  if (!Number.isFinite(args.offset) || args.offset < 0) throw new Error('--offset must be zero or a positive number.');
  if (args.limit !== null && (!Number.isFinite(args.limit) || args.limit <= 0)) throw new Error('--limit must be a positive number.');
  if (!Number.isFinite(args.requestDelayMs) || args.requestDelayMs < 0) throw new Error('--request-delay-ms must be zero or a positive number.');
  return args;
}

function loadTargetCount(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const records = Array.isArray(parsed) ? parsed : parsed.targets ?? parsed.people ?? parsed.names ?? parsed.records;
  if (!Array.isArray(records)) throw new Error('Target names file must be a JSON array or an object with targets/people/names/records.');
  return records.length;
}

function batchPath(batchDir, offset) {
  return path.join(batchDir, `batch-${String(offset).padStart(5, '0')}.seed.json`);
}

function existingBatchOffsets(batchDir) {
  if (!fs.existsSync(batchDir)) return [];
  return fs.readdirSync(batchDir)
    .map((fileName) => fileName.match(/^batch-(\d+)\.seed\.json$/)?.[1])
    .filter(Boolean)
    .map((offset) => Number.parseInt(offset, 10))
    .filter((offset) => Number.isFinite(offset))
    .sort((a, b) => a - b);
}

function targetEnd(args, targetCount) {
  return args.limit === null ? targetCount : Math.min(targetCount, args.offset + args.limit);
}

function expectedOffsets(args, targetCount) {
  const offsets = [];
  for (let offset = args.offset; offset < targetEnd(args, targetCount); offset += args.batchSize) offsets.push(offset);
  return offsets;
}

function runBatch(args, offset, maxPeople) {
  const outputPath = batchPath(args.batchDir, offset);
  if (!args.force && fs.existsSync(outputPath)) {
    console.error(`[skip] ${path.relative(process.cwd(), outputPath)}`);
    return;
  }

  const commandArgs = [
    importerPath,
    '--target-names',
    args.targetsPath,
    '--offset',
    String(offset),
    '--max-people',
    String(maxPeople),
    '--output',
    outputPath,
    '--request-delay-ms',
    String(args.requestDelayMs),
  ];
  if (args.skipFetchErrors) commandArgs.push('--skip-fetch-errors');
  if (args.cacheOnly) commandArgs.push('--cache-only');
  if (args.verbose) commandArgs.push('--verbose');

  console.error(`[run] offset=${offset} maxPeople=${maxPeople}`);
  const result = spawnSync(process.execPath, commandArgs, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Batch failed at offset ${offset} with exit code ${result.status ?? 'unknown'}.`);
}

function pushUnique(map, key, value) {
  if (!map.has(key)) map.set(key, value);
}

function mergeBatches(args, offsets) {
  const rawSourcesByKey = new Map();
  const claimsByKey = new Map();
  const skippedTargets = [];
  const batchSummaries = [];
  let targetCount = 0;
  let sourceRecord = null;

  for (const offset of offsets) {
    const filePath = batchPath(args.batchDir, offset);
    if (!fs.existsSync(filePath)) {
      if (args.allowPartial) continue;
      throw new Error(`Missing batch file: ${filePath}`);
    }

    const batch = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    targetCount += batch.summary?.targetCount ?? 0;
    sourceRecord ??= batch.sources?.[0] ?? null;
    batchSummaries.push({ offset, path: path.relative(process.cwd(), filePath), summary: batch.summary });

    for (const rawSource of batch.rawSources ?? []) {
      pushUnique(rawSourcesByKey, `${rawSource.pageid}:${rawSource.lastrevid}:${rawSource.rawPath ?? rawSource.sourceUrl}`, rawSource);
    }
    for (const claim of batch.personClaims ?? []) pushUnique(claimsByKey, claim.claimKey, claim);
    skippedTargets.push(...(batch.skippedTargets ?? []));
  }

  const rawSources = Array.from(rawSourcesByKey.values());
  const personClaims = Array.from(claimsByKey.values());
  const seed = {
    schemaVersion: 1,
    name: 'votetw-person-enrichment-claims',
    sourceId: 'votetw-person-enrichment',
    generatedAt: new Date().toISOString(),
    summary: {
      targetCount,
      rawSourceCount: rawSources.length,
      claimCount: personClaims.length,
      skippedCount: skippedTargets.length,
      legalClaimCount: personClaims.filter((claim) => claim.claimType === 'legal_case').length,
      platformClaimCount: personClaims.filter((claim) => claim.claimType === 'platform').length,
      batchCount: batchSummaries.length,
    },
    sources: sourceRecord ? [sourceRecord] : [],
    batchSummaries,
    rawSources,
    skippedTargets,
    personClaims,
  };

  fs.mkdirSync(path.dirname(args.outputPath), { recursive: true });
  fs.writeFileSync(args.outputPath, `${JSON.stringify(seed, null, 2)}\n`);
  console.log(JSON.stringify(seed.summary, null, 2));
  console.log(`Wrote ${args.outputPath}`);
}

function main() {
  const args = parseArgs(process.argv);
  const targetCount = loadTargetCount(args.targetsPath);
  const offsets = expectedOffsets(args, targetCount);
  fs.mkdirSync(args.batchDir, { recursive: true });

  if (!args.mergeOnly) {
    const end = targetEnd(args, targetCount);
    for (const offset of offsets) {
      const maxPeople = Math.min(args.batchSize, end - offset);
      runBatch(args, offset, maxPeople);
    }
  }

  mergeBatches(args, args.mergeExisting ? existingBatchOffsets(args.batchDir) : offsets);
}

main();
