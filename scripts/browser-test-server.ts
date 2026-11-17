import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSignaling } from '../server/server';

if (existsSync('.env.server')) process.loadEnvFile('.env.server');
const service = createSignaling({
  accessKey: 'browser-test-only-key-not-for-real-use',
  webRoot: resolve('web/dist'),
  stunUrls: ['stun:stun.l.google.com:19302'],
  turnUrls:
    process.env.TURN_SECRET && process.env.TURN_URLS
      ? process.env.TURN_URLS.split(',')
      : undefined,
  turnSecret: process.env.TURN_SECRET || undefined,
});
service.http.listen(8790, '127.0.0.1');
process.on('SIGTERM', () => {
  void service.close().then(() => process.exit(0));
});
process.on('SIGINT', () => {
  void service.close().then(() => process.exit(0));
});
