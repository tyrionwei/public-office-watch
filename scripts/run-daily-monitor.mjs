import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultLockPath = path.join(repoRoot, 'tmp', 'monitor-locks', 'daily.lock');
const dailySteps = [
  ['monitor:cec-election-sources', []],
  ['sync:real-data:daily', []],
  ['discover:daily-person-news', ['--', '--output', 'tmp/daily-person-news.json']],
  ['run:daily-person-enrichment', []],
];

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function readRunLock(lockPath) {
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const pid = Number(lock?.pid);
    return Number.isInteger(pid) && pid > 0 && typeof lock?.token === 'string' ? lock : null;
  } catch {
    return null;
  }
}

function tryCreateRunLock(lockPath, lock) {
  const temporary = lockPath + '.' + process.pid + '.' + lock.token + '.tmp';
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(lock)}\n`, { flag: 'wx' });
    try {
      fs.linkSync(temporary, lockPath);
      return true;
    } catch (error) {
      if (error?.code === 'EEXIST') return false;
      throw error;
    }
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function ensureLockCanBeReclaimed(lockPath, label) {
  const existing = readRunLock(lockPath);
  if (existing && isProcessAlive(Number(existing.pid))) {
    throw new Error(`${label} monitor is already running with PID ${existing.pid}.`);
  }
  if (existing) return true;

  let ageMs;
  try {
    ageMs = Date.now() - fs.statSync(lockPath).mtimeMs;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
  if (ageMs < 30_000) {
    throw new Error(`${label} monitor lock is still being acquired.`);
  }
  return true;
}

function acquireRunLock(lockPath = defaultLockPath) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const label = 'Daily';
  const lock = {
    pid: process.pid,
    token: randomUUID(),
    startedAt: new Date().toISOString(),
  };
  const recoveryPath = lockPath + '.reclaim';

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (fs.existsSync(recoveryPath)) {
      const recovery = readRunLock(recoveryPath);
      if (recovery && isProcessAlive(Number(recovery.pid))) {
        throw new Error(`${label} monitor lock recovery is already running with PID ${recovery.pid}.`);
      }
      if (fs.existsSync(recoveryPath)) {
        throw new Error(`${label} monitor has a stale lock recovery marker: ${recoveryPath}`);
      }
      continue;
    }

    if (tryCreateRunLock(lockPath, lock)) return lock;
    if (!ensureLockCanBeReclaimed(lockPath, label)) continue;

    const recoveryLock = {
      pid: process.pid,
      token: randomUUID(),
      startedAt: new Date().toISOString(),
    };
    if (!tryCreateRunLock(recoveryPath, recoveryLock)) continue;

    try {
      if (!ensureLockCanBeReclaimed(lockPath, label)) continue;
      fs.rmSync(lockPath, { force: true });
      if (tryCreateRunLock(lockPath, lock)) return lock;

      const replacement = readRunLock(lockPath);
      if (replacement && isProcessAlive(Number(replacement.pid))) {
        throw new Error(`${label} monitor is already running with PID ${replacement.pid}.`);
      }
      throw new Error(`Unable to acquire the ${label.toLowerCase()} monitor lock after reclaiming it.`);
    } finally {
      releaseRunLock(recoveryPath, recoveryLock.token);
    }
  }

  throw new Error(`Unable to acquire the ${label.toLowerCase()} monitor lock.`);
}

function releaseRunLock(lockPath = defaultLockPath, token) {
  const existing = readRunLock(lockPath);
  if (!existing || existing.token !== token) return false;
  fs.rmSync(lockPath, { force: true });
  return true;
}

function parseLastJsonOutput(output) {
  const value = String(output ?? '').trim();
  let index = value.lastIndexOf('{');
  while (index >= 0) {
    try {
      return JSON.parse(value.slice(index));
    } catch {
      // npm can print banners before the final structured result.
    }
    if (index === 0) break;
    index = value.lastIndexOf('{', index - 1);
  }
  return null;
}

function resultNeedsAttention(result) {
  if (!result || typeof result !== 'object') return false;
  const status = String(result.status ?? '').toLowerCase();
  return result.needsAttention === true
    || ['degraded', 'needs_attention', 'partial', 'failed', 'error'].includes(status);
}

function summarizeDailyResults(results, scheduledStepCount = dailySteps.length) {
  const failed = results.filter((result) => result.status === 'failed');
  const degraded = results.filter((result) => result.status === 'degraded');
  const passed = results.filter((result) => result.status === 'ok');
  return {
    status: failed.length > 0 ? 'failed' : degraded.length > 0 ? 'degraded' : 'ok',
    needsAttention: failed.length > 0 || degraded.length > 0,
    scheduledStepCount,
    stepCount: results.length,
    passedCount: passed.length,
    degradedCount: degraded.length,
    failedCount: failed.length,
    passedSteps: passed.map((result) => result.scriptName),
    degradedSteps: degraded.map((result) => result.scriptName),
    failedSteps: failed.map((result) => result.scriptName),
  };
}

function runNpmScript(scriptName, extraArgs = [], outputDir = path.join(repoRoot, 'tmp', 'daily-monitor')) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const startedAt = new Date().toISOString();
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      try {
        const logPath = path.join(outputDir, 'logs', scriptName.replaceAll(':', '-') + '.log');
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        fs.writeFileSync(logPath, stdout + (stderr ? '\nSTDERR\n' + stderr : ''));
        resolve({ ...result, startedAt, finishedAt: new Date().toISOString(), logPath });
      } catch (error) {
        reject(error); // Do not continue when evidence cannot be saved.
      }
    };
    const child = spawn(npmCommand, ['run', scriptName, ...extraArgs], {
      cwd: repoRoot,
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on('error', (error) => finish({
      scriptName,
      exitCode: null,
      status: 'failed',
      needsAttention: true,
      reportedStatus: null,
      reportedNeedsAttention: false,
      error: error instanceof Error ? error.message : String(error),
    }));
    child.on('close', (exitCode) => {
      const reportedResult = parseLastJsonOutput(stdout);
      const needsAttention = resultNeedsAttention(reportedResult);
      finish({
        scriptName,
        exitCode,
        status: exitCode === 0 ? needsAttention ? 'degraded' : 'ok' : 'failed',
        needsAttention: exitCode !== 0 || needsAttention,
        reportedStatus: reportedResult?.status ?? null,
        reportedNeedsAttention: reportedResult?.needsAttention === true,
        sourceHealth: reportedResult?.sourceHealth ?? null,
        error: exitCode === 0 ? null : stderr.trim() || `${scriptName} exited with code ${exitCode}.`,
      });
    });
  });
}

async function runDailySteps(run = runNpmScript) {
  const results = [];
  // These steps do not consume each other's output. A source failure must not
  // suppress unrelated collection; environment/lock checks remain run-wide.
  for (const [scriptName, extraArgs] of dailySteps) {
    results.push(await run(scriptName, extraArgs));
  }
  return results;
}

async function main() {
  const lock = acquireRunLock();
  try {
    const results = await runDailySteps();
    const summary = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      ...summarizeDailyResults(results),
      steps: results,
    };
    const summaryPath = path.join(repoRoot, 'tmp', 'daily-monitor', 'summary.json');
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
    console.log(JSON.stringify(summary, null, 2));
    if (summary.needsAttention) process.exitCode = 1;
    return summary;
  } finally {
    releaseRunLock(defaultLockPath, lock.token);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export {
  acquireRunLock,
  parseLastJsonOutput,
  releaseRunLock,
  resultNeedsAttention,
  runDailySteps,
  summarizeDailyResults,
};
