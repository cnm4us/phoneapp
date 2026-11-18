import { connect as http2connect } from 'node:http2';
import { createPrivateKey, sign, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { APP_ID, SecretBox } from './device-auth';
import { AccountsStore,utc,hash } from './accounts-store';
export type PushRequest={provider:string;environment:string;token:string;callId:string;expiresAt:number};
export type PushResult={accepted:boolean;invalidToken?:boolean;retry?:boolean;code:string};
export type Sender=(request:PushRequest)=>Promise<PushResult>;
const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString('base64url');
export function providerSender(env:NodeJS.ProcessEnv):Sender {
 const apple=env.APNS_KEY_PATH?createPrivateKey(readFileSync(env.APNS_KEY_PATH)):undefined;
 const google=env.FCM_CREDENTIALS_PATH?JSON.parse(readFileSync(env.FCM_CREDENTIALS_PATH,'utf8')):undefined;
 let oauth='',oauthExpires=0;
 return async request=>{
  const ttl=Math.max(0,Math.floor((request.expiresAt-Date.now())/1000));
  if(!ttl)return {accepted:false,code:'expired'};
  if(request.provider==='apns_voip'){
   if(!apple||!env.APNS_TEAM_ID||!env.APNS_KEY_ID||request.environment!=='production')return {accepted:false,code:'apns-unconfigured'};
   const header=encode({alg:'ES256',kid:env.APNS_KEY_ID}),body=encode({iss:env.APNS_TEAM_ID,iat:Math.floor(Date.now()/1000)});
   const jwt=`${header}.${body}.${sign('sha256',Buffer.from(`${header}.${body}`),{key:apple,dsaEncoding:'ieee-p1363'}).toString('base64url')}`;
   return new Promise<PushResult>(resolve=>{
    const client=http2connect('https://api.push.apple.com');let done=false;
    const finish=(r:PushResult)=>{if(done)return;done=true;clearTimeout(timeout);client.destroy();resolve(r);};
    const timeout=setTimeout(()=>finish({accepted:false,code:'apns-timeout',retry:true}),8000);
    client.on('error',()=>finish({accepted:false,code:'apns-network',retry:true}));
    const req=client.request({':method':'POST',':path':`/3/device/${request.token}`,'authorization':`bearer ${jwt}`,'apns-topic':`${APP_ID}.voip`,'apns-push-type':'voip','apns-priority':'10','apns-expiration':'0','apns-id':randomUUID()});
    let status=0,result='';req.on('response',h=>status=Number(h[':status']));req.on('data',c=>{if(result.length<4096)result+=c.toString();});
    req.on('error',()=>finish({accepted:false,code:'apns-network',retry:true}));
    req.on('end',()=>{let reason='';try{reason=JSON.parse(result).reason;}catch{}finish({accepted:status===200,invalidToken:[410].includes(status)||['BadDeviceToken','DeviceTokenNotForTopic','Unregistered'].includes(reason),retry:status===429||status>=500,code:`apns-${status}`});});
    req.end(JSON.stringify({aps:{},callId:request.callId,expiresAt:request.expiresAt}));
   });
  }
  if(!google||google.type!=='service_account'||google.project_id!==env.FCM_PROJECT_ID||google.token_uri!=='https://oauth2.googleapis.com/token')return {accepted:false,code:'fcm-unconfigured'};
  if(oauthExpires<Date.now()){
   const now=Math.floor(Date.now()/1000),unsigned=encode({alg:'RS256',typ:'JWT',kid:google.private_key_id})+'.'+encode({iss:google.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
   const assertion=unsigned+'.'+sign('RSA-SHA256',Buffer.from(unsigned),google.private_key).toString('base64url');
   const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(8000)});
   const value=await response.json() as any;if(!response.ok||!value.access_token)return {accepted:false,code:'fcm-auth',retry:response.status>=500};oauth=value.access_token;oauthExpires=Date.now()+Math.max(0,Number(value.expires_in)-120)*1000;
  }
  const response=await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(google.project_id)}/messages:send`,{method:'POST',headers:{Authorization:`Bearer ${oauth}`,'Content-Type':'application/json'},body:JSON.stringify({message:{token:request.token,android:{priority:'HIGH',ttl:`${Math.min(ttl,60)}s`},data:{callId:request.callId,expiresAt:String(request.expiresAt)}}}),signal:AbortSignal.timeout(8000)});
  const value=await response.json() as any;
  const invalid=value.error?.details?.some((v:any)=>v.errorCode==='UNREGISTERED');
  if(response.status===401)oauthExpires=0;
  return {accepted:response.ok,invalidToken:invalid,retry:response.status===429||response.status>=500,code:`fcm-${response.status}`};
 };
}
export class PushWorker {
 private running=false;private timer?:ReturnType<typeof setInterval>;
 constructor(readonly store:AccountsStore,readonly box:SecretBox,readonly sender:Sender){}
 start():void{this.timer=setInterval(()=>void this.tick(),1000);this.timer.unref();}
 stop():void{clearInterval(this.timer);}
 async tick():Promise<void>{
  if(this.running)return;this.running=true;
  try{
   const job=await this.store.transaction(async db=>{
    const now=utc(this.store.now());
    await db.query("UPDATE push_deliveries p JOIN calls c ON c.id=p.call_id JOIN devices d ON d.id=p.device_id SET p.state='expired' WHERE p.state IN ('pending','sending') AND (p.expires_at<=? OR c.state<>'ringing' OR d.revoked_at IS NOT NULL)",[now]);
    // An interrupted 'sending' is not retried for VoIP: uncertainty must not create a second system ring.
    await db.query("UPDATE push_deliveries SET state='failed',last_error='worker-interrupted' WHERE state='sending' AND available_at<?",[utc(this.store.now()-30_000)]);
    const [row]=await db.query("SELECT p.*,d.push_provider,d.push_environment,d.push_token_ciphertext,d.push_token_hash FROM push_deliveries p JOIN devices d ON d.id=p.device_id JOIN calls c ON c.id=p.call_id JOIN users u ON u.id=d.user_id WHERE p.state='pending' AND p.available_at<=? AND p.expires_at>? AND c.state='ringing' AND d.revoked_at IS NULL AND u.status='active' ORDER BY p.available_at LIMIT 1 FOR UPDATE",[now,now]);
    if(!row)return null;
    // Current patient relationship is checked again immediately before delivery.
    const [call]=await db.query('SELECT patient_id FROM calls WHERE id=?',[row.call_id]);
    const [d]=await db.query('SELECT user_id FROM devices WHERE id=?',[row.device_id]);
    if(!await this.store.permitted(db,d.user_id,call.patient_id)){await db.query("UPDATE push_deliveries SET state='expired' WHERE id=?",[row.id]);return null;}
    await db.query("UPDATE push_deliveries SET state='sending',attempts=attempts+1,available_at=? WHERE id=?",[now,row.id]);return row;
   });
   if(!job)return;
   let result:PushResult;
   try {result=await this.sender({provider:job.push_provider,environment:job.push_environment,token:this.box.open(job.push_token_ciphertext),callId:job.call_id,expiresAt:Date.parse(job.expires_at.replace(' ','T')+'Z')});}
   catch{result={accepted:false,code:'provider-unavailable',retry:false};}
   await this.store.transaction(async db=>{
    const retry=result.retry&&job.push_provider!=='apns_voip'&&job.attempts<2;
    await db.query("UPDATE push_deliveries SET state=?,last_error=?,available_at=? WHERE id=? AND state='sending'",[result.accepted?'accepted':retry?'pending':'failed',result.code,utc(this.store.now()+3000),job.id]);
    if(result.invalidToken)await db.query("UPDATE devices SET push_provider='none',push_token_ciphertext=NULL,push_token_hash=NULL WHERE id=? AND push_token_hash=?",[job.device_id,job.push_token_hash]);
   });
  }catch{/* Sanitized worker failures are retried by the next bounded sweep; never log credentials. */}finally{this.running=false;}
 }
}
