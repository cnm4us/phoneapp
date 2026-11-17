import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';

if (existsSync('.env.server')) {
  console.log('.env.server already exists; leaving it unchanged.');
} else {
  const random = () => randomBytes(32).toString('base64url');
  writeFileSync('.env.server', [
    `POC_ACCESS_KEY=${random()}`,
    'HOST=127.0.0.1', 'PORT=8787',
    'STUN_URLS=stun:stun.l.google.com:19302',
    'TURN_URLS=turn:phoneapp.bawebtech.com:3478?transport=udp,turn:phoneapp.bawebtech.com:3478?transport=tcp,turns:phoneapp.bawebtech.com:5349?transport=tcp',
    `TURN_SECRET=${random()}`, '',
  ].join('\n'), { mode: 0o600, flag: 'wx' });
  console.log('Created private .env.server (mode 600). No secret values were printed.');
}
