import { createSignaling } from './server';
import { resolve } from 'node:path';

const urls = (value: string | undefined) => value?.split(',').map((v) => v.trim()).filter(Boolean) ?? [];
const turnUrls = urls(process.env.TURN_URLS);
if (turnUrls.some((url) => !/^turns?:[^\s]+$/.test(url))) throw new Error('TURN_URLS must contain turn: or turns: URLs');
const server = createSignaling({
  accessKey: process.env.POC_ACCESS_KEY ?? '',
  roomTtlMs: Number(process.env.ROOM_TTL_MINUTES ?? 240) * 60_000,
  stunUrls: urls(process.env.STUN_URLS ?? 'stun:stun.l.google.com:19302'),
  turnUrls,
  turnSecret: process.env.TURN_SECRET,
  relayVideoMaxBitrate: Number(process.env.RELAY_VIDEO_MAX_BITRATE ?? 6_000_000),
  ultraEnabled: process.env.ENABLE_EXPERIMENTAL_ULTRA === 'true',
  webRoot: resolve('web/dist'),
  log: (event) => console.log(JSON.stringify({ at: new Date().toISOString(), ...event })),
});
const port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
server.http.listen(port, process.env.HOST ?? '127.0.0.1', () => {
  console.log(JSON.stringify({ event: 'listening', host: process.env.HOST ?? '127.0.0.1', port, turnConfigured: Boolean(turnUrls.length) }));
});
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  if (stopping) return;
  stopping = true;
  void server.close().then(() => process.exit(0));
});
