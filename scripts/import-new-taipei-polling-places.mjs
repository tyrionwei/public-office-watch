import { main } from './import-2026-polling-places.mjs';

main(['--county-code', '65000', ...process.argv.slice(2)]).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
