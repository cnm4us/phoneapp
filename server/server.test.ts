import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import { resolve } from 'node:path';
import { WebSocket } from 'ws';
import { createSignaling, type Options } from './server';
import type { Invitation, ServerMessage } from '../shared/protocol';
import { limitOnly, PRESETS } from '../src/call/quality';
import { resolveInvitation } from '../src/call/core';

const key = 'unit-test-only-key-not-for-real-use';
class Client {
  messages: ServerMessage[] = [];
  private waiters = new Set<() => void>();
  constructor(readonly socket: WebSocket) {
    socket.on('message', (raw) => { this.messages.push(JSON.parse(raw.toString())); for (const notify of this.waiters) notify(); });
    socket.on('error', () => {});
  }
  send(value: unknown) { this.socket.send(JSON.stringify(value)); }
  async next<T extends ServerMessage['type']>(type: T): Promise<Extract<ServerMessage, { type: T }>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.waiters.delete(check); reject(new Error(`Timed out waiting for ${type}`)); }, 2_000);
      const check = () => {
        const i = this.messages.findIndex((m) => m.type === type);
        if (i < 0) return;
        clearTimeout(timer); this.waiters.delete(check);
        resolve(this.messages.splice(i, 1)[0] as Extract<ServerMessage, { type: T }>);
      };
      this.waiters.add(check); check();
    });
  }
}
async function fixture(t: TestContext, options: Partial<Options> = {}) {
  const service = createSignaling({ accessKey: key, ...options });
  service.http.listen(0, '127.0.0.1');
  await once(service.http, 'listening');
  t.after(() => service.close());
  const address = service.http.address();
  assert(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const create = async () => {
    const res = await fetch(`${base}/rooms`, { method: 'POST', headers: { Authorization: `Bearer ${key}` } });
    assert.equal(res.status, 201);
    return await res.json() as Invitation;
  };
  const connect = async (invite?: Invitation, autoPong = true) => {
    const socket = new WebSocket(`${base.replace('http', 'ws')}/signal`, { autoPong });
    const client = new Client(socket);
    await once(socket, 'open');
    if (invite) client.send({ type: 'join', roomId: invite.roomId, token: invite.token });
    return client;
  };
  return { base, create, connect };
}

test('health is public; room creation requires a private access key and does not leak it', async (t) => {
  const f = await fixture(t);
  const health = await (await fetch(`${f.base}/health`)).json();
  assert.deepEqual(health, { ok: true, service: 'phoneapp-signaling', turnConfigured: false });
  assert.equal((await fetch(`${f.base}/rooms`, { method: 'POST' })).status, 401);
  assert.equal((await fetch(`${f.base}/rooms`, { method: 'POST', headers: { Authorization: 'Bearer wrong' } })).status, 401);
  assert.equal((await fetch(`${f.base}/unknown`)).status, 404);
});

test('short code resolution returns the same legacy capability, preserves two-peer limits, and expires on departure', async t => {
  const f = await fixture(t), invite = await f.create();
  assert.match(invite.code!, /^\d{8}$/);
  const resolved = await resolveInvitation(f.base, `${invite.code!.slice(0, 4)} ${invite.code!.slice(4)}`);
  assert.deepEqual(resolved, { roomId: invite.roomId, token: invite.token });
  const a = await f.connect({ ...resolved, expiresAt: invite.expiresAt }); await a.next('joined');
  const b = await f.connect(invite); await b.next('joined');
  const third = await f.connect(invite); assert.equal((await third.next('error')).code, 'room-full');
  a.send({ type: 'leave' }); await b.next('peer-left');
  const response = await fetch(`${f.base}/rooms/resolve`, { method: 'POST', body: JSON.stringify({ code: invite.code }) });
  assert.equal(response.status, 404);
});

test('code lookup bounds input and guesses, never returns credentials for an unknown code, and resets after a minute', async t => {
  let time = Date.now();
  const f = await fixture(t, { now: () => time }), invite = await f.create();
  const lookup = (body: unknown) => fetch(`${f.base}/rooms/resolve`, { method: 'POST', body: JSON.stringify(body) });
  const invalid = invite.code === '00000000' ? '11111111' : '00000000';
  const unknown = await lookup({ code: invalid }); assert.equal(unknown.status, 404); assert(!(await unknown.text()).includes(invite.token));
  assert.equal((await lookup({ code: invite.code, to: 'another-room' })).status, 400);
  assert.equal((await lookup({ code: '1'.repeat(300) })).status, 413);
  for (let i = 0; i < 27; i++) assert.equal((await lookup({ code: invalid })).status, 404);
  assert.equal((await lookup({ code: invite.code })).status, 429);
  time += 60_001;
  assert.equal((await lookup({ code: invite.code })).status, 200);
});

test('default four-hour room survives a 6:50 call and expires exactly at its deadline; TURN matches that deadline', async t => {
  let time = Date.now();
  const f = await fixture(t, { now: () => time, turnUrls: ['turn:relay.invalid:3478'], turnSecret: 'synthetic-secret' });
  const invite = await f.create();
  assert.equal(invite.expiresAt - time, 4 * 60 * 60_000);
  const client = await f.connect(invite), joined = await client.next('joined');
  assert.equal(Number(joined.iceServers[0].username!.split(':')[0]), Math.ceil(invite.expiresAt / 1000) + 60);
  time += 410_000; await fetch(`${f.base}/health`); assert.equal(client.socket.readyState, WebSocket.OPEN);
  time = invite.expiresAt - 1; await fetch(`${f.base}/health`); assert.equal(client.socket.readyState, WebSocket.OPEN);
  time++; await fetch(`${f.base}/health`); assert.equal((await client.next('error')).code, 'expired');
  assert.equal((await fetch(`${f.base}/rooms/resolve`, { method: 'POST', body: JSON.stringify({ code: invite.code }) })).status, 404);
  assert.throws(() => createSignaling({ accessKey: key, roomTtlMs: NaN }), /eight hours/);
  assert.throws(() => createSignaling({ accessKey: key, roomTtlMs: 9 * 60 * 60_000 }), /eight hours/);
});

test('disconnect logs distinguish explicit leave and transport closure without copying client reason text', async t => {
  const logs: Record<string, unknown>[] = [], f = await fixture(t, { log: e => logs.push(e) });
  for (const explicit of [true, false]) {
    const invite = await f.create(), a = await f.connect(invite); await a.next('joined');
    const b = await f.connect(invite); await b.next('joined');
    if (explicit) a.send({ type: 'leave' }); else a.socket.close(1001, 'private-client-reason-never-log');
    await b.next('peer-left');
    const ended = logs.filter(e => e.event === 'room-ended').at(-1)!;
    assert.equal(ended.cause, explicit ? 'participant-left' : 'connection-closed');
    assert.equal(ended.closeCode, explicit ? 1000 : 1001);
  }
  assert(!JSON.stringify(logs).includes('private-client-reason-never-log'));
});

test('one missed heartbeat is tolerated; two consecutive misses end a stale connection with a clear cause', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const logs: Record<string, unknown>[] = [], f = await fixture(t, { log: e => logs.push(e) });
  const client = await f.connect(await f.create(), false); await client.next('joined');
  for (let i = 0; i < 2; i++) {
    const ping = once(client.socket, 'ping'); t.mock.timers.tick(15_000); await ping;
    assert.equal(client.socket.readyState, WebSocket.OPEN);
  }
  const closed = once(client.socket, 'close'); t.mock.timers.tick(15_000); await closed;
  assert.equal(logs.filter(e => e.event === 'room-ended').at(-1)!.cause, 'heartbeat-timeout');
});

