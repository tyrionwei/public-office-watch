import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const clientEntry = resolve(root, 'dist', 'client', 'index.html');
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

console.log('Codex Sites build prepared.');
