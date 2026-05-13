import { spawnSync } from 'node:child_process';

const checks = [
  { label: 'build', command: ['npm', 'run', 'build'] },
  { label: 'lint', command: ['npm', 'run', 'lint'] },
  { label: 'check:data-boundary', command: ['npm', 'run', 'check:data-boundary'] },
  { label: 'smoke:public-views', command: ['npm', 'run', 'smoke:public-views'], skippable: true },
  { label: 'check:public-view-contracts', command: ['npm', 'run', 'check:public-view-contracts'], skippable: true },
];

let skippedEnvSensitiveCheck = false;

for (const check of checks) {
  console.log(`\n>>> Running ${check.label}`);
  const [command, ...args] = check.command;
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  if (result.status === 0) {
    continue;
  }

  if (check.skippable) {
    skippedEnvSensitiveCheck = true;
    continue;
  }

  process.exit(result.status ?? 1);
}

if (skippedEnvSensitiveCheck) {
  console.log('\nReminder: production enable still requires local anon env validation for smoke and public view contract checks.');
}