test('two peers exchange offer, answer, and early ICE; third peer cannot join', async (t) => {
  const f = await fixture(t), invite = await f.create();
  const a = await f.connect(invite), aj = await a.next('joined');
  assert.equal(aj.initiator, true);
  const b = await f.connect(invite), bj = await b.next('joined');
  assert.equal(bj.initiator, false); assert.equal(bj.sessionId, aj.sessionId);
  await a.next('ready'); await b.next('ready');
  const third = await f.connect(invite);
  assert.equal((await third.next('error')).code, 'room-full');
  a.send({ type: 'ice', candidate: { candidate: 'candidate:test', sdpMid: '0', sdpMLineIndex: 0 } });
  assert.equal((await b.next('ice')).candidate.candidate, 'candidate:test');
  a.send({ type: 'offer', description: { type: 'offer', sdp: 'synthetic-offer' } });
  assert.equal((await b.next('offer')).description.sdp, 'synthetic-offer');
  b.send({ type: 'answer', description: { type: 'answer', sdp: 'synthetic-answer' } });
  assert.equal((await a.next('answer')).description.sdp, 'synthetic-answer');
  b.send({ type: 'leave' });
  await a.next('peer-left');
});

test('wrong token, unknown room, and expired invitations cannot join', async (t) => {
  let time = Date.now();
  const f = await fixture(t, { now: () => time, roomTtlMs: 100 });
  const invite = await f.create();
  for (const invalid of [{ ...invite, token: 'x'.repeat(32) }, { ...invite, roomId: 'x'.repeat(12) }]) {
    const client = await f.connect(invalid);
    assert.equal((await client.next('error')).code, 'invalid-invite');
  }
  time += 101;
  const expired = await f.connect(invite);
  assert.equal((await expired.next('error')).code, 'invalid-invite');
});

