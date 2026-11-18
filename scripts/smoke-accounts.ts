import { randomBytes,randomUUID } from 'node:crypto';
import { loadConfiguration,connect,safeError } from '../database/connection';
import { hash,utc } from '../server/accounts-store';
import { providerId,patientUserId,patientId } from '../database/seed';
import type { Enrollment,Dashboard } from '../shared/accounts';

async function main():Promise<void>{
  loadConfiguration();
  const origin=process.env.PHONEAPP_ACCOUNT_URL || 'https://phoneapp.bawebtech.com';
  const parsed=new URL(origin);
  if(parsed.protocol!=='https:' || parsed.origin!==origin)throw new Error('Account smoke requires an HTTPS origin');
  let ready=false;
  for(let attempt=0;attempt<10&&!ready;attempt++){
    try{ready=(await fetch(`${origin}/health`,{signal:AbortSignal.timeout(2_000)})).ok;}catch{}
    if(!ready)await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!ready)throw new Error('Public account service health is not ready');
  const db=await connect('dev');
  const tokens:string[]=[];let id='';
  const request=async<T>(path:string,token?:string,body?:unknown):Promise<T>=>{
    const response=await fetch(`${origin}/api${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10_000)});
    if(!response.ok)throw new Error(`Account smoke HTTP ${response.status}`);
    return response.json() as Promise<T>;
  };
  try{
    for(const user of [providerId,patientUserId('A')]){
      const [record]=await db.query('SELECT auth_issuer FROM users WHERE id=?',[user]);
      if(!record || record.auth_issuer && record.auth_issuer!=='phoneapp:synthetic-enrollment')throw new Error('Expected synthetic account only');
      const code=randomBytes(32).toString('base64url');
      await db.query('INSERT INTO enrollment_codes (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)',[randomUUID(),user,hash(code),utc(Date.now()+60_000)]);
      const session=await request<Enrollment>('/enroll',undefined,{code});tokens.push(session.token);
    }
    const [provider,patient]=tokens;
    const directory=await request<Dashboard>('/dashboard',provider);
    if(directory.patients.length!==3)throw new Error('Synthetic directory mismatch');
    ({id}=await request<{id:string}>('/calls',provider,{patientId:patientId('A'),requestKey:randomUUID()}));
    const incoming=await request<Dashboard>('/dashboard',patient);
    if(!incoming.calls.some(call=>call.id===id&&call.canAnswer))throw new Error('Incoming call not found');
    await request(`/calls/${id}/answer`,patient,{});
    await request(`/calls/${id}/end`,provider,{});
    for(const token of tokens){
      const result=await request<Dashboard>('/dashboard',token);
      if(!result.calls.some(call=>call.id===id&&call.state==='ended'&&call.observedSeconds===0))throw new Error('Shared history mismatch');
    }
    console.log('Public synthetic account enrollment, directory, incoming answer and shared ended history passed. No media or recording.');
  }finally{
    if(id&&tokens[0])await request(`/calls/${id}/end`,tokens[0],{}).catch(()=>{});
    for(const token of tokens)await request('/logout',token,{}).catch(()=>{});
    await db.end();
  }
}
main().catch(error=>{console.error(safeError(error));process.exitCode=1;});
