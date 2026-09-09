import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const localReviewSqlPath = 'supabase/local-migrations/20260909072944_atomic_auto_review_person_claim.sql';
const containerName = 'supabase_db_public-office-watch';
const dockerHost = 'unix:///var/run/docker.sock';
const functionSignature = 'public.auto_approve_person_claim(jsonb,jsonb)';

export function parseArgs(argv) {
  if (argv.length === 0 || (argv.length === 1 && argv[0] === '--plan')) return 'plan';
  if (argv.length === 1 && ['--check', '--apply-local', '--help'].includes(argv[0])) return argv[0].slice(2);
  throw new Error('Use --plan (default), --check, --apply-local or --help; target overrides are not supported.');
}

export function verifyLocalContainer(container) {
  const labels = container?.Config?.Labels;
  const ports = container?.NetworkSettings?.Ports?.['5432/tcp'];
  if (!/^[a-f0-9]{64}$/u.test(container?.Id ?? '')
    || container.Name !== `/${containerName}` || !container.State?.Running
    || labels?.['com.supabase.cli.project'] !== 'public-office-watch'
    || labels?.['com.supabase.cli.workdir'] !== repoRoot
    || !container.Config?.Image?.startsWith('public.ecr.aws/supabase/postgres:')
    || !ports?.some(port => port.HostPort === '54322')) {
    throw new Error('Local review installer requires the running full-local public-office-watch DB with its verified workdir and runtime port 54322.');
  }
  return container.Id;
}

function runDocker(args, { input } = {}) {
  const env = { ...process.env };
  for (const name of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete env[name];
  const result = spawnSync('docker', ['--host', dockerHost, ...args], {
    input, env, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024,
  });
  // Docker / libpq diagnostics can contain configuration or credentials.
  if (result.error || result.status !== 0) throw new Error('Local Docker/SQL operation failed; no successful installation is confirmed.');
  return result.stdout;
}

export function runInstaller(mode, { docker = runDocker, readSql = () => fs.readFileSync(path.join(repoRoot, localReviewSqlPath), 'utf8') } = {}) {
  if (!['plan', 'check', 'apply-local'].includes(mode)) throw new Error('Invalid installer mode.');
  const sql = readSql();
  const plan = { mode, sql: localReviewSqlPath, sha256: createHash('sha256').update(sql).digest('hex'),
    target: { dockerHost, container: containerName, database: 'postgres', transport: 'container-local Unix socket' },
    changes: 'Install the local review RPC and its grants only; no claim approval or migration ledger updates.',
    targetVerified: false, applied: false };
  if (mode === 'plan') return plan;
  const inspect = identity => JSON.parse(docker(['inspect', identity]))[0];
  const id = verifyLocalContainer(inspect(containerName));
  // Use the verified immutable container ID, never a DB URL or linked project.
  const psql = input => docker(['exec', '-i', id, 'env',
    '-u', 'PGHOSTADDR', '-u', 'PGSERVICE', '-u', 'PGSERVICEFILE', '-u', 'PGOPTIONS', '-u', 'PGPASSWORD',
    'PGPASSFILE=/dev/null', 'psql', '-X', '--no-password', '-qAt', '-v', 'ON_ERROR_STOP=1',
    '-h', '/var/run/postgresql', '-p', '5432', '-U', 'postgres', '-d', 'postgres'], { input });
  const probe = () => JSON.parse(psql(`SELECT json_build_object(
    'database', current_database(),
    'claimTable', to_regclass('public.person_claims') IS NOT NULL,
    'affiliationTable', to_regclass('public.person_party_affiliations') IS NOT NULL,
    'roles', (SELECT count(*) = 3 FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')),
    'installed', to_regprocedure('${functionSignature}') IS NOT NULL,
    'restrictedInvoker', COALESCE((SELECT NOT prosecdef
      AND has_function_privilege('service_role', oid, 'EXECUTE')
      AND NOT has_function_privilege('anon', oid, 'EXECUTE')
      AND NOT has_function_privilege('authenticated', oid, 'EXECUTE')
      FROM pg_proc WHERE oid = to_regprocedure('${functionSignature}')), false)
  );`));
  const before = probe();
  if (before.database !== 'postgres' || !before.claimTable || !before.affiliationTable || !before.roles) {
    throw new Error('Local review database prerequisites are missing; no installation performed.');
  }
  if (mode === 'check') return { ...plan, targetVerified: true, ...before };
  if (verifyLocalContainer(inspect(id)) !== id) throw new Error('Local container identity changed before installation.');
  psql(sql);
  const after = probe();
  if (!after.installed || !after.restrictedInvoker) throw new Error('SQL completed but local RPC permission verification failed; stop and inspect this local database.');
  return { ...plan, targetVerified: true, applied: true, ...after };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const mode = parseArgs(process.argv.slice(2));
    if (mode === 'help') console.log('Local review RPC: --plan (offline default), --check (read-only local DB), --apply-local (explicit local schema write). No remote/rehearsal target or ledger repair.');
    else console.log(JSON.stringify(runInstaller(mode), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Local review installer failed.');
    process.exitCode = 1;
  }
}
