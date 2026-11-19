import assert from 'node:assert/strict';
import test from 'node:test';
import {randomBytes,randomUUID} from 'node:crypto';
import {connect,loadConfiguration} from '../database/connection';
import {migrate} from '../database/migrate';
import {seed,providerId,patientId,patientUserId} from '../database/seed';
import {AccountsStore,hash,utc} from './accounts-store';
import {APP_ID,DeviceAuth,SecretBox,type DeviceEnrollment} from './device-auth';
import {PushWorker,type PushRequest} from './push';
import {AccountsApi} from './accounts-api';
import {createSignaling} from './server';

test('native device ownership, secure refresh and transactional delivery',{timeout:30000},async t=>{
 loadConfiguration();const db=await connect('test');const [lock]=await db.query("SELECT GET_LOCK('phoneapp:test-suite',0) AS acquired");assert.equal(Number(lock.acquired),1);
 await migrate(db);await seed(db);let clock=Date.now();const store=new AccountsStore('test',()=>clock),box=new SecretBox(randomBytes(32)),devices=new DeviceAuth(store,box);
 const issue=async(user:string,native=true):Promise<DeviceEnrollment>=>{const code=randomBytes(32).toString('base64url');await db.query('INSERT INTO enrollment_codes (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)',[randomUUID(),user,hash(code),utc(clock+86400000)]);return await store.enroll(code,native?{installationId:randomUUID(),platform:'ios',appIdentifier:APP_ID}:undefined) as DeviceEnrollment;};
 const actor=(e:DeviceEnrollment)=>store.actor(e.token);
 const endAll=async()=>{for(const id of await store.activeIds())await store.endInternal(id,'failed');};
 try{
  await endAll();
  await t.test('authenticated encryption refuses tampering and wrong key',()=>{const sealed=box.seal('synthetic-provider-token');assert.equal(box.open(sealed),'synthetic-provider-token');const altered=Buffer.from(sealed);altered[altered.length-1]^=1;assert.throws(()=>box.open(altered));assert.throws(()=>new SecretBox(randomBytes(32)).open(sealed));});
  await t.test('refresh retries are atomic; reuse revokes every session of that device',async()=>{
   const e=await issue(patientUserId('B'));const key=randomUUID();const [first,retry]=await Promise.all([devices.refresh(e.deviceId,e.refreshToken,key),devices.refresh(e.deviceId,e.refreshToken,key)]);assert.deepEqual(first,retry);assert.equal((await actor(first)).deviceId,e.deviceId);
   await assert.rejects(devices.refresh(e.deviceId,e.refreshToken,randomUUID()),/revoked/);
   await assert.rejects(actor(first),/Sign in/);await assert.rejects(actor(e),/Sign in/);
  });
  await t.test('wrong refresh proof cannot revoke a valid device and expiry rejects restoration',async()=>{
   const e=await issue(patientUserId('C'));await assert.rejects(devices.refresh(e.deviceId,randomBytes(32).toString('base64url'),randomUUID()));assert.equal((await actor(e)).deviceId,e.deviceId);
   await db.query('UPDATE device_credentials SET expires_at=? WHERE device_id=?',[utc(clock-1),e.deviceId]);await assert.rejects(devices.refresh(e.deviceId,e.refreshToken,randomUUID()));
  });
  await t.test('first answer binds a device; same-device refresh preserves media capabilities',async()=>{
   const provider=await issue(providerId,false),a=await issue(patientUserId('A')),b=await issue(patientUserId('A'));
   const id=await store.create(await actor(provider),patientId('A'),randomUUID());await store.action(await actor(a),id,'answer');
   await assert.rejects(store.action(await actor(b),id,'answer'),/another device/);
   const refreshed=await devices.refresh(a.deviceId,a.refreshToken,randomUUID());assert((await store.dashboard(await actor(refreshed))).calls.find(c=>c.id===id)?.ownsMedia);
   const bindings=await store.bindings(await actor(refreshed),id);assert(bindings.some(b=>b.sessionId===a.deviceId));assert(await store.authorizeMedia(a.deviceId,id));
   await assert.rejects(store.bindings(await actor(b),id),/another device/);
   await store.logout(await actor(refreshed));assert(!await store.authorizeMedia(a.deviceId,id));await endAll();
  });
  await t.test('encrypted registration, unique outbox, expiry/cancel/invalid tokens and no cross-patient delivery',async()=>{
   const p=await issue(providerId,false),a=await issue(patientUserId('A'));const token='synthetic-apns-token-0123456789';await devices.register(await actor(a),'apns_voip',token,'production');
   const [stored]=await db.query('SELECT push_token_ciphertext,push_token_hash FROM devices WHERE id=?',[a.deviceId]);assert.equal(box.open(stored.push_token_ciphertext),token);assert(!stored.push_token_ciphertext.includes(Buffer.from(token)));assert.equal(stored.push_token_hash,hash(token));
   await assert.rejects(devices.register(await actor(p),'fcm',token,'production'),/enrollment/);
   await assert.rejects(devices.register(await actor(a),'fcm',token,'production'),/mismatch/);
   await assert.rejects(devices.register(await actor(a),'apns_voip',token,'sandbox'),/Production/);
   const sent:PushRequest[]=[];const worker=new PushWorker(store,box,async r=>{sent.push(r);return {accepted:true,code:'fake-200'};});
   const key=randomUUID(),id=await store.create(await actor(p),patientId('A'),key);assert.equal(await store.create(await actor(p),patientId('A'),key),id);
   await worker.tick();await worker.tick();assert.equal(sent.length,1);assert.equal(sent[0].callId,id);assert.deepEqual(Object.keys(sent[0]).sort(),['callId','environment','expiresAt','provider','token']);
   await store.action(await actor(p),id,'cancel');
   const canceled=await store.create(await actor(p),patientId('A'),randomUUID());await store.action(await actor(p),canceled,'cancel');await worker.tick();assert.equal(sent.length,1);
   const expired=await store.create(await actor(p),patientId('A'),randomUUID());clock+=61000;await worker.tick();assert.equal(sent.length,1);await store.sweep();
   const invalid=await store.create(await actor(p),patientId('A'),randomUUID());const bad=new PushWorker(store,box,async()=>({accepted:false,invalidToken:true,code:'fake-unregistered'}));await bad.tick();const [revoked]=await db.query('SELECT push_token_hash FROM devices WHERE id=?',[a.deviceId]);assert.equal(revoked.push_token_hash,null);await store.action(await actor(p),invalid,'cancel');
  });
  await t.test('native HTTP enrollment/registration and refreshed room capability remain compatible with browsers',async()=>{
   let api:AccountsApi;const server=createSignaling({accessKey:'synthetic-native-api-key',apiHandler:(req,res)=>api.handle(req,res),authorizePrivateJoin:(principal,call)=>store.authorizeMedia(principal,call)});api=new AccountsApi(store,server,()=>{},devices);
   await new Promise<void>(resolve=>server.http.listen(0,'127.0.0.1',resolve));const address=server.http.address();assert(address&&typeof address!=='string');const origin=`http://127.0.0.1:${address.port}`;
   const request=async(path:string,token:string|undefined,body:unknown,status=200)=>{const response=await fetch(origin+'/api'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});assert.equal(response.status,status);return await response.json() as any;};
   try{
    const code=randomBytes(32).toString('base64url');await db.query('INSERT INTO enrollment_codes (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)',[randomUUID(),patientUserId('A'),hash(code),utc(clock+60000)]);
    await request('/enroll',undefined,{code,device:{installationId:randomUUID(),platform:'web',appIdentifier:APP_ID}},400);
    const a=await request('/enroll',undefined,{code,device:{installationId:randomUUID(),platform:'ios',appIdentifier:APP_ID}}) as DeviceEnrollment;
    await request('/device/push',undefined,{provider:'apns_voip',token:'synthetic-http-push-token',environment:'production'},401);
    await request('/device/push',a.token,{provider:'apns_voip',token:'synthetic-http-push-token',environment:'production'});
    const p=await issue(providerId,false);const {id}=await request('/calls',p.token,{patientId:patientId('A'),requestKey:randomUUID()},201);
    await request(`/calls/${id}/answer`,a.token,{});
    const first=await request(`/calls/${id}/media`,a.token,{});
    const refreshed=await request('/device/refresh',undefined,{deviceId:a.deviceId,refreshToken:a.refreshToken,requestKey:randomUUID()}) as DeviceEnrollment;
    const next=await request(`/calls/${id}/media`,refreshed.token,{});assert.deepEqual(next,first);assert(await store.authorizeMedia(a.deviceId,id));
    await request('/logout',refreshed.token,{});await request(`/calls/${id}/media`,refreshed.token,{},401);
   }finally{await endAll();await server.close();}
  });
  await t.test('raw media freshness remains bounded without generic native heartbeat credit',async()=>{
   const p=await issue(providerId,false),a=await issue(patientUserId('A'));const id=await store.create(await actor(p),patientId('A'),randomUUID());await store.action(await actor(a),id,'answer');
   await store.report(await actor(p),id,true,'browser');await store.report(await actor(a),id,false,'native-no-audio','native-rtp');clock+=5000;
   await store.report(await actor(a),id,false,'native-no-audio-2','native-rtp');await store.action(await actor(p),id,'end');assert.equal((await store.dashboard(await actor(p))).calls.find(c=>c.id===id)?.observedSeconds,0);
  });
 }finally{await endAll();await db.query("SELECT RELEASE_LOCK('phoneapp:test-suite')");await db.end();}
});
