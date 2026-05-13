import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(currentDir, '..');
const srcRoot = path.join(webRoot, 'src');

const pageDirs = [path.join(srcRoot, 'pages')];
const componentDirs = [path.join(srcRoot, 'components')];
const libDirs = [path.join(srcRoot, 'lib')];
const scanDirs = [...pageDirs, ...componentDirs, ...libDirs];
const dataDrivenPages = new Set([
  path.join(srcRoot, 'pages', 'HomePage.tsx'),
  path.join(srcRoot, 'pages', 'RegionPage.tsx'),
  path.join(srcRoot, 'pages', 'ElectionPage.tsx'),
]);

const mockImportPatterns = [
  '../data/mockHomeData',
  '../data/mockPublicViews',
  '../data/mockStageMap',
  '../data/mockPolling',
  '../../data/mock',
];

const secretTerms = ['SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_CONNECTION_STRING'];
const blockedQueryTerms = ['raw_source_records', 'relation_candidates', 'source_documents', 'person_media', 'pending', 'rejected'];
const allowedBlockedTermFiles = new Set([
  path.join(srcRoot, 'lib', 'publicViewRegistry.ts'),
  path.join(srcRoot, 'types', 'publicViews.ts'),
  path.join(srcRoot, 'pages', 'ElectionPage.tsx'),
]);
const allowedCreateClientFile = path.join(srcRoot, 'lib', 'supabasePublicClient.ts');
const allowedSupabaseImportFiles = new Set([allowedCreateClientFile]);
const publicDataPath = path.join(srcRoot, 'lib', 'publicData.ts');

function walk(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function relativePath(filePath) {
  return path.relative(webRoot, filePath).replaceAll(path.sep, '/');
}

function hasMockImport(content) {
  return mockImportPatterns.some((pattern) => content.includes(pattern));
}

function addIssue(issues, rule, filePath, details) {
  issues.push({ rule, filePath: relativePath(filePath), details });
}

const issues = [];
const warnings = [];

for (const dir of pageDirs) {
  for (const filePath of walk(dir)) {
    const content = fs.readFileSync(filePath, 'utf8');

    if (hasMockImport(content)) {
      addIssue(issues, 'pages-no-direct-mock-import', filePath, 'Pages must read data through publicDataProvider.');
    }

    if (dataDrivenPages.has(filePath) && !content.includes('publicDataProvider')) {
      addIssue(issues, 'pages-must-use-public-data-provider', filePath, 'Data-driven pages must read data through publicDataProvider.');
    }
  }
}

for (const dir of componentDirs) {
  for (const filePath of walk(dir)) {
    const content = fs.readFileSync(filePath, 'utf8');

    if (hasMockImport(content)) {
      warnings.push({
        rule: 'components-direct-mock-import-warning',
        filePath: relativePath(filePath),
        details: 'Components should avoid importing mock data directly.',
      });
    }
  }
}

for (const dir of scanDirs) {
  for (const filePath of walk(dir)) {
    const content = fs.readFileSync(filePath, 'utf8');

    for (const term of secretTerms) {
      if (content.includes(term)) {
        addIssue(issues, 'secret-term-forbidden', filePath, `Found forbidden secret variable term: ${term}`);
      }
    }

    for (const term of blockedQueryTerms) {
      if (content.includes(term) && !allowedBlockedTermFiles.has(filePath)) {
        addIssue(issues, 'blocked-query-source-reference', filePath, `Found blocked data source term outside allowlist: ${term}`);
      }
    }

    if (content.includes('createClient(') && filePath !== allowedCreateClientFile) {
      addIssue(issues, 'create-client-location', filePath, 'createClient is only allowed in src/lib/supabasePublicClient.ts');
    }

    if (content.includes("@supabase/supabase-js") && !allowedSupabaseImportFiles.has(filePath)) {
      addIssue(issues, 'supabase-import-location', filePath, '@supabase/supabase-js import is only allowed in src/lib/supabasePublicClient.ts');
    }
  }
}

const publicDataContent = fs.readFileSync(publicDataPath, 'utf8');
if (!publicDataContent.includes('mockPublicDataProvider') || !publicDataContent.includes('export const publicDataProvider = mockPublicDataProvider')) {
  addIssue(issues, 'public-data-provider-must-remain-mock', publicDataPath, 'publicDataProvider must remain wired to mockPublicDataProvider.');
}

if (issues.length > 0) {
  console.error('Public data boundary check failed.');
  for (const issue of issues) {
    console.error(`- [${issue.rule}] ${issue.filePath}: ${issue.details}`);
  }
  if (warnings.length > 0) {
    console.error('Warnings:');
    for (const warning of warnings) {
      console.error(`- [${warning.rule}] ${warning.filePath}: ${warning.details}`);
    }
  }
  process.exit(1);
}

if (warnings.length > 0) {
  console.log('Public data boundary check passed with warnings.');
  for (const warning of warnings) {
    console.log(`- [${warning.rule}] ${warning.filePath}: ${warning.details}`);
  }
  process.exit(0);
}

console.log('Public data boundary check OK.');
