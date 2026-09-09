import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const shellAssetPaths = [
  '/offline.html', '/site.webmanifest', '/assets/brand/icon-192.png',
  '/assets/brand/dianjiangtai-icon.png', '/assets/brand/apple-touch-icon.png',
];
const marker = '/*__POW_SHELL_MANIFEST__*/ null';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function versionPwaShell(outDir) {
  const workerPath = path.join(outDir, 'service-worker.js');
  const template = await readFile(workerPath, 'utf8');
  if (template.split(marker).length !== 2) throw new Error('Expected exactly one PWA shell manifest marker');
  const assets = await Promise.all(shellAssetPaths.map(async url => ({ url, sha256: sha256(await readFile(path.join(outDir, url.slice(1)))) })));
  const manifest = { version: sha256(template + JSON.stringify(assets)), assets };
  await writeFile(workerPath, template.replace(marker, JSON.stringify(manifest)));
  return manifest;
}

/** @returns {import('vite').Plugin} */
export function pwaShellVersionPlugin() {
  let outDir;
  let ssr;
  return {
    name: 'public-office-watch-pwa-shell-version',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
      ssr = Boolean(config.build.ssr);
    },
    async writeBundle() {
      if (!ssr) await versionPwaShell(outDir);
    },
  };
}
