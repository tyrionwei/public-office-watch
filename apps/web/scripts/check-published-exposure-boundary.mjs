import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(webRoot, '..', '..');
const srcRoot = path.join(webRoot, 'src');
const migrationsRoot = path.join(repoRoot, 'supabase', 'migrations');
const publicAccessMigration = 'supabase/migrations/202607280004_published_public_read_access.sql';
const supplementalPublicAccessMigrations = [
  'supabase/migrations/202607280005_published_ranked_search.sql',
  'supabase/migrations/202608010002_published_active_party_candidate_access.sql',
];
const reviewedRelations = [
  'active_party_candidates',
  'candidates',
  'election_race_facets',
  'election_race_summaries',
  'elections',
  'home_region_summary',
  'home_ticker',
  'parties',
  'party_company_contribution_summaries',
  'party_finance_summaries',
  'party_officers',
  'people',
  'people_directory',
  'person_party_affiliations',
  'races',
  'regions',
  'search_results',
];
const directlyQueriedRelations = reviewedRelations.filter((relation) => relation !== 'search_results');
const reviewedFunctions = ['election_race_page', 'person_claims_for', 'search_public_records'];
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
if (!/['"]published['"]/.test(apiSchemas)) {
  addIssue('local-published-schema-exposure-missing', 'Local config must expose published for browser validation. Production exposure is managed separately.');
}

const providerFactory = read('apps/web/src/lib/publicDataProviderFactory.ts');
if (!providerFactory.includes("import('./configuredPublishedPublicDataProvider')")) {
  addIssue('published-provider-assembly-missing', 'The runtime factory does not register the reviewed local published provider assembly.');
}
if (!/import\.meta\.env\.VITE_ENABLE_PUBLISHED_PROVIDER\s*===\s*['"]true['"]/.test(providerFactory)) {
  addIssue('published-provider-guard-missing', 'The published provider must require VITE_ENABLE_PUBLISHED_PROVIDER=true.');
}

const envExample = read('apps/web/.env.example');
if (/VITE_PUBLIC_DATA_PROVIDER\s*=\s*published/.test(envExample)) {
  addIssue('published-mode-must-not-be-default', 'The example environment must not select the local-only published provider mode.');
}

const localSeed = read('supabase/seed.sql');
if (!/GRANT USAGE ON SCHEMA published TO anon, authenticated/i.test(localSeed)) {
  addIssue('local-published-schema-grant-missing', 'The local seed must grant published schema usage to browser roles.');
}
if (/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE)[^;]*published/i.test(localSeed) || /published\.promote/i.test(localSeed)) {
  addIssue('unsafe-local-published-grant', 'The local seed may grant only reviewed reads and read functions, never writes or promote.');
}
for (const relation of reviewedRelations) {
  if (!localSeed.includes(`published.${relation}`)) {
    addIssue('local-relation-grant-missing', `supabase/seed.sql does not grant the reviewed ${relation} relation.`);
  }
}
for (const functionName of reviewedFunctions) {
  if (!localSeed.includes(`published.${functionName}`)) {
    addIssue('local-function-grant-missing', `supabase/seed.sql does not grant the reviewed ${functionName} function.`);
  }
}

const productionGrant = [publicAccessMigration, ...supplementalPublicAccessMigrations]
  .map(read)
  .join('\n');
if (!/GRANT USAGE ON SCHEMA published TO anon, authenticated/i.test(productionGrant)) {
  addIssue('production-published-schema-grant-missing', `${publicAccessMigration} must grant schema usage to browser roles.`);
}
if (!/ALTER ROLE authenticator\s+SET pgrst\.db_schemas = ['"]public, graphql_public, published['"]/i.test(productionGrant)) {
  addIssue('production-published-schema-exposure-missing', `${publicAccessMigration} must expose only the approved Data API schemas.`);
}
if (/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE)[^;]*published/i.test(productionGrant) || /GRANT[^;]*published\.promote/i.test(productionGrant)) {
  addIssue('unsafe-production-published-grant', `${publicAccessMigration} may grant only reviewed reads and read functions.`);
}
for (const relation of reviewedRelations) {
  if (!productionGrant.includes(`published.${relation}`)) {
    addIssue('production-relation-grant-missing', `${publicAccessMigration} does not grant the reviewed ${relation} relation.`);
  }
}
for (const functionName of reviewedFunctions) {
  if (!productionGrant.includes(`published.${functionName}`)) {
    addIssue('production-function-grant-missing', `${publicAccessMigration} does not grant the reviewed ${functionName} function.`);
  }
}

for (const migrationPath of walk(migrationsRoot).filter((filePath) => filePath.endsWith('.sql'))) {
  const sql = fs.readFileSync(migrationPath, 'utf8').replace(/\s+/g, ' ');
  const relativePath = path.relative(repoRoot, migrationPath).replaceAll(path.sep, '/');

  if (
    relativePath === publicAccessMigration
    || supplementalPublicAccessMigrations.includes(relativePath)
  ) continue;

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
const providerPath = path.join(srcRoot, 'lib', 'publishedPublicDataProvider.ts');
const configuredProviderPath = path.join(srcRoot, 'lib', 'configuredPublishedPublicDataProvider.ts');
const factoryPath = path.join(srcRoot, 'lib', 'publicDataProviderFactory.ts');
const adapterSource = fs.readFileSync(adapterPath, 'utf8');
const adapterRelations = Array.from(new Set(
  Array.from(adapterSource.matchAll(/\.from<[^>]+>\('([^']+)'\)/g), (match) => match[1]),
)).sort();
const adapterFunctions = Array.from(new Set(
  Array.from(adapterSource.matchAll(/\.rpc(?:<[^>]+>)?\('([^']+)'/g), (match) => match[1]),
)).sort();

if (JSON.stringify(adapterRelations) !== JSON.stringify(directlyQueriedRelations)) {
  addIssue(
    'adapter-relation-allowlist-mismatch',
    `Expected ${directlyQueriedRelations.join(', ')}, found ${adapterRelations.join(', ') || 'none'}.`,
  );
}

if (JSON.stringify(adapterFunctions) !== JSON.stringify(reviewedFunctions)) {
  addIssue(
    'adapter-function-allowlist-mismatch',
    `Expected ${reviewedFunctions.join(', ')}, found ${adapterFunctions.join(', ') || 'none'}.`,
  );
}

for (const filePath of walk(srcRoot).filter((entry) => /\.(?:ts|tsx)$/.test(entry))) {
  if ([adapterPath, bridgePath, providerPath, configuredProviderPath, factoryPath].includes(filePath)) continue;
  const source = fs.readFileSync(filePath, 'utf8');
  if (
    source.includes('publishedReadAdapter')
    || source.includes('publishedPublicDataBridge')
    || source.includes('publishedPublicDataProvider')
    || source.includes('configuredPublishedPublicDataProvider')
  ) {
    addIssue(
      'private-published-path-imported-outside-assembly',
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

console.log(`Published exposure boundary check OK. Production and local browser access are limited to the reviewed relations: ${reviewedRelations.join(', ')}; functions: ${reviewedFunctions.join(', ')}.`);
