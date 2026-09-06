import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function classifySourceFailure(error) {
  const parts = [];
  const seen = new Set();
  for (let current = error; current && !seen.has(current); current = current.cause) {
    seen.add(current);
    parts.push(String(current.code ?? '') + ' ' + String(current.message ?? current));
  }
  const message = parts.join(': ');
  if (/helper_unknown_error|setup refresh had errors/i.test(message)) return 'local_tool';
  if (/ERR_SSL|ERR_TLS|CERT_|legacy renegotiation/i.test(message)) return 'tls_configuration';
  if (/\b404\b|\b410\b/.test(message)) return 'url_unavailable';
  if (/\b403\b|captcha/i.test(message)) return 'access_blocked';
  if (/maxlag|\b429\b|\b5\d\d\b|timeout|timed out|ECONNRESET|EAI_AGAIN/i.test(message)) return 'transient';
  return 'unknown';
}

export function sourceHealthStatePath(stateDirectory, key) {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(key)) {
    throw new Error('Unsafe monitor source key: ' + key);
  }
  return path.join(stateDirectory, key + '.json');
}

function sourceHealthLockPath(stateDirectory, key) {
  sourceHealthStatePath(stateDirectory, key);
  return path.join(stateDirectory, key + '.lock');
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function readSourceLock(lockPath) {
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const pid = Number(lock?.pid);
    return Number.isInteger(pid) && pid > 0 && typeof lock?.token === 'string' ? lock : null;
  } catch {
    return null;
  }
}

function tryCreateSourceLock(lockPath, lock) {
  const temporary = lockPath + '.' + process.pid + '.' + lock.token + '.tmp';
  try {
    fs.writeFileSync(temporary, JSON.stringify(lock) + '\n', { flag: 'wx' });
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

function inspectSourceLock(lockPath) {
  const existing = readSourceLock(lockPath);
  if (existing) {
    return isProcessAlive(Number(existing.pid)) ? 'busy' : 'reclaimable';
  }
  try {
    const ageMs = Date.now() - fs.statSync(lockPath).mtimeMs;
    return ageMs < 30_000 ? 'busy' : 'reclaimable';
  } catch (error) {
    if (error?.code === 'ENOENT') return 'missing';
    throw error;
  }
}

function releaseSourceLock(lockPath, token) {
  const existing = readSourceLock(lockPath);
  if (!existing || existing.token !== token) return false;
  fs.rmSync(lockPath, { force: true });
  return true;
}

function tryAcquireSourceLock(lockPath) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const lock = { pid: process.pid, token: randomUUID(), startedAt: new Date().toISOString() };
  const recoveryPath = lockPath + '.reclaim';

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (fs.existsSync(recoveryPath)) {
      const recovery = readSourceLock(recoveryPath);
      if (recovery && isProcessAlive(Number(recovery.pid))) return null;
      if (fs.existsSync(recoveryPath)) {
        throw new Error('Monitor source has a stale lock recovery marker: ' + recoveryPath);
      }
      continue;
    }

    if (tryCreateSourceLock(lockPath, lock)) return lock;
    const status = inspectSourceLock(lockPath);
    if (status === 'busy') return null;
    if (status === 'missing') continue;

    const recoveryLock = {
      pid: process.pid,
      token: randomUUID(),
      startedAt: new Date().toISOString(),
    };
    if (!tryCreateSourceLock(recoveryPath, recoveryLock)) return null;
    try {
      const currentStatus = inspectSourceLock(lockPath);
      if (currentStatus === 'busy') return null;
      if (currentStatus === 'missing') continue;
      fs.rmSync(lockPath, { force: true });
      if (tryCreateSourceLock(lockPath, lock)) return lock;
    } finally {
      releaseSourceLock(recoveryPath, recoveryLock.token);
    }
  }
  return null;
}

async function acquireSourceLock(lockPath, {
  timeoutMs = 5 * 60_000,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const lock = tryAcquireSourceLock(lockPath);
    if (lock) return lock;
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for monitor source lock: ' + lockPath);
    }
    await wait(100);
  }
}

function readSourceState(filePath, key, legacyStatePath) {
  if (fs.existsSync(filePath)) {
    const state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (state?.schemaVersion !== 1 || state?.source?.key !== key) {
      throw new Error('Invalid monitor source health state for ' + key);
    }
    return state.source;
  }

  if (!legacyStatePath || !fs.existsSync(legacyStatePath)) return null;
  const legacyState = JSON.parse(fs.readFileSync(legacyStatePath, 'utf8'));
  if (legacyState?.schemaVersion !== 1 || typeof legacyState?.sources !== 'object') {
    throw new Error('Invalid legacy monitor source health state');
  }
  return legacyState.sources[key] ?? null;
}

function saveSourceState(filePath, entry) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = filePath + '.' + process.pid + '.' + randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temporary, JSON.stringify({ schemaVersion: 1, source: entry }, null, 2) + '\n');
    fs.renameSync(temporary, filePath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

// Source health is separate from person cooldowns and never rejects a person.
// Each source owns one state file and one lock so daily and weekly monitors
// serialize read-operation-write updates for that source without blocking others.
export async function withSourceRetry({ key, url, stateDirectory, legacyStatePath, operation, now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  lockTimeoutMs = 5 * 60_000,
  lockSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const filePath = sourceHealthStatePath(stateDirectory, key);
  const lockPath = sourceHealthLockPath(stateDirectory, key);
  const lock = await acquireSourceLock(lockPath, { timeoutMs: lockTimeoutMs, wait: lockSleep });
  try {
    const previous = readSourceState(filePath, key, legacyStatePath);
    if (previous?.url === url && previous.status === 'blocked' && Date.parse(previous.nextCheckAt) > now()) {
      throw Object.assign(new Error('Source retry deferred until ' + previous.nextCheckAt + ': ' + previous.error), { sourceRetry: previous });
    }
    const save = (entry) => saveSourceState(filePath, entry);
    let result;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        result = await operation();
        break;
      } catch (error) {
        const category = classifySourceFailure(error);
        if (category === 'transient' && attempt === 0 && !(error.retryAfterMs > 30_000)) {
          await sleep(Math.max(5000, error.retryAfterMs || 0));
          continue;
        }
        const retryDelayMs = category === 'transient' ? 30 * 60_000
          : ['tls_configuration', 'url_unavailable', 'access_blocked'].includes(category) ? 7 * 86400_000 : 86400_000;
        const entry = { key, url, status: 'blocked', category,
          consecutiveFailures: (previous?.url === url ? previous.consecutiveFailures ?? 0 : 0) + 1,
          lastAttemptAt: new Date(now()).toISOString(), lastSuccessAt: previous?.lastSuccessAt ?? null,
          nextCheckAt: new Date(now() + Math.max(retryDelayMs, error.retryAfterMs || 0)).toISOString(),
          error: String(error.message ?? error) + (error.cause?.message ? ': ' + error.cause.message : '') };
        save(entry);
        throw Object.assign(error, { sourceRetry: entry });
      }
    }
    save({ key, url, status: 'ok', consecutiveFailures: 0, lastSuccessAt: new Date(now()).toISOString(), nextCheckAt: null });
    return result;
  } finally {
    releaseSourceLock(lockPath, lock.token);
  }
}
