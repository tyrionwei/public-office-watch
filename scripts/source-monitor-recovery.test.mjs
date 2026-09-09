import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { main as candidates } from './cec-candidate-source-discovery.mjs';
import { main as referendums } from './cec-referendum-source-monitor.mjs';
import { compareSourceDiscoveries, monitorState, writeMonitorReport } from './lib/source-monitor-state.mjs';

for (const [name, main] of [['candidates', candidates], ['referendums', referendums]]) {
  test(`${name}: persisted last success survives partial and repeated full failure, then detects additions/removals`, async (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pow-monitor-recovery-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const state = path.join(dir, 'state.json'); const manifest = path.join(dir, 'manifest.json');
    fs.writeFileSync(manifest, JSON.stringify({ schemaVersion: 1, electionYear: 2026, rules: { termGroups: [['公投']] }, sources: [
      { key: 'first', name: 'first', url: 'https://web.cec.gov.tw/first' },
      { key: 'second', name: 'second', url: 'https://web.cec.gov.tw/second' },
    ] }));
    let mode = 'A'; let sequence = 0;
    t.mock.method(console, 'log', () => {});
    const exitCode = process.exitCode;
    t.after(() => { process.exitCode = exitCode; });
    t.mock.method(globalThis, 'fetch', async (input) => {
      const index = sequence++;
      assert.equal(new URL(input).hostname, 'web.cec.gov.tw');
      if (mode === 'fail' || (mode === 'partial' && index === 0)) throw new Error('fixture outage');
      const items = mode === 'AB' ? ['a', 'b'] : mode === 'B' ? ['b'] : ['a'];
      const response = new Response(items.map((key) => `<a href="/${key}">公投 ${key}</a>`).join(''), { headers: { 'content-type': 'text/html' } });
      Object.defineProperty(response, 'url', { value: String(input) });
      return response;
    });
    const run = async (nextMode) => {
      mode = nextMode; sequence = 0; process.exitCode = undefined;
      const args = name === 'candidates' ? ['--manifest', manifest, '--state', state] : ['--output', state, ...(fs.existsSync(state) ? ['--previous', state] : [])];
      const report = await main(args);
      assert.deepEqual(JSON.parse(fs.readFileSync(state, 'utf8')), report);
      assert.equal(process.exitCode, nextMode === 'fail' ? 1 : undefined);
      assert.equal(fs.readdirSync(dir).some((file) => file.endsWith('.tmp')), false);
      return report;
    };
    const first = await run('A');
    const count = first.sourceCount;
    assert.equal(first.newDiscoveryCount, 0);
    const baseline = first.lastSuccessfulSources[0];
    const partial = await run('partial');
    assert.equal(partial.status, 'partial'); assert.equal(partial.sources.length, count - 1);
    assert.deepEqual(partial.lastSuccessfulSources[0], baseline);
    assert.equal(partial.latestAttempts[0].status, 'failed');
    const failed = await run('fail'); await run('fail');
    assert.equal(failed.status, 'failed'); assert.equal(failed.sources.length, 0);
    assert.equal(failed.changedSourceCount, 0); assert.equal(failed.newDiscoveryCount, 0);
    assert.equal(failed.lastSuccessfulSources.length, count);
    assert.ok(failed.latestAttempts.every((attempt) => attempt.status === 'failed' && attempt.attemptedAt));
    const restored = await run('AB');
    assert.equal(restored.status, 'ok'); assert.equal(restored.newDiscoveryCount, count);
    assert.equal(restored.changedSourceCount, count);
    assert.ok(restored.sources.every((source) => !source.baseline && source.newDiscoveries[0].url.endsWith('/b')));
    const removed = await run('B');
    assert.equal(removed.newDiscoveryCount, 0);
    assert.ok(removed.sources.every((source) => source.removedDiscoveries[0].url.endsWith('/a')));
    assert.equal((await run('B')).changedSourceCount, 0);
  });
}

test('failed first attempts do not invent a success; removed or reconfigured sources drop old baselines', () => {
  const source = { key: 'a', url: 'https://web.cec.gov.tw/a' };
  const failed = monitorState([source], [], [{ key: 'a', message: 'offline' }], null, 'first');
  assert.deepEqual(failed.lastSuccessfulSources, []);
  const current = { key: 'a', requestedUrl: source.url, contentHash: 'a', discoveries: [] };
  assert.equal(compareSourceDiscoveries([current], failed)[0].baseline, true);
  const old = { sources: [current] };
  assert.deepEqual(monitorState([], [], [], old, 'next').lastSuccessfulSources, []);
  assert.deepEqual(monitorState([{ ...source, url: `${source.url}/new` }], [], [], old, 'next').lastSuccessfulSources, []);
  assert.equal(compareSourceDiscoveries([{ ...current, requestedUrl: `${source.url}/new` }], old)[0].baseline, true);
  assert.equal(compareSourceDiscoveries([current], old)[0].baseline, false);
});

test('candidate monitor resets comparison when matching rules change', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pow-monitor-context-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const state = path.join(dir, 'state.json'); const manifestPath = path.join(dir, 'manifest.json');
  const manifest = { schemaVersion: 1, electionYear: 2026, rules: { termGroups: [['old']] }, sources: [{ key: 'a', name: 'A', url: 'https://web.cec.gov.tw/a' }] };
  t.mock.method(console, 'log', () => {});
  t.mock.method(globalThis, 'fetch', async () => {
    const response = new Response('<a href="/old">old</a><a href="/new">new</a>', { headers: { 'content-type': 'text/html' } });
    Object.defineProperty(response, 'url', { value: manifest.sources[0].url }); return response;
  });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const before = await candidates(['--manifest', manifestPath, '--state', state]);
  manifest.rules.termGroups = [['new']]; fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const after = await candidates(['--manifest', manifestPath, '--state', state]);
  assert.notEqual(before.comparisonContext, after.comparisonContext);
  assert.equal(after.sources[0].baseline, true); assert.equal(after.newDiscoveryCount, 0);
  assert.equal(after.lastSuccessfulSources[0].discoveries[0].title, 'new');
});

test('failed atomic replacement leaves existing report intact and cleans only its temporary file', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pow-monitor-atomic-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'state.json'); fs.writeFileSync(file, '{"baseline":"kept"}');
  t.mock.method(fs, 'renameSync', () => { throw new Error('fixture replacement failure'); });
  assert.throws(() => writeMonitorReport(file, { baseline: 'new' }), /replacement failure/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{"baseline":"kept"}');
  assert.deepEqual(fs.readdirSync(dir), ['state.json']);
});
