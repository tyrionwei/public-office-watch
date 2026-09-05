import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { planMonitorReview } from './plan-monitor-review.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pow-review-plan-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runId = '20260904T100000Z';
  const runDir = path.join(root, runId);
  fs.mkdirSync(path.join(runDir, 'artifacts'), { recursive: true });
  fs.mkdirSync(path.join(runDir, 'logs'));
  const now = Date.parse('2026-09-04T12:00:00Z');
  const write = (file, payload) => {
    const bytes = JSON.stringify(payload);
    fs.writeFileSync(path.join(root, file), bytes);
    return { size: Buffer.byteLength(bytes), sha256: createHash('sha256').update(bytes).digest('hex') };
  };
  const artifacts = ['daily-person-news.json', 'judicial-check.json'].map((name) => {
    const archivePath = runId + '/artifacts/' + name;
    return { path: 'tmp/' + name, archivePath, mtime: '2026-09-04T10:01:00Z',
      ...write(archivePath, { leads: [] }) };
  });
  const logPath = runId + '/logs/command.log';
  const manifest = { runId, artifactCount: 2, artifacts, logs: [{ path: logPath, ...write(logPath, {
    steps: [
      { scriptName: 'discover:daily-person-news', exitCode: 0, status: 'ok' },
      { scriptName: 'sync:real-data:daily', exitCode: 0, status: 'degraded' },
    ],
  }) }] };
  const summary = { runId, kind: 'daily', startedAt: '2026-09-04T10:00:00Z',
    finishedAt: '2026-09-04T10:02:00Z', status: 'partial', artifactCount: 2,
    steps: { environment: { status: 'ok' }, generalNews: { status: 'ok' },
      sourceSync: { status: 'partial' }, judicial: { status: 'partial' } } };
  const save = () => { write(runId + '/summary.json', summary); write(runId + '/manifest.json', manifest); };
  save();
  return { root, runDir, now, summary, manifest, save, write };
}

test('partial run allows verified independent news but not failed judicial output', (t) => {
  const f = fixture(t);
  const plan = planMonitorReview(f.runDir, f);
  assert.equal(plan.status, 'partial_reviewable');
  assert.equal(plan.eligibleArtifacts.length, 1);
  assert.equal(plan.blockedArtifacts.length, 1);
  assert.equal(plan.blockedSteps.length, 2);
  assert.equal(plan.reviewCompleted, false);
});

test('artifact tampering blocks only that artifact; tampered provenance log blocks run', (t) => {
  const f = fixture(t);
  fs.appendFileSync(path.join(f.root, f.manifest.artifacts[0].archivePath), ' ');
  assert.equal(planMonitorReview(f.runDir, f).eligibleArtifacts.length, 0);
  fs.appendFileSync(path.join(f.root, f.manifest.logs[0].path), ' ');
  assert.match(planMonitorReview(f.runDir, f).errors.join(), /SHA-256/);
});

test('old canonical output is never eligible', (t) => {
  const f = fixture(t);
  f.manifest.artifacts[0].mtime = '2026-09-03T10:01:00Z';
  f.save();
  assert.match(planMonitorReview(f.runDir, f).blockedArtifacts[0].reason, /time window/);
});

test('hash-valid malformed JSON is not eligible', (t) => {
  const f = fixture(t);
  const entry = f.manifest.artifacts[0];
  fs.writeFileSync(path.join(f.root, entry.archivePath), '{');
  entry.size = 1;
  entry.sha256 = createHash('sha256').update('{').digest('hex');
  f.save();
  assert.equal(planMonitorReview(f.runDir, f).eligibleArtifacts.length, 0);
});

test('unknown producer, log disagreement and partial payload fail closed', (t) => {
  const f = fixture(t);
  f.summary.steps.generalNews.status = 'failed';
  f.save();
  assert.equal(planMonitorReview(f.runDir, f).eligibleArtifacts.length, 0);
  f.summary.steps.generalNews.status = 'ok';
  Object.assign(f.manifest.artifacts[0], f.write(f.manifest.artifacts[0].archivePath, { status: 'partial' }));
  f.save();
  assert.match(planMonitorReview(f.runDir, f).blockedArtifacts[0].reason, /partial/);
});

test('run identity, final counts, stale time and environment conflicts block whole run', (t) => {
  const f = fixture(t);
  f.summary.artifactCount = 5;
  f.save();
  assert.equal(planMonitorReview(f.runDir, f).eligibleArtifacts.length, 0);
  f.summary.artifactCount = 2;
  f.summary.steps.environment.status = 'failed';
  f.save();
  assert.match(planMonitorReview(f.runDir, f).errors.join(), /Environment/);
  f.summary.steps.environment.status = 'ok';
  f.save();
  assert.match(planMonitorReview(f.runDir, { ...f, now: f.now + 8 * 86400_000 }).errors.join(), /stale/);
  f.manifest.runId = 'different';
  f.save();
  assert.match(planMonitorReview(f.runDir, f).errors.join(), /runId/);
});

test('command-stage artifact count is not confused with final supplemental count', (t) => {
  const f = fixture(t);
  f.write(path.basename(f.runDir) + '/command-result.json', { artifactCount: 1 });
  const plan = planMonitorReview(f.runDir, f);
  assert.equal(plan.eligibleArtifacts.length, 1);
  assert.equal(plan.warnings.length, 1);
});

test('archive paths and symlinks may not escape the run directory', (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'outside.json'), '{}');
  fs.unlinkSync(path.join(f.root, f.manifest.artifacts[0].archivePath));
  fs.symlinkSync(path.join(f.root, 'outside.json'), path.join(f.root, f.manifest.artifacts[0].archivePath));
  const plan = planMonitorReview(f.runDir, f);
  assert.match(plan.blockedArtifacts[0].reason, /escapes/);
});

test('weekly degraded sync does not block independently successful news', (t) => {
  const f = fixture(t);
  f.summary.kind = 'weekly';
  f.summary.steps = [
    { name: 'weekly-person-news', status: 'ok', exitCode: 0 },
    { name: 'real-public-data', status: 'ok', exitCode: 0, result: { status: 'degraded' } },
  ];
  f.manifest.artifacts[0].path = 'tmp/weekly-monitor/weekly-person-news.json';
  Object.assign(f.manifest.logs[0], f.write(f.manifest.logs[0].path, { steps: f.summary.steps }));
  f.save();
  const plan = planMonitorReview(f.runDir, f);
  assert.equal(plan.eligibleArtifacts.length, 1);
  assert.equal(plan.blockedSteps[0].name, 'real-public-data');
});
