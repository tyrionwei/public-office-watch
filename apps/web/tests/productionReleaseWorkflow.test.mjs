import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../../../.github/workflows/production-release.yml', import.meta.url), 'utf8');

test('starts production deployment only after a successful main Web CI run', () => {
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /workflows:\s*\n\s*- Web CI/);
  assert.match(workflow, /types:\s*\n\s*- completed/);
  assert.match(workflow, /branches:\s*\n\s*- main/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /workflow_run\.event == 'push'/);
  assert.match(workflow, /workflow_run\.head_repository\.full_name == github\.repository/);
});

test('checks out the exact CI commit and reruns duplicated checks only for manual fallback', () => {
  assert.match(workflow, /RELEASE_SHA:.*workflow_run\.head_sha.*github\.sha/);
  assert.match(workflow, /ref: \$\{\{ env\.RELEASE_SHA \}\}/);
  for (const name of ['Test read contracts', 'Lint']) {
    const step = new RegExp(`- name: ${name}\\n\\s+if: github\\.event_name == 'workflow_dispatch'`);
    assert.match(workflow, step);
  }
});

test('skips a stale release before browser installation and deployment', () => {
  const staleGate = workflow.indexOf('- name: Check release commit is current main');
  const browserInstall = workflow.indexOf('- name: Install Playwright Chromium');
  const deploy = workflow.indexOf('- name: Deploy Cloudflare Worker');

  assert.ok(staleGate >= 0 && staleGate < browserInstall && browserInstall < deploy);
  assert.match(workflow, /git fetch --no-tags --depth=1 origin main/);
  assert.match(workflow, /if: steps\.release\.outputs\.current == 'true'\n\s+run: npx wrangler deploy/);
  assert.match(workflow, /- name: Run post-deploy production smoke\n\s+if: steps\.release\.outputs\.current == 'true'/);
});
