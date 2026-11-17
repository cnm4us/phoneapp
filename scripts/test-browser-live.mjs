import { spawnSync } from 'node:child_process';

if (!process.env.POC_ACCESS_KEY)
  throw new Error(
    'Load private .env.server before running the public browser check.',
  );
const result = spawnSync(
  process.execPath,
  ['node_modules/@playwright/test/cli.js', 'test'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      PHONEAPP_BROWSER_URL: 'https://phoneapp.bawebtech.com',
    },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
