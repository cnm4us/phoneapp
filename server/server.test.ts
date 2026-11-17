import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import { WebSocket } from 'ws';
import { createSignaling, type Options } from './server';
import type { Invitation, ServerMessage } from '../shared/protocol';

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
  const connect = async (invite?: Invitation) => {
    const socket = new WebSocket(`${base.replace('http', 'ws')}/signal`);
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
