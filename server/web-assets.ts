import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadWebAssets(directory: string) {
  const assets = new Map<string, { body: Buffer; contentType: string }>();
  for (const [path, filename, contentType] of [
    ['/', 'index.html', 'text/html; charset=utf-8'],
    ['/app.js', 'app.js', 'text/javascript; charset=utf-8'],
    ['/styles.css', 'styles.css', 'text/css; charset=utf-8'],
  ])
    assets.set(path, {
      body: readFileSync(join(directory, filename)),
      contentType,
    });
  return assets;
}

export const webHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=(self), display-capture=()',
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self' ws: wss:; media-src 'self' blob:; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};
