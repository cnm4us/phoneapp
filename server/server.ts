import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import type { ClientMessage, IceServer, ServerMessage } from '../shared/protocol';
import { loadWebAssets, webHeaders } from './web-assets';
import { validLimit } from '../src/call/quality';

export interface Options {
  accessKey: string;
  roomTtlMs?: number;
  maxRooms?: number;
  now?: () => number;
  stunUrls?: string[];
  turnUrls?: string[];
  turnSecret?: string;
  log?: (event: Record<string, unknown>) => void;
  webRoot?: string;
  relayVideoMaxBitrate?: number;
  ultraEnabled?: boolean;
}
type Peer = { socket: WebSocket; alive: boolean; roomId?: string; initiator?: boolean; count: number; window: number; version?: 2; revision?: number; controlCount?: number };
type Room = { token: string; sessionId: string; expiresAt: number; peers: Set<Peer>; phase: 'waiting' | 'ready' | 'offered' | 'answered'; negotiationId?: number; queued?: boolean; negotiatingAt?: number; warned?: boolean };

const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every((k) => allowed.includes(k));
const equal = (a: string, b: string) => Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const revision = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 1_000_000_000;

function parseMessage(raw: string): ClientMessage {
  const v: unknown = JSON.parse(raw);
  if (!object(v) || typeof v.type !== 'string') throw new Error('Invalid message');
  if (v.type === 'join' && keys(v, ['type', 'roomId', 'token']) && typeof v.roomId === 'string' && /^[A-Za-z0-9_-]{12}$/.test(v.roomId) && typeof v.token === 'string' && /^[A-Za-z0-9_-]{32}$/.test(v.token)) return v as ClientMessage;
  if (v.type === 'leave' && keys(v, ['type'])) return { type: 'leave' };
  if (v.type === 'capabilities' && keys(v, ['type', 'version']) && v.version === 2) return { type: 'capabilities', version: 2 };
  if ((v.type === 'renegotiate' || v.type === 'request-video') && keys(v, ['type'])) return v as ClientMessage;
  if (v.type === 'media-policy' && keys(v, ['type', 'revision', 'receive', 'audioOnly', 'pauseIncoming']) && revision(v.revision) && validLimit(v.receive) && typeof v.audioOnly === 'boolean' && typeof v.pauseIncoming === 'boolean') return v as ClientMessage;
  if (v.type === 'policy-applied' && keys(v, ['type', 'revision', 'applied', 'videoPaused', 'supported']) && revision(v.revision) && validLimit(v.applied) && typeof v.videoPaused === 'boolean' && typeof v.supported === 'boolean') return v as ClientMessage;
  if ((v.type === 'offer' || v.type === 'answer') && keys(v, ['type', 'description', 'negotiationId']) && (v.negotiationId === undefined || revision(v.negotiationId)) && object(v.description) && keys(v.description, ['type', 'sdp']) && v.description.type === v.type && typeof v.description.sdp === 'string' && v.description.sdp.length > 0 && v.description.sdp.length <= 48_000) return v as ClientMessage;
  if (v.type === 'ice' && keys(v, ['type', 'candidate']) && object(v.candidate) && keys(v.candidate, ['candidate', 'sdpMid', 'sdpMLineIndex'])) {
    const c = v.candidate;
    if (typeof c.candidate === 'string' && c.candidate.length <= 4_000 && (c.sdpMid === null || (typeof c.sdpMid === 'string' && c.sdpMid.length < 256)) && (c.sdpMLineIndex === null || (typeof c.sdpMLineIndex === 'number' && Number.isInteger(c.sdpMLineIndex) && c.sdpMLineIndex >= 0 && c.sdpMLineIndex < 64))) return v as ClientMessage;
  }
  throw new Error('Invalid message');
}

