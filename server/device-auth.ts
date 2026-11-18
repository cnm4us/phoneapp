import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import type { Connection } from 'mariadb';
import { ApiError, hash, utc, type AccountsStore, type Actor } from './accounts-store';
import type { Enrollment } from '../shared/accounts';
export const APP_ID='com.bawebtech.phoneapp.poc';
export type DeviceInput={installationId:string;platform:'ios'|'android';appIdentifier:string};
export type DeviceEnrollment=Enrollment & {deviceId:string;refreshToken:string};
export class SecretBox {
 constructor(private key:Buffer){if(key.length!==32)throw new Error('Device encryption key must be 32 bytes');}
 seal(value:string):Buffer {const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',this.key,iv);const body=Buffer.concat([c.update(value,'utf8'),c.final()]);return Buffer.concat([Buffer.from([1]),iv,c.getAuthTag(),body]);}
 open(value:Buffer):string {if(value[0]!==1)throw new Error('Unknown encrypted value version');const d=createDecipheriv('aes-256-gcm',this.key,value.subarray(1,13));d.setAuthTag(value.subarray(13,29));return Buffer.concat([d.update(value.subarray(29)),d.final()]).toString('utf8');}
}
export async function enrollDevice(db:Connection,userId:string,sessionId:string,input:DeviceInput,now:number):Promise<{deviceId:string;refreshToken:string}> {
 const [existing]=await db.query('SELECT id FROM devices WHERE app_identifier=? AND installation_id=? FOR UPDATE',[APP_ID,input.installationId]);
 if(existing)throw new ApiError(409,'This installation is already enrolled. Sign out before changing accounts.');
 const id=randomUUID(),refreshToken=randomBytes(32).toString('base64url');
 await db.query('INSERT INTO devices (id,user_id,installation_id,platform,app_identifier,last_seen_at) VALUES (?,?,?,?,?,?)',[id,userId,input.installationId,input.platform,APP_ID,utc(now)]);
 await db.query('INSERT INTO device_credentials (token_hash,device_id,expires_at) VALUES (?,?,?)',[hash(refreshToken),id,utc(now+90*86400_000)]);
 await db.query('UPDATE auth_sessions SET device_id=? WHERE id=?',[id,sessionId]);
 return {deviceId:id,refreshToken};
}
export class DeviceAuth {
 constructor(readonly store:AccountsStore,readonly box:SecretBox){}
 async refresh(deviceId:string,token:string,requestKey:string):Promise<DeviceEnrollment> {
  const result=await this.store.transaction(async db=>{
   const [d]=await db.query(`SELECT d.*,u.display_name,u.role,u.status FROM devices d JOIN users u ON u.id=d.user_id WHERE d.id=? FOR UPDATE`,[deviceId]);
   const [r]=await db.query('SELECT * FROM device_credentials WHERE device_id=? AND token_hash=? FOR UPDATE',[deviceId,hash(token)]);
   const now=this.store.now();
   if(!d||!r||d.revoked_at||d.status!=='active'||Date.parse(r.expires_at.replace(' ','T')+'Z')<=now)return null;
   if(r.used_at){
    if(r.request_hash===hash(requestKey)&&Date.parse(r.used_at.replace(' ','T')+'Z')+60_000>now)return JSON.parse(this.box.open(r.response_ciphertext)) as DeviceEnrollment;
    await db.query('UPDATE devices SET revoked_at=?,push_provider='none',push_token_ciphertext=NULL,push_token_hash=NULL WHERE id=?',[utc(now),deviceId]);
    await db.query('UPDATE auth_sessions SET revoked_at=? WHERE device_id=?',[utc(now),deviceId]);
    return null;
   }
   const accessToken=randomBytes(32).toString('base64url'),refreshToken=randomBytes(32).toString('base64url'),sessionId=randomUUID();
   const expiresAt=new Date(now+60*60_000).toISOString();
   await db.query('INSERT INTO auth_sessions (id,user_id,device_id,token_hash,expires_at) VALUES (?,?,?,?,?)',[sessionId,d.user_id,deviceId,hash(accessToken),utc(Date.parse(expiresAt))]);
   const response={token:accessToken,refreshToken,deviceId,expiresAt,account:{id:d.user_id,displayName:d.display_name,role:d.role}} as DeviceEnrollment;
   await db.query('INSERT INTO device_credentials (token_hash,device_id,expires_at) VALUES (?,?,?)',[hash(refreshToken),deviceId,r.expires_at]);
   await db.query('UPDATE device_credentials SET used_at=?,request_hash=?,response_ciphertext=? WHERE token_hash=?',[utc(now),hash(requestKey),this.box.seal(JSON.stringify(response)),r.token_hash]);
   await db.query('UPDATE devices SET last_seen_at=? WHERE id=?',[utc(now),deviceId]);
   // Active room capabilities use the stable device principal, so refresh cannot steal/reassign a call.
   await db.query('UPDATE call_runtime SET caller_session_id=? WHERE caller_device_id=?',[sessionId,deviceId]);
   await db.query('UPDATE call_runtime SET answered_session_id=? WHERE answered_device_id=?',[sessionId,deviceId]);
   return response;
  });
  if(!result)throw new ApiError(401,'Device enrollment expired or was revoked. Enroll again.');return result;
 }
 async register(actor:Actor,provider:string,token:string,environment:string):Promise<void>{
  if(!actor.deviceId)throw new ApiError(403,'Native device enrollment required.');
  await this.store.transaction(async db=>{
   const [d]=await db.query('SELECT * FROM devices WHERE id=? AND revoked_at IS NULL FOR UPDATE',[actor.deviceId]);
   if(!d||d.user_id!==actor.id||(provider==='apns_voip'?d.platform!=='ios':d.platform!=='android'))throw new ApiError(403,'Device registration mismatch.');
   if(provider==='apns_voip'&&environment!=='production')throw new ApiError(400,'This POC is configured for Production APNs.');
   const tokenHash=hash(token);
   await db.query("UPDATE devices SET push_provider='none',push_token_hash=NULL,push_token_ciphertext=NULL WHERE revoked_at IS NOT NULL AND push_provider=? AND app_identifier=? AND push_token_hash=?",[provider,APP_ID,tokenHash]);
   // A provider token belongs to one active installation; do not let another credential claim it.
   const [other]=await db.query('SELECT id FROM devices WHERE push_provider=? AND app_identifier=? AND push_token_hash=? AND id<>?',[provider,APP_ID,tokenHash,d.id]);
   if(other)throw new ApiError(409,'Push token is already registered to another installation.');
   await db.query('UPDATE devices SET push_provider=?,push_token_hash=?,push_token_ciphertext=?,push_environment=?,last_seen_at=? WHERE id=?',[provider,tokenHash,this.box.seal(token),environment,utc(this.store.now()),d.id]);
  });
 }
}
