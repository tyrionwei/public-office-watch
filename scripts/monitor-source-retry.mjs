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
// Each source owns one atomic state file so unrelated monitor processes cannot
// overwrite one another's retry status.
export async function withSourceRetry({ key, url, stateDirectory, legacyStatePath, operation, now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const filePath = sourceHealthStatePath(stateDirectory, key);
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
}
