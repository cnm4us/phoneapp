import assert from 'node:assert/strict';
import test from 'node:test';
import {AccountClient,type NativeAccounts} from './client';
import type {CallRecord,Dashboard,Enrollment} from '../../shared/accounts';
const enrolled:Enrollment={token:'synthetic-access-token',expiresAt:new Date(Date.now()+3600000).toISOString(),account:{id:'synthetic-patient',displayName:'Patient A',role:'patient'}};
const call:CallRecord={id:'synthetic-call',patientId:'synthetic-patient-id',patientName:'Patient A',callerName:'Provider',direction:'incoming',state:'accepted',createdAt:new Date().toISOString(),endedAt:null,observedSeconds:0,transcriptionStatus:'off',canAnswer:false,ownsMedia:true};
function fixture(){
 let calls:CallRecord[]=[];let joins=0;let ended=0;const requests:string[]=[];const actions:{id:string;action:string}[]=[];
 let fail=false;let hold:Promise<Dashboard>|undefined;
 const native:NativeAccounts={enroll:async()=>enrolled,restore:async()=>enrolled,request:async path=>{requests.push(path);if(fail)throw Object.assign(new Error('Enrollment revoked'),{code:'UNAUTHORIZED'});if(path==='/dashboard')return hold??{account:enrolled.account,patients:[],calls};if(path.endsWith('/media'))return {invitation:{roomId:'synthetic-room',token:'synthetic-capability',expiresAt:Date.now()+60000}};return {};},sync:async()=>{},actions:async()=>actions.splice(0),answer:async id=>{actions.push({id,action:'answer'});},end:async()=>{}};
 const client=new AccountClient('https://unused.invalid',{join:async()=>{joins++;},end:()=>{ended++;},phase:()=>joins?'connected':'idle'},native);
 return {client,requests,setCalls:(value:CallRecord[])=>calls=value,fail:()=>fail=true,hold:(value:Promise<Dashboard>)=>hold=value,joins:()=>joins,ended:()=>ended};
}
test('native restoration joins an owned answered call without an enrollment code or JS media timer',async()=>{const f=fixture();try{f.setCalls([call]);await f.client.restore();assert.equal(f.client.state.account?.id,enrolled.account.id);assert.equal(f.client.state.current?.id,call.id);assert.equal(f.joins(),1);f.client.mediaChanged('connected');assert(!f.requests.some(p=>p.endsWith('/presence')));await f.client.refresh();assert.equal(f.joins(),1);}finally{f.client.dispose();}});
test('revocation clears restored account and media rather than retaining a stale signed-in screen',async()=>{const f=fixture();try{await f.client.restore();f.fail();await f.client.refresh();assert.equal(f.client.state.account,undefined);assert.equal(f.client.state.current,undefined);assert(f.ended()>0);}finally{f.client.dispose();}});
test('a late dashboard after sign-out cannot restore a call or sign-in',async()=>{const f=fixture();try{await f.client.restore();let complete!:(value:Dashboard)=>void;f.hold(new Promise(resolve=>complete=resolve));const pending=f.client.refresh();await f.client.signOut();complete({account:enrolled.account,patients:[],calls:[call]});await pending;assert.equal(f.client.state.account,undefined);assert.equal(f.client.state.current,undefined);assert.equal(f.joins(),0);}finally{f.client.dispose();}});
