import assert from 'node:assert/strict';
import test from 'node:test';
import {randomBytes,randomUUID} from 'node:crypto';
import {createServer as httpsServer} from 'node:https';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {connect,loadConfiguration} from '../database/connection';
import {migrate} from '../database/migrate';
import {seed,providerId,patientUserId} from '../database/seed';
import {AccountsStore,hash,utc} from './accounts-store';
import {AccountsApi} from './accounts-api';
import {createSignaling} from './server';
import {browserCookie} from './browser-session';

test('persistent browser sessions on real HTTPS and isolated MariaDB',{timeout:90000},async t=>{
 loadConfiguration();const db=await connect('test');const [lock]=await db.query("SELECT GET_LOCK('phoneapp:test-suite',0) AS acquired");assert.equal(Number(lock.acquired),1);await migrate(db);await seed(db);let now=Date.now();const store=new AccountsStore('test',()=>now);
 const dir=await mkdtemp(join(tmpdir(),'phoneapp-browser-auth-'));execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1','-keyout',join(dir,'key.pem'),'-out',join(dir,'cert.pem')],{stdio:'ignore'});
 let api:AccountsApi;const server=createSignaling({accessKey:'browser-session-synthetic-key',webRoot:resolve('web/dist'),apiHandler:(req,res)=>api.handle(req,res)});api=new AccountsApi(store,server);await new Promise<void>(r=>server.http.listen(0,'127.0.0.1',r));const https=httpsServer({key:await readFile(join(dir,'key.pem')),cert:await readFile(join(dir,'cert.pem'))},(req,res)=>server.http.emit('request',req,res));await new Promise<void>(r=>https.listen(0,'127.0.0.1',r));const address=https.address();assert(address&&typeof address!=='string');const origin=`https://127.0.0.1:${address.port}`;const browser=await chromium.launch({headless:true});
 const issue=async(user:string)=>{const code=randomBytes(32).toString('base64url');await db.query('INSERT INTO enrollment_codes(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)',[randomUUID(),user,hash(code),utc(now+86400000)]);return code;};
 const context=()=>browser.newContext({ignoreHTTPSErrors:true});
 try{
  await t.test('sign in once; reload, new tab and restored browser profile retain identity without JS-readable credentials',async()=>{
   const c=await context();let resumed:Awaited<ReturnType<typeof context>>|undefined;
   try{const page=await c.newPage(),code=await issue(providerId);await page.goto(origin);await page.getByLabel('One-time enrollment code').fill(code);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#accounts')).toHaveAttribute('data-role','practitioner');
    const cookie=(await c.cookies()).find(c=>c.name===browserCookie);assert(cookie);assert(cookie.secure&&cookie.httpOnly);assert.equal(cookie.sameSite,'Strict');assert(cookie.expires>Date.now()/1000+29*86400);assert(cookie.expires<Date.now()/1000+31*86400);
    assert(!(await page.evaluate(()=>document.cookie)).includes(browserCookie));const storage=await c.storageState();for(const o of storage.origins){const text=JSON.stringify(o.localStorage);assert(!text.includes(code));assert(!text.includes(cookie.value));}
    await page.reload();await expect(page.locator('#accounts')).toHaveAttribute('data-role','practitioner');await expect(page.getByLabel('One-time enrollment code')).toHaveCount(0);
    await page.close();const another=await c.newPage();await another.goto(origin);await expect(another.locator('#accounts')).toHaveAttribute('data-role','practitioner');
    resumed=await browser.newContext({ignoreHTTPSErrors:true,storageState:await c.storageState()});const reopened=await resumed.newPage();await reopened.goto(origin);await expect(reopened.locator('#accounts')).toHaveAttribute('data-role','practitioner');
    await reopened.getByRole('button',{name:'Sign out',exact:true}).click();await expect(reopened.locator('#accounts')).toHaveAttribute('data-role','signed-out');assert(!(await resumed.cookies()).some(c=>c.name===browserCookie));await reopened.reload();await expect(reopened.getByLabel('One-time enrollment code')).toBeVisible();await another.reload();await expect(another.getByLabel('One-time enrollment code')).toBeVisible();
   }finally{await resumed?.close();await c.close();}
  });
  await t.test('the open legacy browser tab upgrades its valid bearer session before reload',async()=>{
   const c=await context();try{const code=await issue(providerId),e=await store.enroll(code);const page=await c.newPage();await page.goto(origin+'/health');const status=await page.evaluate(async token=>(await fetch('/api/dashboard',{headers:{Authorization:'Bearer '+token}})).status,e.token);assert.equal(status,200);
    const cookie=(await c.cookies()).find(c=>c.name===browserCookie);assert(cookie&&cookie.httpOnly&&cookie.secure);assert.equal(cookie.value,e.token);const [row]=await db.query('SELECT expires_at FROM auth_sessions WHERE token_hash=?',[hash(e.token)]);assert(Date.parse(row.expires_at.replace(' ','T')+'Z')>now+29*86400000);
    await page.goto(origin);await expect(page.locator('#accounts')).toHaveAttribute('data-role','practitioner');await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.locator('#accounts')).toHaveAttribute('data-role','signed-out');
   }finally{await c.close();}
  });
  await t.test('cookie actions reject missing guard, hostile Origin and an unexpected account',async()=>{
   const c=await context();try{const code=await issue(providerId);let response=await c.request.post(origin+'/api/browser/enroll',{data:{code},headers:{Origin:'https://untrusted.example','X-Phoneapp-Browser':'1'}});assert.equal(response.status(),403);const [unused]=await db.query('SELECT redeemed_at FROM enrollment_codes WHERE token_hash=?',[hash(code)]);assert.equal(unused.redeemed_at,null);
    response=await c.request.post(origin+'/api/browser/enroll',{data:{code},headers:{Origin:origin,'X-Phoneapp-Browser':'1'}});assert.equal(response.status(),200);const enrollment=await response.json();assert.equal(enrollment.token,'browser-session');assert(!JSON.stringify(enrollment).includes((await c.cookies())[0].value));
    assert.equal((await c.request.post(origin+'/api/logout',{data:{},headers:{Origin:origin}})).status(),401);
    assert.equal((await c.request.post(origin+'/api/logout',{data:{},headers:{Origin:'https://untrusted.example','X-Phoneapp-Browser':'1'}})).status(),403);
    const changed=await c.request.get(origin+'/api/dashboard',{headers:{'X-Phoneapp-Browser':'1','X-Phoneapp-Account':patientUserId('A')}});assert.equal(changed.status(),409);assert.equal((await changed.json()).code,'SESSION_CHANGED');
    assert.equal((await c.request.get(origin+'/api/dashboard',{headers:{'X-Phoneapp-Browser':'1'}})).status(),200);
   }finally{await c.close();}
  });
  await t.test('server expiry is fixed, survives restoration and still rejects a retained cookie',async()=>{
   const c=await context();try{const code=await issue(providerId);await c.request.post(origin+'/api/browser/enroll',{data:{code},headers:{Origin:origin,'X-Phoneapp-Browser':'1'}});const cookie=(await c.cookies()).find(c=>c.name===browserCookie)!;const [before]=await db.query('SELECT expires_at FROM auth_sessions WHERE token_hash=?',[hash(cookie.value)]);
    now+=86400000;const restored=await c.request.get(origin+'/api/browser/session',{headers:{'X-Phoneapp-Browser':'1'}});assert.equal(restored.status(),200);const [after]=await db.query('SELECT expires_at FROM auth_sessions WHERE token_hash=?',[hash(cookie.value)]);assert.equal(after.expires_at,before.expires_at);
    now+=30*86400000;assert.equal((await c.request.get(origin+'/api/browser/session',{headers:{'X-Phoneapp-Browser':'1'}})).status(),401);
   }finally{await c.close();}
  });
 }finally{await browser.close();await new Promise<void>(r=>https.close(()=>r()));await server.close();await db.query("SELECT RELEASE_LOCK('phoneapp:test-suite')");await db.end();await rm(dir,{recursive:true,force:true});}
});
