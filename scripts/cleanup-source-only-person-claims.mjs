import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');

  if (!fs.existsSync(envPath)) {
    return {};
  }

  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        const key = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : line;
        const value = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '') : '';
        return [key, value];
      }),
  );
}

function parseArgs(argv) {
  const options = {
    sourceNames: [],
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--source-name') {
      options.sourceNames.push(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--write') {
      options.write = true;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  options.sourceNames = options.sourceNames.map((sourceName) => sourceName.trim()).filter(Boolean);

  if (options.sourceNames.length === 0) {
    throw new Error('Provide at least one --source-name.');
  }

  return options;
}

async function supabaseRequest({ url, serviceKey }, table, { method, filters }) {
  const requestUrl = new URL(`${url}/rest/v1/${table}`);

  for (const [key, value] of Object.entries(filters)) {
    requestUrl.searchParams.set(key, value);
  }

  const response = await fetch(requestUrl, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=representation',
    },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error(JSON.stringify(body));
  }

  return body;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const localEnv = readLocalEnv();
  const url = (process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  const env = { url, serviceKey };
  const filters = {
    person_id: 'is.null',
    source_name: `in.(${options.sourceNames.map((sourceName) => `"${sourceName}"`).join(',')})`,
  };
  const rows = await supabaseRequest(env, 'person_claims', {
    method: options.write ? 'DELETE' : 'GET',
    filters,
  });

  console.log(JSON.stringify({
    status: options.write ? 'deleted' : 'dry-run',
    sourceNames: options.sourceNames,
    count: Array.isArray(rows) ? rows.length : null,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`source-only person claim cleanup failed: ${message}`);
  process.exit(1);
});
