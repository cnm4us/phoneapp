import assert from 'node:assert/strict';
import test from 'node:test';
import {AccountClient,type NativeAccounts} from './client';
import type {CallRecord,Dashboard,Enrollment} from '../../shared/accounts';
const enrolled:Enrollment={token:'synthetic-access-token',expiresAt:new Date(Date.now()+3600000).toISOString(),account:{id:'synthetic-patient',displayName:'Patient A',role:'patient'}};
const call:CallRecord={id:'synthetic-call',patientId:'synthetic-patient-id',patientName:'Patient A',callerName:'Provider',direction:'incoming',state:'accepted',createdAt:new Date().toISOString(),endedAt:null,observedSeconds:0,transcriptionStatus:'off',canAnswer:false,ownsMedia:true};
function fixture(){
 let calls:CallRecord[]=[];let joins=0;let ended=0;let muted=false;const requests:string[]=[];const actions:{id:string;action:string}[]=[];
 let fail=false;let hold:Promise<Dashboard>|undefined;
 const native:NativeAccounts={enroll:async()=>enrolled,restore:async()=>enrolled,request:async path=>{requests.push(path);if(fail)throw Object.assign(new Error('Enrollment revoked'),{code:'UNAUTHORIZED'});if(path==='/dashboard')return hold??{account:enrolled.account,patients:[],calls};if(path.endsWith('/end')){calls=calls.map(c=>({...c,state:'ended'}));return {};}if(path.endsWith('/media'))return {invitation:{roomId:'synthetic-room',token:'synthetic-capability',expiresAt:Date.now()+60000}};return {};},sync:async()=>{},actions:async()=>actions.splice(0),answer:async id=>{actions.push({id,action:'answer'});},end:async()=>{}};
 const client=new AccountClient('https://unused.invalid',{join:async()=>{joins++;muted=false;},end:()=>{ended++;},phase:()=>joins?'connected':'idle',setMuted:value=>{muted=value;}},native);
 return {client,requests,actions,muted:()=>muted,setCalls:(value:CallRecord[])=>calls=value,fail:()=>fail=true,hold:(value:Promise<Dashboard>)=>hold=value,joins:()=>joins,ended:()=>ended};
}
test('native restoration joins an owned answered call without an enrollment code or JS media timer',async()=>{const f=fixture();try{f.setCalls([call]);await f.client.restore();assert.equal(f.client.state.account?.id,enrolled.account.id);assert.equal(f.client.state.current?.id,call.id);assert.equal(f.joins(),1);f.client.mediaChanged('connected');assert(!f.requests.some(p=>p.endsWith('/presence')));await f.client.refresh();assert.equal(f.joins(),1);}finally{f.client.dispose();}});
test('revocation clears restored account and media rather than retaining a stale signed-in screen',async()=>{const f=fixture();try{await f.client.restore();f.fail();await f.client.refresh();assert.equal(f.client.state.account,undefined);assert.equal(f.client.state.current,undefined);assert(f.ended()>0);}finally{f.client.dispose();}});
test('a late dashboard after sign-out cannot restore a call or sign-in',async()=>{const f=fixture();try{await f.client.restore();let complete!:(value:Dashboard)=>void;f.hold(new Promise(resolve=>complete=resolve));const pending=f.client.refresh();await f.client.signOut();complete({account:enrolled.account,patients:[],calls:[call]});await pending;assert.equal(f.client.state.account,undefined);assert.equal(f.client.state.current,undefined);assert.equal(f.joins(),0);}finally{f.client.dispose();}});

test('a system mute queued before native Answer finishes survives media startup',async()=>{const f=fixture();try{f.actions.push({id:call.id,action:'answer'},{id:call.id,action:'mute',muted:'true'} as any);f.setCalls([call]);await f.client.restore();assert.equal(f.joins(),1);assert.equal(f.muted(),true);}finally{f.client.dispose();}});

test('sign-out clears a prior system mute before a new call',async()=>{const f=fixture();try{f.actions.push({id:call.id,action:'answer'},{id:call.id,action:'mute',muted:'true'} as any);f.setCalls([call]);await f.client.restore();await f.client.signOut();f.setCalls([{...call,id:'another-call'}]);await f.client.restore();assert.equal(f.joins(),2);assert.equal(f.muted(),false);}finally{f.client.dispose();}});

test('browser cookie transport restores without a bearer and an offline sign-out remains visibly signed in',async()=>{
 const original=globalThis.fetch;let offline=false;const seen:RequestInit[]=[];
 const client=new AccountClient('https://browser.invalid',{join:async()=>{},end:()=>{},phase:()=> 'idle'},undefined,true);
 globalThis.fetch=async(input,options)=>{seen.push(options||{});if(String(input).endsWith('/logout')&&offline)throw new TypeError('Offline');return new Response(JSON.stringify(String(input).endsWith('/browser/session')?{...enrolled,token:'browser-session'}:String(input).endsWith('/dashboard')?{account:enrolled.account,patients:[],calls:[]}:{ok:true}),{status:200,headers:{'Content-Type':'application/json'}});};
 try{await client.restore();assert.equal(client.state.account?.id,enrolled.account.id);assert(seen.every(r=>r.credentials==='same-origin'&&new Headers(r.headers).get('X-Phoneapp-Browser')==='1'&&!new Headers(r.headers).has('Authorization')));offline=true;await client.signOut();assert.equal(client.state.account?.id,enrolled.account.id);assert.match(client.state.error,/Could not sign out/);offline=false;await client.signOut();assert.equal(client.state.account,undefined);}finally{client.dispose();globalThis.fetch=original;}
});

test('a stale browser 401 cannot clear a more recently restored account',async()=>{
 const original=globalThis.fetch;let complete!:(r:Response)=>void;
 const client=new AccountClient('https://browser.invalid',{join:async()=>{},end:()=>{},phase:()=> 'idle'},undefined,true);
 globalThis.fetch=async input=>String(input).endsWith('/pending')?new Promise(r=>complete=r):new Response(JSON.stringify(String(input).endsWith('/browser/session')?{...enrolled,token:'browser-session'}:String(input).endsWith('/dashboard')?{account:enrolled.account,patients:[],calls:[]}:{ok:true}),{status:200});
 try{await client.restore();const pending=client.request('/pending');await client.signOut();await client.restore();complete(new Response(JSON.stringify({error:'Old session revoked'}),{status:401}));await assert.rejects(pending);assert.equal(client.state.account?.id,enrolled.account.id);}finally{client.dispose();globalThis.fetch=original;}
});

test('native HTTP access failures retain their status for safe quiet-refresh handling',async()=>{const f=fixture();try{assert(f.client.native);f.client.native.request=async()=>{throw Object.assign(new Error('Communication unavailable'),{code:'HTTP_404'});};await assert.rejects(f.client.request('/communications/private'),(e:any)=>e.status===404);assert.equal(f.client.state.account,undefined);}finally{f.client.dispose();}});
