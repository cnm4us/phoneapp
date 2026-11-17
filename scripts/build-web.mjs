import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';

await mkdir('web/dist', { recursive: true });
await build({
  entryPoints: ['web/main.ts'],
  outfile: 'web/dist/app.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['safari16', 'chrome110', 'firefox115'],
  minify: true,
});
await Promise.all(
  ['index.html', 'styles.css'].map((name) =>
    copyFile(`web/${name}`, `web/dist/${name}`),
  ),
);
console.log('Built browser companion in web/dist (no credentials embedded).');
