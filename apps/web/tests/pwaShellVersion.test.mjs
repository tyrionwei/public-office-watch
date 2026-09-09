import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pwaShellVersionPlugin, shellAssetPaths, versionPwaShell } from '../build/pwaShellVersion.mjs';

const template = await readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8');
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'pow-pwa-version-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const url of shellAssetPaths) {
    await mkdir(path.dirname(path.join(root, url)), { recursive: true });
    await writeFile(path.join(root, url), 'fixture ' + url);
  }
  await writeFile(path.join(root, 'service-worker.js'), template);
  return root;
}
test('every precached asset and the runtime template participate in the deterministic version', async t => {
  const root = await fixture(t);
  const initial = await versionPwaShell(root);
  const initialBytes = await readFile(path.join(root, 'service-worker.js'), 'utf8');
  await writeFile(path.join(root, 'service-worker.js'), template);
  assert.deepEqual(await versionPwaShell(root), initial);
  assert.equal(await readFile(path.join(root, 'service-worker.js'), 'utf8'), initialBytes);
  for (const url of shellAssetPaths) {
    await writeFile(path.join(root, url), 'changed ' + url);
    await writeFile(path.join(root, 'service-worker.js'), template);
    const changed = await versionPwaShell(root);
    assert.notEqual(changed.version, initial.version);
    assert.notEqual(changed.assets.find(asset => asset.url === url).sha256, initial.assets.find(asset => asset.url === url).sha256);
    await writeFile(path.join(root, url), 'fixture ' + url);
  }
  await writeFile(path.join(root, 'service-worker.js'), template + '\n// runtime change\n');
  assert.notEqual((await versionPwaShell(root)).version, initial.version);
});

test('missing assets and unversioned marker errors fail the build', async t => {
  const root = await fixture(t);
  await rm(path.join(root, 'site.webmanifest'));
  await assert.rejects(versionPwaShell(root), /ENOENT/);
  assert.equal(await readFile(path.join(root, 'service-worker.js'), 'utf8'), template);
  await writeFile(path.join(root, 'service-worker.js'), 'no marker');
  await assert.rejects(versionPwaShell(root), /exactly one/);
});

test('Vite emits the versioned worker into the resolved output without changing its source', async t => {
  const root = await fixture(t);
  const publicDir = path.join(root, 'public');
  await mkdir(publicDir);
  await writeFile(path.join(root, 'index.html'), '<!doctype html><html><head></head><body>fixture</body></html>');
  for (const url of [...shellAssetPaths, '/service-worker.js']) {
    await mkdir(path.dirname(path.join(publicDir, url)), { recursive: true });
    await writeFile(path.join(publicDir, url), await readFile(path.join(root, url)));
  }
  const { build } = await import('vite');
  const outDir = path.join(root, 'isolated-output');
  await build({ configFile: false, root, envDir: root, publicDir, logLevel: 'silent', plugins: [pwaShellVersionPlugin()], build: { outDir } });
  assert.doesNotMatch(await readFile(path.join(outDir, 'service-worker.js'), 'utf8'), /__POW_SHELL_MANIFEST__/);
  assert.equal(await readFile(path.join(publicDir, 'service-worker.js'), 'utf8'), template);
  const before = await readFile(path.join(outDir, 'service-worker.js'), 'utf8');
  await writeFile(path.join(publicDir, 'offline.html'), 'new offline document');
  await build({ configFile: false, root, envDir: root, publicDir, logLevel: 'silent', plugins: [pwaShellVersionPlugin()], build: { outDir } });
  assert.notEqual(await readFile(path.join(outDir, 'service-worker.js'), 'utf8'), before);
});
