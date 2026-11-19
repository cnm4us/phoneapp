// End-to-end HTTPS/WebSocket signaling check. Does not capture or validate media.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { endpoint } from '../src/call/core';
import type { Invitation, ServerMessage } from '../shared/protocol';

async function main() {
  const base = endpoint(process.argv[2] || 'https://phoneapp.bawebtech.com');
  const key = process.env.POC_ACCESS_KEY;
  assert(key, 'Load .env.server to supply POC_ACCESS_KEY');
  const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(10_000) });
  assert.equal(health.status, 200);
  const response = await fetch(`${base}/rooms`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, 201);
  const invite = await response.json() as Invitation;
  const sockets: WebSocket[] = [];
  const connect = async () => {
    const socket = new WebSocket(`${base.replace(/^http/, 'ws')}/signal`, { handshakeTimeout: 10_000 });
    sockets.push(socket);
    const messages: ServerMessage[] = [];
    socket.on('message', (data) => messages.push(JSON.parse(data.toString())));
    socket.on('error', () => {});
    await once(socket, 'open');
    socket.send(JSON.stringify({ type: 'join', roomId: invite.roomId, token: invite.token }));
    return { socket, messages };
  };
  const wait = async (messages: ServerMessage[], type: string) => {
    const until = Date.now() + 10_000;
    while (Date.now() < until) {
      const message = messages.find((m) => m.type === type);
      if (message) return message;
      if (messages.some((m) => m.type === 'error')) throw new Error('Server rejected test session');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Timeout waiting for ${type}`);
  };
  try {
    const a = await connect(), b = await connect();
    const joined = await wait(a.messages, 'joined');
    await wait(b.messages, 'joined');
    await wait(a.messages, 'ready'); await wait(b.messages, 'ready');
    a.socket.send(JSON.stringify({ type: 'offer', description: { type: 'offer', sdp: 'synthetic-smoke-offer-no-media' } }));
    await wait(b.messages, 'offer');
    b.socket.send(JSON.stringify({ type: 'answer', description: { type: 'answer', sdp: 'synthetic-smoke-answer-no-media' } }));
    await wait(a.messages, 'answer');
    a.socket.send(JSON.stringify({ type: 'leave' }));
    await wait(b.messages, 'peer-left');
    console.log(JSON.stringify({ result: 'PASS', endpoint: base, sessionId: joined.type === 'joined' ? joined.sessionId : undefined, checks: ['HTTPS health', 'authorized room creation', 'two WSS peers', 'offer/answer', 'hangup'], mediaTested: false }));
  } finally { for (const socket of sockets) socket.terminate(); }
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : 'Smoke check failed'); process.exitCode = 1; });
