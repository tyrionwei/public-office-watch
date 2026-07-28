import { spawnSync } from 'node:child_process';

const checks = [
  { label: 'check:production-env', command: ['npm', 'run', 'check:production-env'] },
  { label: 'build:sites', command: ['npm', 'run', 'build:sites'] },
  { label: 'lint', command: ['npm', 'run', 'lint'] },
  { label: 'check:data-boundary', command: ['npm', 'run', 'check:data-boundary'] },
  { label: 'smoke:public-views', command: ['npm', 'run', 'smoke:public-views'] },
  { label: 'check:public-view-contracts', command: ['npm', 'run', 'check:public-view-contracts'] },
];

for (const check of checks) {
  console.log(`\n>>> Running ${check.label}`);
  const [command, ...args] = check.command;
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('\nProduction readiness checks passed.');
