import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const taiwanForwardSlugs = [
  'new-power-party',
  'taiwan-statebuilding-party',
  'obasan-alliance',
  'green-party-taiwan',
];

function parseArgs(argv) {
  const options = { outputDir: path.join(repoRoot, 'tmp', 'weekly-monitor') };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output-dir') options.outputDir = path.resolve(argv[++index] ?? '');
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  return options;
}

function parseJsonOutput(stdout) {
  const text = String(stdout ?? '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function compactStepResult(payload) {
  if (payload == null) return null;
  const serialized = JSON.stringify(payload);
  if (serialized.length <= 12_000) return payload;
  const metricKeys = [
    'watchlistCount',
    'fetchedArticleCount',
    'leadCount',
    'eventGroupCount',
    'newLeadCount',
    'categoryCount',
    'sourceCount',
    'changedSourceCount',
    'newDiscoveryCount',
    'recordCount',
    'candidateCount',
    'blockingIssueCount',
  ];
  return {
    status: payload.status ?? null,
    summary: payload.summary ?? null,
    counts: payload.counts ?? payload.totals ?? null,
    metrics: Object.fromEntries(metricKeys.filter((key) => payload[key] != null).map((key) => [key, payload[key]])),
    detailStoredInStepLog: true,
  };
}

function runNodeStep(name, args, outputDir) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      resolve({ name, status: 'failed', exitCode: null, durationMs: Date.now() - startedAt, error: error.message });
    });
    child.on('close', (exitCode) => {
      const logsDir = path.join(outputDir, 'logs');
      fs.mkdirSync(logsDir, { recursive: true });
      fs.writeFileSync(path.join(logsDir, `${name}.log`), `${stdout}${stderr ? `\nSTDERR\n${stderr}` : ''}`);
      resolve({
        name,
        status: exitCode === 0 ? 'ok' : 'failed',
        exitCode,
        durationMs: Date.now() - startedAt,
        result: compactStepResult(parseJsonOutput(stdout)),
        error: exitCode === 0 ? null : stderr.trim() || stdout.trim() || `Exited with ${exitCode}`,
      });
    });
  });
}

function summarizeWeeklyResults(steps) {
  const failed = steps.filter((step) => step.status === 'failed');
  return {
    status: failed.length === 0 ? 'ok' : 'needs_attention',
    stepCount: steps.length,
    passedCount: steps.length - failed.length,
    failedCount: failed.length,
    failedSteps: failed.map((step) => step.name),
  };
}

function previousArgs(filePath) {
  return fs.existsSync(filePath) ? ['--previous', filePath] : [];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  fs.mkdirSync(options.outputDir, { recursive: true });
  const steps = [];
  const run = async (name, args) => {
    const result = await runNodeStep(name, args, options.outputDir);
    steps.push(result);
    return result;
  };

  await run('real-public-data', ['scripts/sync-real-public-data.mjs', '--weekly']);

  const cecReportPath = path.join(options.outputDir, 'cec-candidate-sources.json');
  await run('cec-candidate-sources', [
    'scripts/cec-candidate-source-discovery.mjs',
    ...previousArgs(cecReportPath),
    '--output', cecReportPath,
    '--snapshot-dir', path.join(options.outputDir, 'cec-snapshots'),
  ]);

  const referendumReportPath = path.join(options.outputDir, 'cec-referendum-sources.json');
  await run('cec-referendum-sources', [
    'scripts/cec-referendum-source-monitor.mjs',
    ...previousArgs(referendumReportPath),
    '--output', referendumReportPath,
    '--snapshot-dir', path.join(options.outputDir, 'cec-referendum-snapshots'),
  ]);

  const partyDir = path.join(options.outputDir, 'party-candidates');
  fs.mkdirSync(partyDir, { recursive: true });
  const livePartyInputs = [];
  const partyFetches = [
    ['dpp-mayors', ['scripts/build-dpp-2026-candidate-snapshot.mjs', '--scope', 'mayors', '--output', path.join(partyDir, 'dpp-mayors.json')]],
    ['dpp-councilors', ['scripts/build-dpp-2026-candidate-snapshot.mjs', '--scope', 'councilors', '--output', path.join(partyDir, 'dpp-councilors.json')]],
    ['kmt', ['scripts/build-kmt-2026-candidate-snapshot.mjs', '--output', path.join(partyDir, 'kmt.json')]],
    ['pfp', ['scripts/build-pfp-2026-candidate-snapshot.mjs', '--output', path.join(partyDir, 'pfp.json')]],
  ];
  for (const [name, args] of partyFetches) {
    const result = await run(`party-${name}`, args);
    const outputIndex = args.indexOf('--output') + 1;
    if (result.status === 'ok' && outputIndex > 0) livePartyInputs.push(args[outputIndex]);
  }

  const taiwanForwardDir = path.join(partyDir, 'taiwan-forward');
  const taiwanForward = await run('party-taiwan-forward', [
    'scripts/build-taiwan-forward-2026-candidate-snapshots.mjs',
    '--output-dir', taiwanForwardDir,
    '--capture-output', path.join(partyDir, 'taiwan-forward-capture.html'),
  ]);
  if (taiwanForward.status === 'ok') {
    for (const slug of taiwanForwardSlugs) {
      const filePath = path.join(taiwanForwardDir, `${slug}.json`);
      if (fs.existsSync(filePath)) livePartyInputs.push(filePath);
    }
  }

  const tppSnapshot = path.join(repoRoot, 'data-sources', 'tpp', '2026-election', 'normalized-candidates-2026-07-29.json');
  if (livePartyInputs.length > 0 || fs.existsSync(tppSnapshot)) {
    const freshnessArgs = ['scripts/report-party-candidate-source-freshness.mjs'];
    for (const inputPath of livePartyInputs) freshnessArgs.push('--input', inputPath);
    if (fs.existsSync(tppSnapshot)) freshnessArgs.push('--browser-input', tppSnapshot);
    freshnessArgs.push('--output', path.join(options.outputDir, 'party-candidate-freshness.json'));
    await run('party-candidate-freshness', freshnessArgs);
  }

  const newsReportPath = path.join(options.outputDir, 'weekly-person-news.json');
  await run('weekly-person-news', [
    'scripts/discover-daily-person-news.mjs',
    '--lookback-hours', '192',
    ...previousArgs(newsReportPath),
    '--output', newsReportPath,
  ]);
  await run('current-legislator-roster', ['scripts/report-current-legislator-roster.mjs']);
  await run('candidate-status-quality', ['scripts/report-candidate-status-quality.mjs']);
  await run('person-data-quality', [
    'scripts/report-person-data-quality.mjs',
    '--output', path.join(options.outputDir, 'person-data-quality.json'),
    '--sample-limit', '100',
    '--write',
  ]);

  const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    outputDir: options.outputDir,
    ...summarizeWeeklyResults(steps),
    steps,
  };
  fs.writeFileSync(path.join(options.outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failedCount > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { compactStepResult, parseArgs, parseJsonOutput, summarizeWeeklyResults };