export function createSignaling(options: Options) {
  if (options.accessKey.length < 24) throw new Error('POC_ACCESS_KEY must contain at least 24 characters');
  if (Boolean(options.turnUrls?.length) !== Boolean(options.turnSecret)) throw new Error('Configure TURN_URLS and TURN_SECRET together');
  const relayVideoMaxBitrate = options.relayVideoMaxBitrate ?? 6_000_000;
  if (!Number.isFinite(relayVideoMaxBitrate) || relayVideoMaxBitrate < 150_000 || relayVideoMaxBitrate > 30_000_000) throw new Error('Invalid relay video ceiling');
  const ttl = options.roomTtlMs ?? 30 * 60_000;
  if (ttl < 1 || ttl > 60 * 60_000) throw new Error('Room lifetime must be at most one hour');
  const now = options.now ?? Date.now;
  const rooms = new Map<string, Room>();
  const peers = new Set<Peer>();
  const log = options.log ?? (() => {});
  const turnConfigured = Boolean(options.turnUrls?.length && options.turnSecret);
  const assets = options.webRoot ? loadWebAssets(options.webRoot) : undefined;
  let createWindow = now();
  let creates = 0;
  const send = (p: Peer, message: ServerMessage) => {
    if (p.socket.readyState === WebSocket.OPEN) p.socket.send(JSON.stringify(message));
  };
  const reject = (p: Peer, code: string, message: string) => {
    send(p, { type: 'error', code, message });
    p.socket.close(1008, code);
  };
  const modern = (room: Room) => room.peers.size === 2 && [...room.peers].every(peer => peer.version === 2);
  const negotiate = (room: Room) => {
    if (!modern(room)) return;
    if (room.phase !== 'answered') { room.queued = true; return; }
    room.queued = false;
    room.phase = 'ready';
    room.negotiationId = (room.negotiationId ?? 0) + 1;
    room.negotiatingAt = now(); room.warned = false;
    const offerer = [...room.peers].find(peer => peer.initiator)!;
    send(offerer, { type: 'negotiate', negotiationId: room.negotiationId });
  };
  const expire = () => {
    for (const [id, room] of rooms) {
      if (room.negotiatingAt !== undefined && !room.warned && now() - room.negotiatingAt > 15_000) {
        room.warned = true;
        for (const p of room.peers) if (p.version === 2) send(p, { type: 'quality-warning', message: 'Video negotiation is taking longer than expected. Audio can continue; start a new room if video cannot resume.' });
      }
      if (room.expiresAt > now()) continue;
      rooms.delete(id);
      for (const p of room.peers) reject(p, 'expired', 'This invitation has expired. Create a new room.');
      log({ event: 'room-expired', sessionId: room.sessionId });
    }
  };
  const iceServers = (room: Room): IceServer[] => {
    const result: IceServer[] = [];
    if (options.stunUrls?.length) result.push({ urls: options.stunUrls });
    if (turnConfigured) {
      // Coturn REST shared-secret credentials. Valid for the bounded room lifetime.
      const username = `${Math.ceil(room.expiresAt / 1000) + 60}:${room.sessionId}`;
      result.push({ urls: options.turnUrls!, username, credential: createHmac('sha1', options.turnSecret!).update(username).digest('base64') });
    }
    return result;
  };
  const json = (res: ServerResponse, code: number, value: unknown) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(value));
  };
  const authorized = (req: IncomingMessage) => equal(req.headers.authorization ?? '', `Bearer ${options.accessKey}`);
  const http = createServer((req, res) => {
    expire();
    const asset = assets?.get((req.url ?? '').split('?')[0]);
    if (asset && (req.method === 'GET' || req.method === 'HEAD')) {
      res.writeHead(200, { ...webHeaders, 'Content-Type': asset.contentType });
      res.end(req.method === 'HEAD' ? undefined : asset.body);
      return;
    }
    if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true, service: 'phoneapp-signaling', turnConfigured });
    if (req.method !== 'POST' || req.url !== '/rooms') return json(res, 404, { error: 'Not found' });
    if (!authorized(req)) return json(res, 401, { error: 'Test access key required' });
    if (now() - createWindow >= 60_000) { createWindow = now(); creates = 0; }
    if (++creates > 30 || rooms.size >= (options.maxRooms ?? 100)) return json(res, 429, { error: 'Too many rooms; try again later' });
    const roomId = randomBytes(9).toString('base64url');
    const room = { token: randomBytes(24).toString('base64url'), sessionId: randomUUID(), expiresAt: now() + ttl, peers: new Set<Peer>(), phase: 'waiting' as const };
    rooms.set(roomId, room);
    log({ event: 'room-created', sessionId: room.sessionId, expiresAt: room.expiresAt });
    return json(res, 201, { roomId, token: room.token, expiresAt: room.expiresAt });
  });
  http.headersTimeout = 10_000;
  http.requestTimeout = 10_000;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: false });
  http.on('upgrade', (req, socket, head) => {
    if (req.url !== '/signal' || peers.size >= 100) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
  });
  wss.on('connection', (socket: WebSocket) => {
    const p: Peer = { socket, alive: true, count: 0, window: now() };
    peers.add(p);
    const joinDeadline = setTimeout(() => reject(p, 'join-timeout', 'Join a room first.'), 10_000);
    joinDeadline.unref();
    socket.on('pong', () => { p.alive = true; });
    socket.on('error', () => { /* Close performs cleanup; payloads/credentials are never logged. */ });
    socket.on('close', () => {
      clearTimeout(joinDeadline);
      peers.delete(p);
      if (!p.roomId) return;
      const room = rooms.get(p.roomId);
      if (!room) return;
      // A departed participant ends the room. Avoid reusing stale peer negotiation.
      rooms.delete(p.roomId);
      room.peers.delete(p);
      for (const other of room.peers) {
        send(other, { type: 'peer-left' });
        other.socket.close(1000, 'peer-left');
      }
      log({ event: 'room-ended', sessionId: room.sessionId });
    });
    socket.on('message', (raw, binary) => {
      expire();
      if (now() - p.window >= 1_000) { p.window = now(); p.count = 0; p.controlCount = 0; }
      if (++p.count > 100) return reject(p, 'rate-limit', 'Too many messages');
      let m: ClientMessage;
      try { if (binary) throw new Error(); m = parseMessage(raw.toString()); }
      catch { return reject(p, 'invalid-message', 'Invalid signaling message'); }
      if (m.type === 'join') {
        if (p.roomId) return reject(p, 'already-joined', 'Already in a room');
        const room = rooms.get(m.roomId);
        if (!room || !equal(room.token, m.token)) return reject(p, 'invalid-invite', 'Invitation is invalid or expired.');
        if (room.peers.size >= 2) return reject(p, 'room-full', 'This room already has two participants.');
        p.roomId = m.roomId;
        p.initiator = room.peers.size === 0;
        room.peers.add(p);
        clearTimeout(joinDeadline);
        send(p, { type: 'joined', sessionId: room.sessionId, initiator: p.initiator, iceServers: iceServers(room), expiresAt: room.expiresAt, turnConfigured, protocolVersion: 2, relayVideoMaxBitrate, ultraEnabled: options.ultraEnabled ?? false });
        if (room.peers.size === 2) {
          room.phase = 'ready';
          for (const other of room.peers) send(other, { type: 'ready' });
        }
        log({ event: 'peer-joined', sessionId: room.sessionId, participants: room.peers.size });
        return;
      }
      const room = p.roomId ? rooms.get(p.roomId) : undefined;
      if (!room) return reject(p, 'not-joined', 'Join a valid room first.');
      if (m.type === 'leave') { socket.close(1000, 'left'); return; }
      if (m.type === 'capabilities') {
        if (p.version === 2) return;
        p.version = 2;
        if (modern(room)) for (const other of room.peers) send(other, { type: 'peer-capabilities', version: 2 });
        return;
      }
      if (room.peers.size !== 2) return reject(p, 'not-ready', 'Wait for the other participant.');
      if (['media-policy', 'policy-applied', 'request-video', 'renegotiate'].includes(m.type)) {
        if (!modern(room)) return reject(p, 'unsupported-control', 'This participant does not support coordinated quality controls.');
        if ((p.controlCount = (p.controlCount ?? 0) + 1) > 20) return reject(p, 'rate-limit', 'Too many quality updates');
        if (m.type === 'renegotiate') { negotiate(room); return; }
        const other = [...room.peers].find(peer => peer !== p)!;
        if (m.type === 'media-policy') {
          if (m.revision <= (p.revision ?? 0)) return;
          p.revision = m.revision;
        }
        if (m.type === 'policy-applied' && m.revision !== other.revision) return;
        send(other, m as ServerMessage);
        return;
      }
      if (m.type === 'offer') {
        if (!p.initiator || room.phase !== 'ready' || m.negotiationId !== room.negotiationId) return reject(p, 'unexpected-offer', 'Unexpected offer');
        room.phase = 'offered';
      } else if (m.type === 'answer') {
        if (p.initiator || room.phase !== 'offered' || m.negotiationId !== room.negotiationId) return reject(p, 'unexpected-answer', 'Unexpected answer');
        room.phase = 'answered';
        room.negotiatingAt = undefined;
      }
      for (const other of room.peers) if (other !== p) send(other, m as ServerMessage);
      if (m.type === 'answer' && room.queued) negotiate(room);
    });
  });
  const sweep = setInterval(() => {
    expire();
    for (const p of peers) {
      if (!p.alive) p.socket.terminate();
      else { p.alive = false; p.socket.ping(); }
    }
  }, 15_000);
  sweep.unref();
  return {
    http,
    close: async () => {
      clearInterval(sweep);
      for (const p of peers) p.socket.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve, rejectClose) => http.close((err) => err ? rejectClose(err) : resolve()));
    },
  };
}
