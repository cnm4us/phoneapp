import {Messages,mediaConfig} from './messages';
import { createSignaling } from './server';
import { resolve } from 'node:path';
import { loadConfiguration,connect } from '../database/connection';
import { status } from '../database/migrate';
import { AccountsStore } from './accounts-store';
import { AccountsApi } from './accounts-api';
import { DeviceAuth, SecretBox } from './device-auth';
import { PushWorker,providerSender } from './push';

async function main() {
let accounts: AccountsApi | undefined;let push:PushWorker|undefined;let messages:Messages|undefined;

const urls = (value: string | undefined) => value?.split(',').map((v) => v.trim()).filter(Boolean) ?? [];
const turnUrls = urls(process.env.TURN_URLS);
if (turnUrls.some((url) => !/^turns?:[^\s]+$/.test(url))) throw new Error('TURN_URLS must contain turn: or turns: URLs');
const server = createSignaling({
  accessKey: process.env.POC_ACCESS_KEY ?? '',
  apiHandler: (req,res) => accounts ? accounts.handle(req,res) : Promise.resolve().then(()=>{res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Account calling is not enabled.'}));}),
  authorizePrivateJoin: (sessionId,callId) => accounts?.store.authorizeMedia(sessionId,callId) ?? Promise.resolve(false),
  privateRoomEnded: callId => accounts?.roomClosed(callId) ?? Promise.resolve(),
  roomTtlMs: Number(process.env.ROOM_TTL_MINUTES ?? 240) * 60_000,
  stunUrls: urls(process.env.STUN_URLS ?? 'stun:stun.l.google.com:19302'),
  turnUrls,
  turnSecret: process.env.TURN_SECRET,
  relayVideoMaxBitrate: Number(process.env.RELAY_VIDEO_MAX_BITRATE ?? 6_000_000),
  ultraEnabled: process.env.ENABLE_EXPERIMENTAL_ULTRA === 'true',
  webRoot: resolve('web/dist'),
  log: (event) => console.log(JSON.stringify({ at: new Date().toISOString(), ...event })),
});
if(process.env.ENABLE_ACCOUNT_CALLS === 'true') {
  loadConfiguration();
  const db=await connect('dev');
  try { if((await status(db)).pending.length)throw new Error('Apply database migrations before enabling account calls'); } finally {await db.end();}
  const store=new AccountsStore('dev');
  const devices=process.env.ENABLE_NATIVE_CALLS==='true'?new DeviceAuth(store,new SecretBox(Buffer.from(process.env.PUSH_TOKEN_ENCRYPTION_KEY??'','hex'))):undefined;
  if(process.env.ENABLE_AUDIO_MESSAGES==='true'){messages=new Messages(store,mediaConfig(process.env));await messages.init();messages.start();}
  accounts=new AccountsApi(store,server,()=>console.error(JSON.stringify({event:'account-operation-failed'})),devices,messages);
  if(devices){push=new PushWorker(store,devices.box,providerSender(process.env));push.start();}
  await accounts.start();
}
const port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
server.http.listen(port, process.env.HOST ?? '127.0.0.1', () => {
  console.log(JSON.stringify({ event: 'listening', host: process.env.HOST ?? '127.0.0.1', port, turnConfigured: Boolean(turnUrls.length) }));
});
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  if (stopping) return;
  stopping = true;push?.stop();
  void Promise.resolve(messages?.stop()).then(()=>accounts?.stop()).then(()=>server.close()).then(() => process.exit(0)).catch(()=>{console.error(JSON.stringify({event:"shutdown-failed"}));process.exit(1);});
});

}
main().catch(()=>{console.error(JSON.stringify({event:"startup-failed",message:"Check configuration and database migration status; no secrets logged."}));process.exit(1);});
