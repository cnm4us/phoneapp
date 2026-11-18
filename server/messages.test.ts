import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdtemp,readFile,rm,readdir,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {connect,loadConfiguration} from '../database/connection';
import {migrate} from '../database/migrate';
import {seed,providerId,patientId,patientUserId} from '../database/seed';
import {AccountsStore,hash,utc} from './accounts-store';
import {Messages,mediaConfig} from './messages';
import {AccountsApi} from './accounts-api';
import {createSignaling} from './server';

test('audio messages, private storage and delayed shared history',{timeout:120000},async t=>{
 loadConfiguration();const db=await connect('test');const [lock]=await db.query("SELECT GET_LOCK('phoneapp:test-suite',0) AS acquired");assert.equal(Number(lock.acquired),1);
 await migrate(db);await seed(db);const root=await mkdtemp(join(tmpdir(),'phoneapp-message-test-'));let clock=Date.now();const store=new AccountsStore('test',()=>clock),messages=new Messages(store,{...mediaConfig({}),root,minFree:0,maxSeconds:3});await messages.init();
 let api:AccountsApi;const server=createSignaling({accessKey:'message-synthetic-test-key',webRoot:resolve('web/dist'),apiHandler:(req,res)=>api.handle(req,res)});api=new AccountsApi(store,server,()=>{},undefined,messages);await new Promise<void>(r=>server.http.listen(0,'127.0.0.1',r));const addr=server.http.address();assert(addr&&typeof addr!=='string');const origin=`http://127.0.0.1:${addr.port}`;
 const issue=async(user:string)=>{const code=randomBytes(32).toString('base64url');await db.query('INSERT INTO enrollment_codes(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)',[randomUUID(),user,hash(code),utc(clock+86400000)]);return code;};
 const enroll=async(user:string)=>store.enroll(await issue(user));
 const request=async(path:string,token:string,body?:unknown,expected=200)=>{const r=await fetch(origin+'/api'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,expected,await r.clone().text());return r.json() as Promise<any>;};
 const upload=async(id:string,token:string,bytes:Uint8Array,expected=200)=>{const grant=await request(`/messages/${id}/upload`,token,{});const r=await fetch(origin+grant.path,{method:'POST',headers:{Authorization:'Media '+grant.token,'Content-Type':'application/octet-stream'},body:bytes as BodyInit});assert.equal(r.status,expected,await r.clone().text());return grant;};
 const fixture=join(root,'fixture.wav');execFileSync('/usr/bin/ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=1','-ac','1','-threads','1',fixture]);const audio=await readFile(fixture);const provider=await enroll(providerId),patient=await enroll(patientUserId('A')),other=await enroll(patientUserId('B'));
 let id='';
 try{
  await t.test('send before enrollment, late binding, actual private audio and honest duration',async()=>{
   await db.query("UPDATE users SET status='disabled' WHERE id=?",[patientUserId('C')]);const key=randomUUID();const row=await request('/messages',provider.token,{patientId:patientId('C'),requestKey:key});id=row.id;
   const duplicate=await request('/messages',provider.token,{patientId:patientId('C'),requestKey:key});assert.equal(duplicate.id,id);
   await request('/messages',provider.token,{patientId:patientId('A'),requestKey:key},409);
   await upload(id,provider.token,audio);await messages.tick();const p=await enroll(patientUserId('C'));const history=await request('/messages/history',p.token,{patientId:patientId('C')});assert.equal(history.entries[0].state,'available');assert(history.entries[0].durationMs>=950&&history.entries[0].durationMs<1500);
   const grant=await request(`/messages/${id}/play`,p.token,{});const r=await fetch(origin+grant.path,{headers:{Authorization:'Media '+grant.token,Range:'bytes=0-31'}});assert.equal(r.status,206);assert.equal((await r.arrayBuffer()).byteLength,32);assert.equal(r.headers.get('cache-control'),'private, no-store');
   const files=await readdir(root);const output=files.find(n=>n.endsWith('.m4a'))!;assert.equal((await stat(join(root,output))).mode&0o077,0);
   const [counts]=await db.query('SELECT COUNT(*) AS n FROM activity_observations WHERE source=?',['audio-message']);assert.equal(Number(counts.n),0);
  });
  await t.test('drafts are sender-only, unrelated users denied, grant replay and revocation enforced',async()=>{
   const row=await request('/messages',provider.token,{patientId:patientId('A'),requestKey:randomUUID()});const history=await request('/messages/history',patient.token,{patientId:patientId('A')});assert(!history.entries.some((r:any)=>r.id===row.id));
   await request(`/messages/${row.id}/play`,patient.token,{},404);await request('/messages/history',other.token,{patientId:patientId('A')},404);
   const grant=await upload(row.id,provider.token,audio);const replay=await fetch(origin+grant.path,{method:'POST',headers:{Authorization:'Media '+grant.token},body:audio});assert.equal(replay.status,401);await messages.tick();
   const play=await request(`/messages/${row.id}/play`,patient.token,{});await db.query('UPDATE patient_accounts SET revoked_at=? WHERE patient_id=? AND user_id=?',[utc(clock),patientId('A'),patient.account.id]);const denied=await fetch(origin+play.path,{headers:{Authorization:'Media '+play.token}});assert.equal(denied.status,404);await db.query('UPDATE patient_accounts SET revoked_at=NULL WHERE patient_id=? AND user_id=?',[patientId('A'),patient.account.id]);
   const loggedOut=await enroll(patientUserId('A'));const expired=await request(`/messages/${row.id}/play`,loggedOut.token,{});await store.logout(await store.actor(loggedOut.token));const no=await fetch(origin+expired.path,{headers:{Authorization:'Media '+expired.token}});assert.equal(no.status,401);
  });
  await t.test('invalid audio, excessive length, changed-content retry and storage limits do not publish',async()=>{
   const row=await request('/messages',provider.token,{patientId:patientId('A'),requestKey:randomUUID()});await upload(row.id,provider.token,Buffer.from('not audio'));await messages.tick();let history=await request('/messages/history',provider.token,{patientId:patientId('A')});assert.equal(history.entries.find((r:any)=>r.id===row.id).state,'failed');await upload(row.id,provider.token,audio,409);
   const long=join(root,'long.wav');execFileSync('/usr/bin/ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=4','-threads','1',long]);const longMessage=await request('/messages',provider.token,{patientId:patientId('A'),requestKey:randomUUID()});await upload(longMessage.id,provider.token,await readFile(long));await messages.tick();history=await request('/messages/history',provider.token,{patientId:patientId('A')});assert.equal(history.entries.find((r:any)=>r.id===longMessage.id).state,'failed');
   const pending=await request('/messages',provider.token,{patientId:patientId('A'),requestKey:randomUUID()});messages.config.maxStorage=1;await upload(pending.id,provider.token,audio,507);messages.config.maxStorage=1024*1024*1024;
  });
  await t.test('native-style replies and stable history pagination preserve source IDs',async()=>{
   const row=await request('/messages',patient.token,{patientId:patientId('A'),requestKey:randomUUID(),recipientStaffId:providerId});await upload(row.id,patient.token,audio);await messages.tick();
   // Equal timestamp entries exercise the kind/id cursor boundary.
   for(let i=0;i<32;i++)await request('/messages',provider.token,{patientId:patientId('A'),requestKey:randomUUID()});
   const first=await request('/messages/history',provider.token,{patientId:patientId('A')});assert.equal(first.entries.length,30);assert(first.next);const second=await request('/messages/history',provider.token,{patientId:patientId('A'),cursor:first.next});assert(second.entries.length>0);assert(!second.entries.some((r:any)=>first.entries.some((a:any)=>a.kind===r.kind&&a.id===r.id)));assert([...first.entries,...second.entries].some((r:any)=>r.id===row.id));
  });
  await t.test('real Chromium records, previews, uploads, plays and replies through the UI',async()=>{
   const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});const p=await browser.newContext({permissions:['microphone']}),a=await browser.newContext({permissions:['microphone']});
   try{const providerPage=await p.newPage(),patientPage=await a.newPage();
    for(const [page,user] of [[providerPage,providerId],[patientPage,patientUserId('A')]] as const){await page.goto(origin);await page.getByLabel('One-time enrollment code').fill(await issue(user));await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.locator('#audio-messages').getByRole('button',{name:/Patient A/}).waitFor();}
    const compose=providerPage.locator('#audio-messages');await compose.getByRole('button',{name:'Record audio message',exact:true}).click();await compose.getByRole('button',{name:'Stop recording',exact:true}).waitFor();await new Promise(r=>setTimeout(r,700));await compose.getByRole('button',{name:'Stop recording',exact:true}).click();await compose.getByRole('button',{name:'Preview recording'}).click();await compose.getByRole('button',{name:'Send audio message'}).click();await compose.getByText('Saved for processing.',{exact:false}).waitFor();await messages.tick();
    const inbox=patientPage.locator('#audio-messages');await inbox.getByRole('button',{name:'Play audio message',exact:true}).last().waitFor();await inbox.getByRole('button',{name:'Play audio message',exact:true}).last().click();await inbox.getByRole('button',{name:'Pause playback',exact:true}).waitFor();
    await inbox.getByRole('button',{name:'Record reply',exact:true}).last().click();await inbox.getByRole('button',{name:'Stop recording'}).waitFor();await new Promise(r=>setTimeout(r,700));await inbox.getByRole('button',{name:'Stop recording'}).click();await inbox.getByRole('button',{name:'Send audio message'}).click();await inbox.getByText('Saved for processing.',{exact:false}).waitFor();await messages.tick();
   }finally{await p.close();await a.close();await browser.close();}
  });
  await t.test('expiry removes audio while preserving message history and denies old grants',async()=>{
   const p=await enroll(patientUserId('C'));const grant=await request(`/messages/${id}/play`,p.token,{});clock+=8*86400000;await messages.sweep();const actor=await enroll(patientUserId('C'));const h=await request('/messages/history',actor.token,{patientId:patientId('C')});assert.equal(h.entries.find((r:any)=>r.id===id).state,'expired');const r=await fetch(origin+grant.path,{headers:{Authorization:'Media '+grant.token}});assert.equal(r.status,401);
  });
 }finally{await messages.stop();await server.close();await db.query("SELECT RELEASE_LOCK('phoneapp:test-suite')");await db.end();assert(root.startsWith(join(tmpdir(),'phoneapp-message-test-')));await rm(root,{recursive:true,force:true});}
});
