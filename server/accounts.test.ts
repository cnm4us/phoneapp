import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import test from 'node:test';
import { resolve } from 'node:path';
import { chromium,expect } from '@playwright/test';
import { WebSocket } from 'ws';
import { loadConfiguration,connect } from '../database/connection';
import { migrate } from '../database/migrate';
import { seed,providerId,patientId,patientUserId } from '../database/seed';
import { AccountsStore,hash,utc } from './accounts-store';
import { AccountsApi } from './accounts-api';
import { createSignaling } from './server';
import type { Enrollment,Dashboard } from '../shared/accounts';
import type { Invitation } from '../shared/protocol';

test('authenticated foreground calls on isolated MariaDB and real browser media',{timeout:120_000},async t=>{
  loadConfiguration();
  const db=await connect('test','migration');
  const [locked]=await db.query("SELECT GET_LOCK('phoneapp:test-suite',0) AS acquired");
  assert.equal(Number(locked.acquired),1,'Another DB suite owns the disposable target');
  await migrate(db);await seed(db);
  let clock=Date.now();
  const store=new AccountsStore('test',()=>clock);
  let api:AccountsApi;
  let server:ReturnType<typeof createSignaling>;
  let origin='';
  async function start():Promise<void>{
    server=createSignaling({accessKey:'synthetic-test-creator-key-not-a-secret',webRoot:resolve('web/dist'),apiHandler:(req,res)=>api.handle(req,res),authorizePrivateJoin:(session,call)=>store.authorizeMedia(session,call),privateRoomEnded:id=>api.roomClosed(id)});
    api=new AccountsApi(store,server);
    await api.start();
    await new Promise<void>(resolve=>server.http.listen(0,'127.0.0.1',resolve));
    const address=server.http.address();assert(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;
  }
  async function request<T=Record<string,unknown>>(path:string,token?:string,body?:unknown,status=200):Promise<T>{
    const response=await fetch(`${origin}/api${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    assert.equal(response.status,status,`HTTP status for ${path}`);
    return response.json() as Promise<T>;
  }
  async function issue(user:string,expired=false):Promise<string>{
    const code=randomBytes(32).toString('base64url');
    await db.query('INSERT INTO enrollment_codes (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)',[randomUUID(),user,hash(code),utc(clock+(expired?-1:24*60*60_000))]);
    return code;
  }
  async function login(user:string):Promise<Enrollment>{return request<Enrollment>('/enroll',undefined,{code:await issue(user)});}
  const dial=async(token:string,letter='A',key=randomUUID())=>request<{id:string}>('/calls',token,{patientId:patientId(letter),requestKey:key},201);
  const dashboard=(token:string)=>request<Dashboard>('/dashboard',token);
  let provider:Enrollment,a:Enrollment,b:Enrollment,a2:Enrollment;
  try{
    await start();
    await t.test('one-use enrollment, expired codes, role spoofing and patient directory isolation',async()=>{
      await request('/dashboard',undefined,undefined,401);
      const code=await issue(providerId);
      await request('/enroll',undefined,{code,role:'admin'},400);
      provider=await request<Enrollment>('/enroll',undefined,{code});
      assert.equal(provider.account.role,'practitioner');
      await request('/enroll',undefined,{code},401);
      await request('/enroll',undefined,{code:await issue(patientUserId('A'),true)},401);
      a=await login(patientUserId('A'));b=await login(patientUserId('B'));a2=await login(patientUserId('A'));
      assert.equal((await dashboard(provider.token)).patients.length,3);
      assert.equal((await dashboard(a.token)).patients.length,0);
      await request('/calls',a.token,{patientId:patientId('A'),requestKey:randomUUID()},404);
      const outsider=randomUUID();
      await db.query("INSERT INTO users (id,display_name,role) VALUES (?,'Synthetic unassigned RN','rn')",[outsider]);
      const unassigned=await login(outsider);
      assert.equal((await dashboard(unassigned.token)).patients.length,0);
      await request('/calls',unassigned.token,{patientId:patientId('A'),requestKey:randomUUID()},404);
    });
    await t.test('call retries, competing answers, call-scoped media and bounded observed intervals',async()=>{
      const key=randomUUID();const {id}=await dial(provider.token,'A',key);
      assert.equal((await dial(provider.token,'A',key)).id,id);
      await request('/calls',provider.token,{patientId:patientId('B'),requestKey:key},409);
      assert((await dashboard(a.token)).calls.some(call=>call.id===id&&call.canAnswer));
      assert(!(await dashboard(b.token)).calls.some(call=>call.id===id));
      await request(`/calls/${id}/answer`,b.token,{},404);
      await request(`/calls/${id}/media`,provider.token,{},409);
      const answers=await Promise.all([a,a2].map(account=>fetch(`${origin}/api/calls/${id}/answer`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${account.token}`},body:'{}'})));
      assert.deepEqual(answers.map(response=>response.status).sort(),[200,409]);
      const winner=answers[0].status===200?a:a2,loser=winner===a?a2:a;
      await request(`/calls/${id}/end`,loser.token,{},409);
      await request(`/calls/${id}/media`,loser.token,{},409);
      await request(`/calls/${id}/media`,b.token,{},404);
      const callerInvite=await request<{invitation:Invitation}>(`/calls/${id}/media`,provider.token,{});
      const patientInvite=await request<{invitation:Invitation}>(`/calls/${id}/media`,winner.token,{});
      assert.equal(callerInvite.invitation.roomId,patientInvite.invitation.roomId);
      assert.notEqual(callerInvite.invitation.token,patientInvite.invitation.token);
      assert.equal(callerInvite.invitation.code,undefined);
      // A random capability cannot join an account room.
      const socket=new WebSocket(origin.replace('http','ws')+'/signal');
      await new Promise<void>(resolve=>socket.once('open',resolve));
      const message=new Promise<string>(resolve=>socket.once('message',raw=>resolve(JSON.parse(raw.toString()).type)));
      socket.send(JSON.stringify({type:'join',roomId:callerInvite.invitation.roomId,token:randomBytes(24).toString('base64url')}));
      assert.equal(await message,'error');socket.close();
      for(const account of [provider,winner])await request(`/calls/${id}/presence`,account.token,{connected:true,eventKey:'connected'});
      clock+=5_600;
      await request(`/calls/${id}/presence`,provider.token,{connected:true,eventKey:'heartbeat-1'});
      await request(`/calls/${id}/presence`,provider.token,{connected:true,eventKey:'heartbeat-1'});
      await request(`/calls/${id}/presence`,winner.token,{connected:false,eventKey:'interruption'});
      clock+=4_300;
      await request(`/calls/${id}/presence`,winner.token,{connected:true,eventKey:'resume'});
      clock+=2_500;
      await request(`/calls/${id}/end`,provider.token,{});
      await request(`/calls/${id}/end`,provider.token,{});
      const call=(await dashboard(provider.token)).calls.find(row=>row.id===id)!;
      assert.equal(call.state,'ended');assert.equal(call.observedSeconds,8);
      assert.equal((await dashboard(winner.token)).calls.find(row=>row.id===id)?.observedSeconds,8);
      assert.equal(call.transcriptionStatus,'off');
      await request(`/calls/${id}/media`,provider.token,{},409);
    });
    await t.test('cancel, decline, missed, setup timeout, revocation and relationship loss',async()=>{
      let call=await dial(provider.token);await request(`/calls/${call.id}/cancel`,provider.token,{});
      assert.equal((await dashboard(a.token)).calls.find(row=>row.id===call.id)?.state,'canceled');
      call=await dial(provider.token);await request(`/calls/${call.id}/decline`,a.token,{});
      assert.equal((await dashboard(provider.token)).calls.find(row=>row.id===call.id)?.state,'declined');
      call=await dial(provider.token);clock+=60_001;await api.sweep();
      assert.equal((await dashboard(a.token)).calls.find(row=>row.id===call.id)?.state,'missed');
      call=await dial(provider.token);await request(`/calls/${call.id}/answer`,a.token,{});clock+=45_001;await api.sweep();
      assert.equal((await dashboard(a.token)).calls.find(row=>row.id===call.id)?.state,'failed');
      const revoked=await login(patientUserId('A'));await request('/logout',revoked.token,{});await request('/dashboard',revoked.token,undefined,401);
      call=await dial(provider.token);
      await db.query('UPDATE patient_assignments SET revoked_at=? WHERE patient_id=? AND staff_user_id=?',[utc(clock),patientId('A'),providerId]);
      assert(!(await dashboard(provider.token)).calls.some(row=>row.id===call.id));
      await request(`/calls/${call.id}/end`,provider.token,{},404);
      await api.sweep();
      assert.equal((await dashboard(a.token)).calls.find(row=>row.id===call.id)?.state,'failed');
      await db.query('UPDATE patient_assignments SET revoked_at=NULL WHERE patient_id=? AND staff_user_id=?',[patientId('A'),providerId]);
    });
    await t.test('durable history and session survive server restart; orphaned active calls fail honestly',async()=>{
      const {id}=await dial(provider.token);
      await server.close();await api.stop();await start();
      const call=(await dashboard(provider.token)).calls.find(row=>row.id===id);
      assert.equal(call?.state,'failed');assert.equal(call?.observedSeconds,0);
      assert((await dashboard(a.token)).calls.some(row=>row.id===id&&row.state==='failed'));
    });
    await t.test('oversized bodies, session expiry and enrollment attempt bound',async()=>{
      await request('/enroll',undefined,{code:'x'.repeat(5000)},413);
      const expired=await login(patientUserId('B'));
      await db.query('UPDATE auth_sessions SET expires_at=? WHERE token_hash=?',[utc(clock-1),hash(expired.token)]);
      await request('/dashboard',expired.token,undefined,401);
      // Move into a fresh limiter window, then exhaust only this isolated API.
      clock+=60_001;
      for(let index=0;index<30;index++)await request('/enroll',undefined,{code:'invalid'},400);
      await request('/enroll',undefined,{code:'invalid'},429);
      clock+=60_001;
    });
    await t.test('browser directory → patient answer → real two-way video → shared history',async()=>{
      const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--disable-background-timer-throttling']});
      try{
        const contextA=await browser.newContext({permissions:['camera','microphone']});
        const contextB=await browser.newContext({permissions:['camera','microphone']});
        const pageA=await contextA.newPage(),pageB=await contextB.newPage();
        const errors:string[]=[];
        for(const page of [pageA,pageB])page.on('pageerror',error=>errors.push(error.message));
        for(const [page,user] of [[pageA,providerId],[pageB,patientUserId('A')]] as const){
          await page.goto(origin);
          await page.locator('#enrollment-code').fill(await issue(user));
          await page.getByRole('button',{name:'Sign in',exact:true}).click();
          await expect(page.locator('#accounts')).not.toHaveAttribute('data-role','signed-out');
        }
        await pageA.getByRole('button',{name:'Patient A',exact:true}).click();
        await pageA.getByRole('button',{name:'App Audio/Video',exact:true}).click();
        await expect(pageB.getByRole('heading',{name:'Incoming app call'})).toBeVisible({timeout:12_000});
        await pageB.getByRole('button',{name:'Answer with audio/video'}).click();
        for(const page of [pageA,pageB]){
          await expect(page.locator('body')).toHaveAttribute('data-state','connected',{timeout:25_000});
          await expect.poll(()=>page.locator('#remote').evaluate(video=>(video as HTMLVideoElement).videoWidth),{timeout:15_000}).toBeGreaterThan(0);
          await expect.poll(()=>page.locator('#received').getAttribute('data-bytes').then(Number),{timeout:15_000}).toBeGreaterThan(0);
        }
        const [row]=await db.query("SELECT c.id FROM calls c JOIN call_runtime r ON r.call_id=c.id WHERE c.state='connected' ORDER BY c.created_at DESC LIMIT 1");
        await pageA.locator('#hangup').click();
        for(const page of [pageA,pageB]){
          await expect(page.locator('body')).toHaveAttribute('data-state','ended',{timeout:15_000});
          await expect(page.locator(`[data-call-id="${row.id}"]`)).toHaveAttribute('data-call-state','ended',{timeout:15_000});
          await expect(page.locator(`[data-call-id="${row.id}"]`)).toContainText('Recording / transcript: Off');
        }
        assert.deepEqual(errors,[]);
        await contextA.close();await contextB.close();
      }finally{await browser.close();}
    });
  }finally{
    if(server!)await server.close();if(api!)await api.stop();await db.end();
  }
});
