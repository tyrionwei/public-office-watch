import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export function sites(): Plugin {
  let root = '';

  return {
    name: 'sites',
    apply: 'build',
    configResolved(config) {
      root = config.root;
    },
    closeBundle() {
      const outputDirectory = path.resolve(root, 'dist', '.openai');
      const hostingConfig = path.resolve(root, '.openai', 'hosting.json');
      const drizzleSource = path.resolve(root, 'drizzle');

      fs.rmSync(outputDirectory, { recursive: true, force: true });
      fs.mkdirSync(outputDirectory, { recursive: true });

      if (fs.existsSync(hostingConfig)) {
        fs.cpSync(hostingConfig, path.resolve(outputDirectory, 'hosting.json'));
      }
      if (fs.existsSync(drizzleSource)) {
        fs.cpSync(drizzleSource, path.resolve(outputDirectory, 'drizzle'), { recursive: true });
      }
    },
  };
}
