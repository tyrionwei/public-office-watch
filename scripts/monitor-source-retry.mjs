import fs from 'node:fs';
import path from 'node:path';

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

// Source health is separate from person cooldowns and never rejects a person.
export async function withSourceRetry({ key, url, statePath, operation, now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { schemaVersion: 1, sources: {} };
  const previous = state.sources[key];
  if (previous?.url === url && previous.status === 'blocked' && Date.parse(previous.nextCheckAt) > now()) {
    throw Object.assign(new Error('Source retry deferred until ' + previous.nextCheckAt + ': ' + previous.error), { sourceRetry: previous });
  }
  const save = (entry) => {
    state.sources[key] = entry;
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    const temporary = statePath + '.' + process.pid + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n');
    fs.renameSync(temporary, statePath);
  };
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
