import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  mergeLocalEnvironment,
  parseEnvironmentFile,
  validateLocalTestEnvironment,
  validateProductionEnvironment,
  validateProductionSmokeEnvironment,
} from './environmentGuards.mjs';

const mode = process.argv[2];

if (mode === 'local') {
  const localEnvironmentPath = resolve(import.meta.dirname, '..', '.env.local');
  let fileEnvironment;
  try {
    fileEnvironment = parseEnvironmentFile(readFileSync(localEnvironmentPath, 'utf8'));
  } catch {
    throw new Error('Local browser tests require apps/web/.env.local.');
  }
  validateLocalTestEnvironment(mergeLocalEnvironment(fileEnvironment, process.env));
  console.log('Local test environment OK.');
} else if (mode === 'production') {
  validateProductionEnvironment(process.env);
  console.log('Production build environment OK.');
} else if (mode === 'production-smoke') {
  validateProductionSmokeEnvironment(process.env);
  console.log('Production smoke environment OK.');
} else {
  throw new Error('Usage: check-environment.mjs local|production|production-smoke');
}
