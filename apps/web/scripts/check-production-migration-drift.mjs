import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));

export function parseMigrationDryRunOutput(output) {
  for (const line of output.split(/\r?\n/u).reverse()) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) {
      continue;
    }

    try {
      const report = JSON.parse(trimmed);
      if (typeof report.upToDate === 'boolean' && Array.isArray(report.migrations)) {
        return report;
      }
    } catch {
      continue;
    }
  }

  throw new Error('Supabase dry-run did not return a migration report.');
}

export function assertNoMigrationDrift(output) {
  const report = parseMigrationDryRunOutput(output);

  if (!report.upToDate || report.migrations.length > 0) {
    const pending = report.migrations.join(', ') || 'unknown pending migrations';
    throw new Error(`Production migration drift detected: ${pending}`);
  }

  return report;
}

function run() {
  const result = spawnSync(
    'npx',
    [
      'supabase',
      'db',
      'push',
      '--linked',
      '--include-all',
      '--dry-run',
      '--output-format',
      'json',
    ],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: process.env,
    },
  );
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');

  if (output) {
    process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  assertNoMigrationDrift(output);
  console.log('Production migration history is up to date.');
}

const entryPoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;

if (entryPoint === import.meta.url) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