test('active rooms expire and notify participants', async (t) => {
  let time = Date.now();
  const f = await fixture(t, { now: () => time, roomTtlMs: 100 });
  const client = await f.connect(await f.create());
  await client.next('joined');
  time += 101;
  await fetch(`${f.base}/health`);
  assert.equal((await client.next('error')).code, 'expired');
});

test('malformed messages, spoofed routing, binary payloads, and unjoined signaling are rejected', async (t) => {
  const f = await fixture(t);
  const values = ['not-json', JSON.stringify({ type: 'join', roomId: 'a'.repeat(12), token: 'b'.repeat(32), to: 'another-room' }), JSON.stringify({ type: 'ice', candidate: { candidate: 42, sdpMid: null, sdpMLineIndex: null } })];
  for (const raw of values) {
    const c = await f.connect(); c.socket.send(raw);
    assert.equal((await c.next('error')).code, 'invalid-message');
  }
  const binary = await f.connect(); binary.socket.send(Buffer.from('{}'));
  assert.equal((await binary.next('error')).code, 'invalid-message');
  const unjoined = await f.connect(); unjoined.send({ type: 'offer', description: { type: 'offer', sdp: 'synthetic' } });
  assert.equal((await unjoined.next('error')).code, 'not-joined');
});

test('wrong peer cannot send the offer and closed rooms cannot be reused', async (t) => {
  const f = await fixture(t), invite = await f.create();
  const a = await f.connect(invite); await a.next('joined');
  const b = await f.connect(invite); await b.next('joined');
  b.send({ type: 'offer', description: { type: 'offer', sdp: 'wrong-peer' } });
  assert.equal((await b.next('error')).code, 'unexpected-offer');
  await a.next('peer-left');
  const again = await f.connect(invite);
  assert.equal((await again.next('error')).code, 'invalid-invite');
  const fresh = await f.connect(await f.create());
  assert.equal((await fresh.next('joined')).initiator, true);
});

test('departed peers release room capacity and do not interfere with other rooms', async (t) => {
  const f = await fixture(t, { maxRooms: 2 });
  const first = await f.create(), second = await f.create();
  const a = await f.connect(first); await a.next('joined');
  const b = await f.connect(second); await b.next('joined');
  assert.equal((await fetch(`${f.base}/rooms`, { method: 'POST', headers: { Authorization: `Bearer ${key}` } })).status, 429);
  const closed = once(a.socket, 'close'); a.socket.close(); await closed;
  await f.create();
  assert.equal(b.socket.readyState, WebSocket.OPEN);
});

test('oversized frames are closed without process failure', async (t) => {
  const f = await fixture(t), client = await f.connect();
  const closed = once(client.socket, 'close');
  client.socket.send('x'.repeat(70_000));
  const [code] = await closed;
  assert.equal(code, 1009);
  assert.equal((await fetch(`${f.base}/health`)).status, 200);
});

test('TURN master secret stays server-side; joined peers receive bounded HMAC credentials', async (t) => {
  const secret = 'test-turn-secret';
  const f = await fixture(t, { turnUrls: ['turn:relay.invalid:3478?transport=udp'], turnSecret: secret });
  const invite = await f.create(), c = await f.connect(invite), joined = await c.next('joined');
  assert.equal(joined.turnConfigured, true);
  const ice = joined.iceServers[0];
  assert.equal(ice.credential, createHmac('sha1', secret).update(ice.username!).digest('base64'));
  assert.equal(Number(ice.username!.split(':')[0]), Math.ceil(invite.expiresAt / 1000) + 60);
  assert(!JSON.stringify(joined).includes(secret));
});

