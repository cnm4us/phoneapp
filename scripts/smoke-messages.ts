// Explicit development smoke: sends one synthetic tone Provider -> Patient C, no push or call.
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,mkdtemp,readFile,chmod,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {loadConfiguration,connect,safeError} from '../database/connection';
import {hash,utc} from '../server/accounts-store';
import {providerId,patientUserId,patientId} from '../database/seed';
async function main(){loadConfiguration();const db=await connect('dev');const origin='https://phoneapp.bawebtech.com';const tokens:string[]=[];let dir='';
 const request=async(path:string,token:string,body?:unknown)=>{const r=await fetch(origin+'/api'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`Audio-message smoke HTTP ${r.status}`);return r.json() as Promise<any>;};
 try{
  for(const user of [providerId,patientUserId('C')]){const [row]=await db.query('SELECT auth_issuer FROM users WHERE id=?',[user]);if(!row||row.auth_issuer&&row.auth_issuer!=='phoneapp:synthetic-enrollment')throw new Error('Synthetic identities required.');const code=randomBytes(32).toString('base64url');await db.query('INSERT INTO enrollment_codes(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)',[randomUUID(),user,hash(code),utc(Date.now()+60000)]);tokens.push((await request('/enroll','',{code})).token);}
  await mkdir(resolve('artifacts/private/audio-messages'),{recursive:true,mode:0o700});dir=await mkdtemp(resolve('artifacts/private/audio-messages/smoke-'));await chmod(dir,0o700);const path=join(dir,'synthetic-tone.wav');execFileSync('/usr/bin/ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=0.75','-ac','1','-threads','1',path]);await chmod(path,0o600);
  const message=await request('/messages',tokens[0],{patientId:patientId('C'),requestKey:randomUUID()});const grant=await request(`/messages/${message.id}/upload`,tokens[0],{});const upload=await fetch(origin+grant.path,{method:'POST',headers:{Authorization:'Media '+grant.token,'Content-Type':'application/octet-stream'},body:await readFile(path),signal:AbortSignal.timeout(15000)});if(!upload.ok)throw new Error(`Public media upload HTTP ${upload.status}`);
  let ready=false;for(let attempt=0;attempt<20;attempt++){const history=await request('/messages/history',tokens[1],{patientId:patientId('C')});if(history.entries.some((m:any)=>m.id===message.id&&m.state==='available')){ready=true;break;}await new Promise(r=>setTimeout(r,1000));}if(!ready)throw new Error('Audio processing did not become available.');
  const playback=await request(`/messages/${message.id}/play`,tokens[1],{});const audio=await fetch(origin+playback.path,{headers:{Authorization:'Media '+playback.token,Range:'bytes=0-31'},signal:AbortSignal.timeout(10000)});if(audio.status!==206||(await audio.arrayBuffer()).byteLength!==32)throw new Error('Public authenticated seekable playback failed.');console.log('Public synthetic audio-message upload, processing, Patient C history and authenticated Range playback passed. No call or notification sent.');
 }finally{for(const token of tokens)await request('/logout',token,{}).catch(()=>{});await db.end();if(dir.startsWith(resolve('artifacts/private/audio-messages/smoke-')))await rm(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(safeError(error));process.exitCode=1;});
