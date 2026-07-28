import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(webRoot, '..', '..');
const srcRoot = path.join(webRoot, 'src');
const migrationsRoot = path.join(repoRoot, 'supabase', 'migrations');
const reviewedRelations = [
  'candidates',
  'election_race_facets',
  'election_race_summaries',
  'elections',
  'home_region_summary',
  'home_ticker',
  'people',
  'people_directory',
  'person_party_affiliations',
  'races',
  'regions',
  'search_results',
];
const reviewedFunctions = ['person_claims_for'];
const issues = [];

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function addIssue(rule, details) {
  issues.push({ rule, details });
}

const config = read('supabase/config.toml');
const apiSchemas = config.match(/\[api\][\s\S]*?schemas\s*=\s*\[([^\]]*)\]/)?.[1] ?? '';
if (/['"]published['"]/.test(apiSchemas)) {
  addIssue('published-schema-must-stay-unexposed', 'Remove published from supabase/config.toml until the exposure phase is explicitly approved.');
}

const providerFactory = read('apps/web/src/lib/publicDataProviderFactory.ts');
if (/published(ReadAdapter|PublicDataBridge)|['"]published['"]/.test(providerFactory)) {
  addIssue('published-provider-must-stay-unregistered', 'The runtime provider factory references the private published path.');
}

const envExample = read('apps/web/.env.example');
if (/VITE_PUBLIC_DATA_PROVIDER\s*=\s*published/.test(envExample)) {
  addIssue('published-mode-must-not-be-documented-yet', 'The example environment enables an unapproved published provider mode.');
}

for (const migrationPath of walk(migrationsRoot).filter((filePath) => filePath.endsWith('.sql'))) {
  const sql = fs.readFileSync(migrationPath, 'utf8').replace(/\s+/g, ' ');
  const relativePath = path.relative(repoRoot, migrationPath).replaceAll(path.sep, '/');

  if (/GRANT USAGE ON SCHEMA published TO [^;]*(?:PUBLIC|anon|authenticated)/i.test(sql)) {
    addIssue('frontend-schema-usage-grant-forbidden', `${relativePath} grants published schema usage to a frontend role.`);
  }

  if (/GRANT SELECT ON (?:ALL TABLES IN SCHEMA published|published\.[^;]+) TO [^;]*(?:PUBLIC|anon|authenticated)/i.test(sql)) {
    addIssue('frontend-table-select-grant-forbidden', `${relativePath} grants published relation access before exposure approval.`);
  }

  if (/ALTER DEFAULT PRIVILEGES[^;]*IN SCHEMA published[^;]*GRANT (?:SELECT|ALL)[^;]* TO [^;]*(?:PUBLIC|anon|authenticated)/i.test(sql)) {
    addIssue('frontend-default-privilege-forbidden', `${relativePath} grants future published relations to a frontend role.`);
  }

  if (/GRANT EXECUTE ON FUNCTION published\.[^;]+ TO [^;]*(?:PUBLIC|anon|authenticated)/i.test(sql)) {
    addIssue('frontend-function-execute-grant-forbidden', `${relativePath} grants a published function to a frontend role.`);
  }
}

const adapterPath = path.join(srcRoot, 'lib', 'publishedReadAdapter.ts');
const bridgePath = path.join(srcRoot, 'lib', 'publishedPublicDataBridge.ts');
const adapterSource = fs.readFileSync(adapterPath, 'utf8');
const adapterRelations = Array.from(new Set(
  Array.from(adapterSource.matchAll(/\.from<[^>]+>\('([^']+)'\)/g), (match) => match[1]),
)).sort();
const adapterFunctions = Array.from(new Set(
  Array.from(adapterSource.matchAll(/\.rpc(?:<[^>]+>)?\('([^']+)'/g), (match) => match[1]),
)).sort();

if (JSON.stringify(adapterRelations) !== JSON.stringify(reviewedRelations)) {
  addIssue(
    'adapter-relation-allowlist-mismatch',
    `Expected ${reviewedRelations.join(', ')}, found ${adapterRelations.join(', ') || 'none'}.`,
  );
}

if (JSON.stringify(adapterFunctions) !== JSON.stringify(reviewedFunctions)) {
  addIssue(
    'adapter-function-allowlist-mismatch',
    `Expected ${reviewedFunctions.join(', ')}, found ${adapterFunctions.join(', ') || 'none'}.`,
  );
}

for (const filePath of walk(srcRoot).filter((entry) => /\.(?:ts|tsx)$/.test(entry))) {
  if (filePath === adapterPath || filePath === bridgePath) continue;
  const source = fs.readFileSync(filePath, 'utf8');
  if (source.includes('publishedReadAdapter') || source.includes('publishedPublicDataBridge')) {
    addIssue(
      'private-published-path-imported-by-runtime',
      path.relative(webRoot, filePath).replaceAll(path.sep, '/'),
    );
  }
}

if (issues.length > 0) {
  console.error('Published exposure boundary check failed.');
  for (const issue of issues) {
    console.error(`- [${issue.rule}] ${issue.details}`);
  }
  process.exit(1);
}

console.log(`Published exposure boundary check OK. Schema remains private; reviewed adapter relations: ${reviewedRelations.join(', ')}; functions: ${reviewedFunctions.join(', ')}.`);
