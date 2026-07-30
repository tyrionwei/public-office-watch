import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { renderHistoricalElectionRaceSql } from './build-historical-cec-election-race-migration.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultReportPath = path.join(repoRoot, 'local-data', 'historical-cec-existing-candidate-coverage.json');
const defaultPlanPath = path.join(repoRoot, 'local-data', 'historical-cec-missing-race-plan.json');
const defaultSqlPath = path.join(repoRoot, 'local-data', 'historical-cec-missing-race-dry-run.sql');

function parseArgs(argv) {
  const options = {
    reportPath: defaultReportPath,
    planPath: defaultPlanPath,
    sqlPath: defaultSqlPath,
    migrationPath: null,
    write: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') options.write = true;
    else if (arg === '--report') options.reportPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--plan') options.planPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--sql') options.sqlPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--migration') options.migrationPath = path.resolve(argv[++index] ?? '');
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  return options;
}

function raceExternalId(key) {
  const suffix = crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
  return `cec-historical-race-${suffix}`;
}

export function buildHistoricalCecMissingRacePlan(report) {
  const contexts = report.missingRaceContexts ?? [];
  const expectedSourceRows = Number(report.categoryCounts?.missing_race_context ?? 0);
  const coveredSourceRows = contexts.reduce((sum, context) => sum + Number(context.sourceRowCount ?? 0), 0);

  if (expectedSourceRows !== coveredSourceRows) {
    throw new Error(`Missing race source count mismatch: expected ${expectedSourceRows}, got ${coveredSourceRows}`);
  }

  const createRaces = contexts.map((context) => {
    if (context.racePlanAction !== 'create_new') {
      throw new Error(`Missing race context is not a create_new plan: ${context.key}`);
    }
    if (context.eventPlanAction !== 'reuse_existing' || !context.eventExternalId) {
      throw new Error(`Missing race context lacks one reusable election: ${context.key}`);
    }
    if (context.regionScope === 'local' && !context.regionExternalId) {
      throw new Error(`Missing race context lacks a canonical region: ${context.key}`);
    }
    if (!['local', 'national'].includes(context.regionScope) || !context.raceTitle || !context.raceType) {
      throw new Error(`Missing race context is incomplete: ${context.key}`);
    }
    if (!Number.isInteger(context.sourceRowCount) || context.sourceRowCount <= 0) {
      throw new Error(`Missing race context has invalid source count: ${context.key}`);
    }
    return {
      externalId: raceExternalId(context.key),
      contextKey: context.key,
      eventExternalId: context.eventExternalId,
      regionExternalId: context.regionScope === 'local' ? context.regionExternalId : null,
      title: context.raceTitle,
      raceType: context.raceType,
    };
  });

  if (new Set(createRaces.map((race) => race.contextKey)).size !== createRaces.length) {
    throw new Error('Duplicate missing race context key');
  }
  if (new Set(createRaces.map((race) => race.externalId)).size !== createRaces.length) {
    throw new Error('Duplicate proposed missing race external_id');
  }

  return {
    source: report.source,
    policy: {
      databaseWrites: false,
      transaction: 'ROLLBACK',
      newRecordsPublic: false,
      candidateWrites: false,
      scope: 'Only race contexts required by already matched historical CEC sources.',
    },
    summary: {
      createRegions: 0,
      createEvents: 0,
      normalizeEvents: 0,
      createRaces: createRaces.length,
      normalizeRaces: 0,
      coveredSourceRows,
    },
    createRegions: [],
    createEvents: [],
    normalizeEvents: [],
    createRaces,
    normalizeRaces: [],
  };
}

export function renderHistoricalCecMissingRaceSql(plan, options = {}) {
  return renderHistoricalElectionRaceSql(plan, options);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.reportPath)) {
    throw new Error('Run report:historical-cec-candidate-coverage -- --write first.');
  }

  const report = JSON.parse(fs.readFileSync(options.reportPath, 'utf8'));
  const plan = buildHistoricalCecMissingRacePlan(report);
  const sql = renderHistoricalCecMissingRaceSql(plan);

  if (options.write) {
    fs.mkdirSync(path.dirname(options.planPath), { recursive: true });
    fs.mkdirSync(path.dirname(options.sqlPath), { recursive: true });
    fs.writeFileSync(options.planPath, `${JSON.stringify(plan, null, 2)}\n`);
    fs.writeFileSync(options.sqlPath, sql);
  }
  if (options.migrationPath) {
    fs.mkdirSync(path.dirname(options.migrationPath), { recursive: true });
    fs.writeFileSync(options.migrationPath, renderHistoricalCecMissingRaceSql(plan, { rollback: false }));
  }

  console.log(JSON.stringify({
    outputPlan: options.write ? path.relative(repoRoot, options.planPath) : null,
    outputSql: options.write ? path.relative(repoRoot, options.sqlPath) : null,
    outputMigration: options.migrationPath ? path.relative(repoRoot, options.migrationPath) : null,
    ...plan.summary,
  }, null, 2));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(`historical CEC missing race build failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  });
}
