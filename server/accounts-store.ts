import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Connection } from 'mariadb';
import type { Account, CallRecord, Dashboard, Enrollment, CallAction } from '../shared/accounts';
import { terminalCall } from '../shared/accounts';
import type { Target } from '../database/connection';
import { connect } from '../database/connection';
import { enrollDevice, type DeviceInput } from './device-auth';

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
export const utc = (time: number): string => new Date(time).toISOString().replace('T', ' ').replace('Z', '');
const millis = (value: string | null): number => value ? Date.parse(value.replace(' ', 'T') + 'Z') : 0;
const iso = (value: string | null): string | null => value ? new Date(millis(value)).toISOString() : null;
export type Actor = Account & { sessionId: string; deviceId?: string | null };
type Row = Record<string, any>;
export type Binding = { userId: string; sessionId: string };

export class AccountsStore {
  constructor(readonly target: Target, readonly now: () => number = Date.now) {}
  async transaction<T>(operation: (db: Connection) => Promise<T>): Promise<T> {
    const db = await connect(this.target);
    try { await db.beginTransaction(); const result = await operation(db); await db.commit(); return result; }
    catch (error) { await db.rollback(); throw error; }
    finally { await db.end(); }
  }
  async enroll(code: string, device?:DeviceInput): Promise<Enrollment & {deviceId?:string;refreshToken?:string}> {
    return this.transaction(async db => {
      const [row] = await db.query(`SELECT e.*,u.display_name,u.role,u.auth_issuer FROM enrollment_codes e JOIN users u ON u.id=e.user_id WHERE e.token_hash=? FOR UPDATE`, [hash(code)]);
      if (!row || row.redeemed_at || row.revoked_at || millis(row.expires_at) <= this.now() || (row.auth_issuer && row.auth_issuer !== 'phoneapp:synthetic-enrollment')) throw new ApiError(401, 'Enrollment code is invalid, used, or expired. Ask the owner for a fresh code.');
      const token = randomBytes(32).toString('base64url');
      const expires = this.now() + 12 * 60 * 60_000;
      await db.query("UPDATE users SET status='active',auth_issuer='phoneapp:synthetic-enrollment',auth_subject=id WHERE id=?", [row.user_id]);
      await db.query('UPDATE enrollment_codes SET redeemed_at=? WHERE id=?', [utc(this.now()), row.id]);
      const sessionId=randomUUID();
      await db.query('INSERT INTO auth_sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)', [sessionId, row.user_id, hash(token), utc(expires)]);
      const native=device?await enrollDevice(db,row.user_id,sessionId,device,this.now()):{};
      return { ...native, token, expiresAt: new Date(expires).toISOString(), account: { id: row.user_id, displayName: row.display_name, role: row.role } };
    });
  }
  async actor(token: string): Promise<Actor> {
    return this.transaction(async db => {
      const [row] = await db.query(`SELECT s.id AS sessionId,s.device_id AS deviceId,u.id,u.display_name AS displayName,u.role FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active' AND (s.device_id IS NULL OR EXISTS(SELECT 1 FROM devices d WHERE d.id=s.device_id AND d.revoked_at IS NULL))`, [hash(token), utc(this.now())]);
      if (!row) throw new ApiError(401, 'Sign in again with a fresh enrollment code.');
      return row;
    });
  }
  async permitted(db: Connection, userId: string, patientId: string): Promise<boolean> {
    const [row] = await db.query(`SELECT p.id FROM patients p JOIN users u ON u.id=? AND u.status='active' WHERE p.id=? AND p.archived_at IS NULL AND ((u.role IN ('practitioner','rn','ma','admin') AND EXISTS(SELECT 1 FROM patient_assignments a WHERE a.patient_id=p.id AND a.staff_user_id=u.id AND a.revoked_at IS NULL)) OR (u.role IN ('patient','caregiver') AND EXISTS(SELECT 1 FROM patient_accounts a WHERE a.patient_id=p.id AND a.user_id=u.id AND a.revoked_at IS NULL)))`, [userId, patientId]);
    return Boolean(row);
  }
  private async call(db: Connection, id: string): Promise<Row> {
    const [row] = await db.query('SELECT c.*,r.caller_session_id,r.answered_session_id,r.caller_device_id,r.answered_device_id,r.ring_expires_at,r.call_expires_at,r.segment_started_at,r.observed_connected_ms FROM calls c JOIN call_runtime r ON r.call_id=c.id WHERE c.id=? FOR UPDATE', [id]);
    if (!row) throw new ApiError(404, 'Call not found.');
    return row;
  }
  private async participant(db: Connection, actor: Actor, call: Row): Promise<Row> {
    const [row] = await db.query('SELECT * FROM call_participants WHERE call_id=? AND user_id=?', [call.id, actor.id]);
    if (!row || !await this.permitted(db, actor.id, call.patient_id)) throw new ApiError(404, 'Call not found.');
    return row;
  }
  private async event(db: Connection, call: string, participant: string | null, key: string, type: string): Promise<boolean> {
    const [existing] = await db.query("SELECT id FROM call_events WHERE call_id=? AND source='account-api' AND source_event_key=?", [call, key]);
    if (existing) return false;
    await db.query("INSERT INTO call_events (id,call_id,participant_id,source,source_event_key,event_type,occurred_at) VALUES (?,?,?,'account-api',?,?,?)", [randomUUID(), call, participant, key, type, utc(this.now())]);
    return true;
  }
  async dashboard(actor: Actor): Promise<Dashboard> {
    return this.transaction(async db => {
      const patients = await db.query(`SELECT p.id,COALESCE(p.display_name,p.external_identifier,p.id) AS displayName,EXISTS(SELECT 1 FROM patient_accounts a JOIN users u ON u.id=a.user_id WHERE a.patient_id=p.id AND a.relationship='self' AND a.revoked_at IS NULL AND u.status='active' AND u.role='patient') AS enrolled FROM patients p JOIN patient_assignments a ON a.patient_id=p.id WHERE a.staff_user_id=? AND a.revoked_at IS NULL AND p.archived_at IS NULL ORDER BY p.display_name,p.id`, [actor.id]);
      const rows = await db.query(`SELECT c.*,p.display_name AS patient_name,u.display_name AS caller_name,r.caller_session_id,r.answered_session_id,r.caller_device_id,r.answered_device_id FROM calls c JOIN call_runtime r ON r.call_id=c.id JOIN patients p ON p.id=c.patient_id JOIN users u ON u.id=c.initiated_by_user_id JOIN call_participants cp ON cp.call_id=c.id AND cp.user_id=? ORDER BY c.created_at DESC,c.id DESC LIMIT 100`, [actor.id]);
      const calls: CallRecord[] = [];
      for (const row of rows) if (await this.permitted(db, actor.id, row.patient_id)) calls.push(this.view(row, actor));
      return { account: { id: actor.id, displayName: actor.displayName, role: actor.role }, patients: ['practitioner','rn','ma','admin'].includes(actor.role) ? patients.map((p: Row) => ({ ...p, enrolled: Boolean(p.enrolled) })) : [], calls };
    });
  }
  private view(row: Row, actor: Actor): CallRecord {
    const outgoing = row.initiated_by_user_id === actor.id;
    return { id: row.id, patientId: row.patient_id, patientName: row.patient_name || 'Patient', callerName: row.caller_name || 'Care team', direction: outgoing ? 'outgoing' : 'incoming', state: row.state, createdAt: iso(row.created_at)!, endedAt: iso(row.ended_at), observedSeconds: row.observed_connected_seconds, transcriptionStatus: 'off', canAnswer: !outgoing && row.state === 'ringing', ownsMedia: this.owns(actor,row,outgoing) };
  }
  private owns(actor:Actor,row:Row,caller:boolean):boolean { const device=caller?row.caller_device_id:row.answered_device_id;return device?actor.deviceId===device:actor.sessionId===(caller?row.caller_session_id:row.answered_session_id); }
  async create(actor: Actor, patientId: string, requestKey: string): Promise<string> {
    return this.transaction(async db => {
      // Serialize concurrent starts by this provider; duplicate request returns its original call.
      await db.query('SELECT id FROM users WHERE id=? FOR UPDATE', [actor.id]);
      if (!['practitioner','rn','ma','admin'].includes(actor.role) || !await this.permitted(db, actor.id, patientId)) throw new ApiError(404, 'Assigned patient not found.');
      const [duplicate] = await db.query('SELECT id,patient_id FROM calls WHERE initiated_by_user_id=? AND client_request_key=?', [actor.id, requestKey]);
      if (duplicate) { if (duplicate.patient_id !== patientId) throw new ApiError(409, 'Request already belongs to a different patient.'); return duplicate.id; }
      const [busy] = await db.query("SELECT id FROM calls WHERE initiated_by_user_id=? AND state IN ('created','ringing','accepted','connected') LIMIT 1", [actor.id]);
      if (busy) throw new ApiError(409, 'Finish your current call first.');
      const targets = await db.query("SELECT u.* FROM patient_accounts a JOIN users u ON u.id=a.user_id WHERE a.patient_id=? AND a.relationship='self' AND a.revoked_at IS NULL AND u.status='active' AND u.role='patient' ORDER BY u.id", [patientId]);
      if (targets.length !== 1) throw new ApiError(409, 'Patient needs one enrolled account before calling.');
      await db.query('SELECT id FROM users WHERE id=? FOR UPDATE',[targets[0].id]);
      const [patientBusy]=await db.query("SELECT c.id FROM calls c JOIN call_participants cp ON cp.call_id=c.id WHERE cp.user_id=? AND c.state IN ('ringing','accepted','connected') LIMIT 1",[targets[0].id]);
      if(patientBusy)throw new ApiError(409,'Patient already has an active call.');
      const id = randomUUID();
      await db.query("INSERT INTO calls (id,patient_id,initiated_by_user_id,client_request_key,state,created_at) VALUES (?,?,?,?,'ringing',?)", [id, patientId, actor.id, requestKey, utc(this.now())]);
      await db.query('INSERT INTO call_runtime (call_id,caller_session_id,caller_device_id,ring_expires_at,call_expires_at) VALUES (?,?,?,?,?)', [id, actor.sessionId, actor.deviceId??null, utc(this.now() + 60_000), utc(this.now() + 4 * 60 * 60_000)]);
      for (const user of [actor, { id: targets[0].id, role: targets[0].role, displayName: targets[0].display_name }]) {
        const participant = randomUUID();
        await db.query('INSERT INTO call_participants (id,call_id,user_id,role_snapshot,label_snapshot) VALUES (?,?,?,?,?)', [participant, id, user.id, user.role, user.displayName]);
        await db.query('INSERT INTO call_presence (call_id,participant_id) VALUES (?,?)', [id, participant]);
      }
      await db.query("INSERT INTO push_deliveries (id,call_id,device_id,available_at,expires_at) SELECT UUID(),?,id,?,? FROM devices WHERE user_id=? AND revoked_at IS NULL AND push_token_hash IS NOT NULL",[id,utc(this.now()),utc(this.now()+60_000),targets[0].id]);
      await this.event(db, id, null, 'created', 'ringing');
      return id;
    });
  }
  async action(actor: Actor, id: string, action: CallAction): Promise<void> {
    await this.transaction(async db => {
      const row = await this.call(db, id);
      const participant = await this.participant(db, actor, row);
      const caller = row.initiated_by_user_id === actor.id;
      if ((action === 'answer' || action === 'decline') && caller || action === 'cancel' && !caller) throw new ApiError(403, 'This call action belongs to the other participant.');
      if (terminalCall(row.state)) return;
      if (action === 'end' && row.state !== 'ringing' && !this.owns(actor,row,caller)) throw new ApiError(409,'Call is active on another device.');
      if (row.state === 'ringing' && millis(row.ring_expires_at) <= this.now()) { await this.finish(db, row, 'missed'); return; }
      if (action === 'answer') {
        if (row.state !== 'ringing') { if (!this.owns(actor,row,false)) throw new ApiError(409, 'This call was answered on another device.'); return; }
        await db.query("UPDATE calls SET state='accepted',answered_at=? WHERE id=?", [utc(this.now()), id]);
        await db.query('UPDATE call_runtime SET answered_session_id=?,answered_device_id=? WHERE call_id=?', [actor.sessionId, actor.deviceId??null, id]);
      } else {
        if (action === 'decline' && row.state !== 'ringing') throw new ApiError(409, 'Call is already answered.');
        if (action === 'cancel' && row.state !== 'ringing') throw new ApiError(409, 'Use End for an answered call.');
        await this.finish(db, row, action === 'decline' ? 'declined' : action === 'cancel' ? 'canceled' : row.state === 'ringing' ? (caller ? 'canceled' : 'declined') : 'ended');
      }
      await this.event(db, id, participant.id, `${action}:${actor.sessionId}`, action);
    });
  }
  private async accrue(db: Connection, row: Row): Promise<number> {
    let ms = Number(row.observed_connected_ms);
    if (row.segment_started_at) {
      const presence = await db.query('SELECT last_report_at FROM call_presence WHERE call_id=?', [row.id]);
      const cutoff = Math.min(this.now(), ...presence.map((p: Row) => millis(p.last_report_at) + 20_000));
      ms += Math.max(0, cutoff - millis(row.segment_started_at));
    }
    await db.query('UPDATE call_runtime SET observed_connected_ms=?,segment_started_at=NULL WHERE call_id=?', [ms, row.id]);
    await db.query('UPDATE calls SET observed_connected_seconds=? WHERE id=?', [Math.floor(ms / 1000), row.id]);
    return ms;
  }
  private async finish(db: Connection, row: Row, state: string): Promise<void> {
    if (terminalCall(row.state)) return;
    await this.accrue(db, row);
    await db.query('UPDATE calls SET state=?,ended_at=? WHERE id=?', [state, utc(this.now()), row.id]);
    await this.event(db, row.id, null, `terminal:${state}`, state);
  }
  async bindings(actor: Actor, id: string): Promise<Binding[]> {
    return this.transaction(async db => {
      const row = await this.call(db, id);
      await this.participant(db, actor, row);
      if (!['accepted','connected'].includes(row.state) || millis(row.call_expires_at) <= this.now()) throw new ApiError(409, 'Call is not ready for media.');
      if (!this.owns(actor,row,row.initiated_by_user_id===actor.id)) throw new ApiError(409, 'This call belongs to another device.');
      const rows = await db.query('SELECT COALESCE(s.device_id,s.id) AS sessionId,s.user_id AS userId FROM auth_sessions s WHERE s.id IN (?,?) AND s.revoked_at IS NULL AND s.expires_at>?', [row.caller_session_id,row.answered_session_id,utc(this.now())]);
      if (rows.length !== 2) throw new ApiError(409, 'A participant needs to sign in again.');
      for (const binding of rows) if (!await this.permitted(db, binding.userId, row.patient_id)) throw new ApiError(403, 'A participant no longer has access.');
      return rows;
    });
  }
  async authorizeMedia(sessionId: string, id: string): Promise<boolean> {
    try {
      const actor = await this.transaction(async db => {
        const [row] = await db.query("SELECT s.id AS sessionId,s.device_id AS deviceId,u.id,u.display_name AS displayName,u.role FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE (s.id=? OR s.device_id=?) AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active' AND (s.device_id IS NULL OR EXISTS(SELECT 1 FROM devices d WHERE d.id=s.device_id AND d.revoked_at IS NULL))", [sessionId,sessionId,utc(this.now())]);
        if (!row) throw new ApiError(401, 'Session ended.');
        return row as Actor;
      });
      await this.bindings(actor, id); return true;
    } catch { return false; }
  }
  async report(actor: Actor, id: string, connected: boolean, key: string, source='client-media'): Promise<void> {
    await this.transaction(async db => {
      const row = await this.call(db, id);
      const participant = await this.participant(db, actor, row);
      if (terminalCall(row.state)) return;
      const expected = row.initiated_by_user_id === actor.id ? row.caller_session_id : row.answered_session_id;
      if (!this.owns(actor,row,row.initiated_by_user_id===actor.id) || !['accepted','connected'].includes(row.state)) throw new ApiError(409, 'Call is not active on this device.');
      if (!await this.event(db, id, participant.id, `${actor.sessionId}:${key}`, `${source}-${connected?'connected':'disconnected'}`)) return;
      await this.accrue(db, row);
      await db.query('UPDATE call_presence SET connected=?,last_report_at=? WHERE call_id=? AND participant_id=?', [connected,utc(this.now()),id,participant.id]);
      const [{ n }] = await db.query('SELECT COUNT(*) AS n FROM call_presence WHERE call_id=? AND connected=1 AND last_report_at>?', [id,utc(this.now() - 20_000)]);
      if (Number(n) === 2) {
        await db.query('UPDATE call_runtime SET segment_started_at=? WHERE call_id=?', [utc(this.now()),id]);
        await db.query("UPDATE calls SET state='connected',connected_at=COALESCE(connected_at,?) WHERE id=?", [utc(this.now()),id]);
      }
    });
  }
  async endInternal(id: string, state = 'ended'): Promise<void> {
    await this.transaction(async db => { const row = await this.call(db,id); await this.finish(db,row,row.state === 'ringing' && state === 'ended' ? 'missed' : state); });
  }
  async activeIds(): Promise<string[]> {
    return this.transaction(async db => (await db.query("SELECT c.id FROM calls c JOIN call_runtime r ON r.call_id=c.id WHERE c.state IN ('created','ringing','accepted','connected')")).map((r: Row) => r.id));
  }
  async sweep(): Promise<string[]> {
    const ended: string[] = [];
    for (const id of await this.activeIds()) await this.transaction(async db => {
      const row = await this.call(db,id);
      if (terminalCall(row.state)) return;
      const sessions = await db.query('SELECT user_id FROM auth_sessions WHERE id IN (?,?) AND revoked_at IS NULL AND expires_at>?', [row.caller_session_id,row.answered_session_id,utc(this.now())]);
      let valid = sessions.length === (row.state === 'ringing' ? 1 : 2);
      for (const s of sessions) valid = valid && await this.permitted(db,s.user_id,row.patient_id);
      const presence=await db.query('SELECT last_report_at FROM call_presence WHERE call_id=?',[id]);
      const mediaTimedOut=row.state !== 'ringing' && (!row.connected_at ? millis(row.answered_at)+45_000<=this.now() : presence.some((p:Row)=>millis(p.last_report_at)+35_000<=this.now()));
      const expired = row.state === 'ringing' ? millis(row.ring_expires_at) <= this.now() : millis(row.call_expires_at) <= this.now();
      if (expired || mediaTimedOut || !valid) { await this.finish(db,row,row.state === 'ringing' && expired ? 'missed' : 'failed'); ended.push(id); }
    });
    return ended;
  }
  async logout(actor: Actor): Promise<string[]> {
    const ids = await this.transaction(async db => {
      if(actor.deviceId){await db.query('UPDATE devices SET revoked_at=?,push_provider='none',push_token_ciphertext=NULL,push_token_hash=NULL WHERE id=?',[utc(this.now()),actor.deviceId]);await db.query('UPDATE auth_sessions SET revoked_at=? WHERE device_id=?',[utc(this.now()),actor.deviceId]);}
      else await db.query('UPDATE auth_sessions SET revoked_at=? WHERE id=?', [utc(this.now()),actor.sessionId]);
      return (await db.query("SELECT c.id FROM calls c JOIN call_runtime r ON r.call_id=c.id WHERE c.state IN ('ringing','accepted','connected') AND (r.caller_session_id=? OR r.answered_session_id=?)", [actor.sessionId,actor.sessionId])).map((r: Row) => r.id) as string[];
    });
    for (const id of ids) await this.endInternal(id,'failed');
    return ids;
  }
}