test('incomplete TURN config and weak access keys fail startup', () => {
  assert.throws(() => createSignaling({ accessKey: 'short' }), /24/);
  assert.throws(() => createSignaling({ accessKey: key, turnUrls: ['turn:relay.invalid'] }), /together/);
});

test('quality capability handshake preserves legacy peers and scopes validated, revisioned policies', async t => {
  const f = await fixture(t), invite = await f.create();
  const a = await f.connect(invite), joined = await a.next('joined');
  assert.equal(joined.protocolVersion, 2); assert.equal(joined.relayVideoMaxBitrate, 6_000_000); assert.equal(joined.ultraEnabled, false);
  a.send({ type: 'capabilities', version: 2 });
  const b = await f.connect(invite); await b.next('joined'); await a.next('ready'); await b.next('ready');
  // The legacy peer sees only the existing ready event, no new control events.
  assert(!b.messages.some(m => m.type === 'peer-capabilities'));
  b.send({ type: 'capabilities', version: 2 }); await a.next('peer-capabilities'); await b.next('peer-capabilities');
  const policy = { type: 'media-policy', revision: 2, receive: limitOnly(PRESETS.saver), audioOnly: false, pauseIncoming: false };
  a.send(policy); assert.deepEqual(await b.next('media-policy'), policy);
  a.send({ ...policy, revision: 1 });
  a.send({ type: 'ice', candidate: { candidate: 'barrier', sdpMid: null, sdpMLineIndex: 0 } }); await b.next('ice');
  assert(!b.messages.some(m => m.type === 'media-policy'));
  b.send({ type: 'policy-applied', revision: 2, applied: limitOnly(PRESETS.saver), videoPaused: false, supported: true });
  assert.equal((await a.next('policy-applied')).revision, 2);
});

test('quality messages reject non-finite/out-of-range limits and spoofed routing', async t => {
  const f = await fixture(t);
  for (const extra of [{ receive: { ...limitOnly(PRESETS.auto), bitrate: null } }, { receive: { ...limitOnly(PRESETS.auto), fps: 120 } }, { to: 'another-room' }]) {
    const a = await f.connect(await f.create()); await a.next('joined');
    a.send({ type: 'media-policy', revision: 1, receive: limitOnly(PRESETS.auto), audioOnly: false, pauseIncoming: false, ...extra });
    assert.equal((await a.next('error')).code, 'invalid-message');
  }
});

test('renegotiation is serialized through the original offerer; simultaneous requests queue safely', async t => {
  const f = await fixture(t), invite = await f.create();
  const a = await f.connect(invite); await a.next('joined'); a.send({ type: 'capabilities', version: 2 });
  const b = await f.connect(invite); await b.next('joined'); b.send({ type: 'capabilities', version: 2 });
  await a.next('ready'); await b.next('ready'); await a.next('peer-capabilities'); await b.next('peer-capabilities');
  const exchange = async (negotiationId?: number) => {
    const id = negotiationId ? { negotiationId } : {};
    a.send({ type: 'offer', description: { type: 'offer', sdp: 'synthetic-offer' }, ...id }); await b.next('offer');
    b.send({ type: 'answer', description: { type: 'answer', sdp: 'synthetic-answer' }, ...id }); await a.next('answer');
  };
  await exchange();
  a.send({ type: 'renegotiate' }); const first = await a.next('negotiate');
  b.send({ type: 'renegotiate' });
  await exchange(first.negotiationId);
  const second = await a.next('negotiate'); assert.equal(second.negotiationId, first.negotiationId + 1);
  await exchange(second.negotiationId);
  assert(!b.messages.some(m => m.type === 'negotiate'));
});

test('browser assets have correct types and headers; arbitrary project files stay inaccessible', async (t) => {
  const f = await fixture(t, { webRoot: resolve('web/dist') });
  for (const [path, type] of [['/', 'text/html'], ['/app.js', 'text/javascript'], ['/styles.css?version=test', 'text/css']]) {
    const response = await fetch(`${f.base}${path}`);
    assert.equal(response.status, 200);
    assert(response.headers.get('content-type')?.includes(type));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert(response.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"));
    const contents = await response.text();
    assert(contents.length > 0);
    assert(!contents.includes(key));
  }
  for (const path of ['/.env.server', '/server/server.ts', '/app.config.ts', '/web/main.ts']) assert.equal((await fetch(`${f.base}${path}`)).status, 404);
  const head = await fetch(`${f.base}/`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});
