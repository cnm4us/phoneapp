import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AccountsStore, Binding } from './accounts-store';
import { ApiError } from './accounts-store';
import type { Invitation } from '../shared/protocol';

export interface RoomBridge {
  privateInvitation(callId: string, bindings: Binding[], sessionId: string): Invitation;
  closePrivateRoom(callId: string): void;
}
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
const token = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

export class AccountsApi {
  private enrollmentWindow = 0;
  private enrollmentAttempts = 0;
  private inFlight = 0;
  private timer?: ReturnType<typeof setInterval>;
  private sweeping = false;
  private stopped = false;
  constructor(readonly store: AccountsStore, readonly bridge: RoomBridge, readonly onError: () => void = () => {}) {}
  async start(): Promise<void> {
    // This POC has one signaling process. Old transient rooms cannot survive restart.
    for (const id of await this.store.activeIds()) await this.store.endInternal(id,'failed');
    this.timer = setInterval(() => { void this.sweep(); }, 5_000);
    this.timer.unref();
  }
  async stop(): Promise<void> {
    this.stopped=true;
    clearInterval(this.timer);
    for (const id of await this.store.activeIds()) await this.store.endInternal(id,'failed');
  }
  async sweep(): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    try { for (const id of await this.store.sweep()) this.bridge.closePrivateRoom(id); }
    catch { this.onError(); }
    finally { this.sweeping = false; }
  }
  async roomClosed(id: string): Promise<void> { await this.store.endInternal(id); }
  private json(res: ServerResponse, status: number, value: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(value));
  }
  private async body(req: IncomingMessage, allowed: string[]): Promise<Record<string, unknown>> {
    if (!req.headers['content-type']?.startsWith('application/json')) throw new ApiError(415,'JSON request required.');
    const text = await new Promise<string>((resolve,reject)=>{
      const chunks:Buffer[]=[];let size=0;
      const cleanup=()=>{req.off('data',data);req.off('end',end);req.off('aborted',aborted);req.off('error',aborted);};
      const data=(chunk:Buffer)=>{
        size+=chunk.length;
        if(size>4096){cleanup();req.resume();reject(new ApiError(413,'Request is too large.'));return;}
        chunks.push(chunk);
      };
      const end=()=>{cleanup();resolve(Buffer.concat(chunks).toString('utf8'));};
      const aborted=()=>{cleanup();reject(new ApiError(400,'Request was interrupted.'));};
      req.on('data',data);req.once('end',end);req.once('aborted',aborted);req.once('error',aborted);
    });
    let value: unknown;
    try { value = JSON.parse(text); } catch { throw new ApiError(400,'Invalid JSON request.'); }
    if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new ApiError(400,'Unexpected request fields.');
    return value;
  }
  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if(this.stopped){req.resume();this.json(res,503,{error:'Account service is restarting. Try again shortly.'});return;}
    if (++this.inFlight > 32) { this.inFlight--; req.resume(); this.json(res,429,{ error:'Too many requests. Try again shortly.' }); return; }
    try {
      if (req.method === 'POST' && req.url === '/api/enroll') {
        const now = this.store.now();
        if (now - this.enrollmentWindow >= 60_000) { this.enrollmentWindow=now; this.enrollmentAttempts=0; }
        if (++this.enrollmentAttempts > 30) throw new ApiError(429,'Too many enrollment attempts. Try again in a minute.');
        const body = await this.body(req,['code']);
        if (!token(body.code)) throw new ApiError(400,'Paste the complete enrollment code.');
        this.json(res,200,await this.store.enroll(body.code)); return;
      }
      const bearer = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
      if (!bearer) throw new ApiError(401,'Sign in with an enrollment code.');
      const actor = await this.store.actor(bearer);
      if (req.method === 'GET' && req.url === '/api/dashboard') { this.json(res,200,await this.store.dashboard(actor)); return; }
      if (req.method === 'POST' && req.url === '/api/logout') {
        await this.body(req,[]);
        for (const id of await this.store.logout(actor)) this.bridge.closePrivateRoom(id);
        this.json(res,200,{ ok:true }); return;
      }
      if (req.method === 'POST' && req.url === '/api/calls') {
        const body=await this.body(req,['patientId','requestKey']);
        if (!uuid(body.patientId) || typeof body.requestKey !== 'string' || !/^[A-Za-z0-9_-]{12,100}$/.test(body.requestKey)) throw new ApiError(400,'Patient and request key required.');
        this.json(res,201,{ id:await this.store.create(actor,body.patientId,body.requestKey) }); return;
      }
      const route = req.url?.match(/^\/api\/calls\/([a-f0-9-]{36})\/(answer|decline|cancel|end|media|presence)$/);
      if (!route || req.method !== 'POST') throw new ApiError(404,'Not found.');
      const [,id,action] = route;
      if (action === 'media') {
        await this.body(req,[]);
        const bindings=await this.store.bindings(actor,id);
        this.json(res,200,{ invitation:this.bridge.privateInvitation(id,bindings,actor.sessionId) }); return;
      }
      if (action === 'presence') {
        const body=await this.body(req,['connected','eventKey']);
        if (typeof body.connected !== 'boolean' || typeof body.eventKey !== 'string' || !/^[A-Za-z0-9_-]{1,60}$/.test(body.eventKey)) throw new ApiError(400,'Media state and event key required.');
        await this.store.report(actor,id,body.connected,body.eventKey);
      } else {
        await this.body(req,[]);
        await this.store.action(actor,id,action as 'answer'|'decline'|'cancel'|'end');
        if (action !== 'answer') this.bridge.closePrivateRoom(id);
      }
      this.json(res,200,{ ok:true });
    } catch(error) {
      req.resume();
      if (error instanceof ApiError) this.json(res,error.status,{ error:error.message });
      else { this.onError(); this.json(res,503,{ error:'Account service is temporarily unavailable. Try again.' }); }
    } finally { this.inFlight--; }
  }
}
