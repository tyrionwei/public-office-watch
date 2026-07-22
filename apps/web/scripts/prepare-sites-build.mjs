import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const distDirectory = resolve(root, 'dist');

if (process.argv.includes('--clean')) {
  rmSync(distDirectory, { recursive: true, force: true });
  process.exit(0);
}

const clientEntry = resolve(distDirectory, 'client', 'index.html');
const workerSource = resolve(root, 'worker', 'sites-static.js');
const workerDirectory = resolve(root, 'dist', 'server');
const workerEntry = resolve(workerDirectory, 'index.js');
const hostingConfig = resolve(root, '.openai', 'hosting.json');

for (const requiredPath of [clientEntry, workerSource, hostingConfig]) {
  if (!existsSync(requiredPath)) {
    throw new Error(`Sites build is missing ${requiredPath}`);
  }
}

rmSync(workerDirectory, { recursive: true, force: true });
mkdirSync(workerDirectory, { recursive: true });
copyFileSync(workerSource, workerEntry);

for (const unusedAsset of [
  'client/assets/characters/default-civic-sprite-sheet-source.png',
  'client/assets/map/pixel-ocean-panel-bg.png',
]) {
  rmSync(resolve(distDirectory, unusedAsset), { force: true });
}

console.log('Codex Sites build prepared.');
