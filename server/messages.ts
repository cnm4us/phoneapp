import {registerCommunication} from './communication-registry';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdir,open,rename,unlink,readdir,stat,statfs,chmod} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve,join} from 'node:path';
import {normalizeMessage,VIDEO,type MediaKind} from './message-media';
import {pipeline} from 'node:stream/promises';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {Connection} from 'mariadb';
import {AccountsStore,ApiError,hash,utc,type Actor} from './accounts-store';
import type {MessageRecord,Timeline,MediaGrant,MessageContext} from '../shared/messages';
type Row=Record<string,any>;
const staff=(role:string)=>['practitioner','rn','ma','admin'].includes(role);
const ms=(v:string)=>Date.parse(v.replace(' ','T')+'Z');
const iso=(v:string|null)=>v?new Date(ms(v)).toISOString():null;
export const validId=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
export type MediaConfig={videoEnabled?:boolean;root:string;maxBytes:number;maxSeconds:number;retentionMs:number;uploadTtlMs:number;maxStorage:number;minFree:number;dailyBytes:number;ffmpeg:string;ffprobe:string};
export function mediaConfig(env:NodeJS.ProcessEnv):MediaConfig{return {videoEnabled:env.ENABLE_VIDEO_MESSAGES==='true',root:resolve(env.MEDIA_STORAGE_ROOT||'/var/lib/phoneapp/media'),maxBytes:10*1024*1024,maxSeconds:180,retentionMs:7*86400000,uploadTtlMs:86400000,maxStorage:1024*1024*1024,minFree:1024*1024*1024,dailyBytes:50*1024*1024,ffmpeg:env.FFMPEG_PATH||'/usr/bin/ffmpeg',ffprobe:env.FFPROBE_PATH||'/usr/bin/ffprobe'};}
export class Messages {
 private timer?:ReturnType<typeof setInterval>;private working=false;private stopped=false;private lastSweep=0;private transfers=0;private uploadGate:Promise<void>=Promise.resolve();
 constructor(readonly accounts:AccountsStore,readonly config:MediaConfig){}
 private now(){return this.accounts.now();}
 private path(key:string){if(!/^[a-f0-9-]{36}\.(input|m4a|mp4|jpg|part|posterpart)$/.test(key))throw new Error('Invalid private asset');return join(this.config.root,key);}
 async init(){await mkdir(this.config.root,{recursive:true,mode:0o700});const info=await stat(this.config.root);if(!info.isDirectory()||(info.mode&0o077))throw new Error('Media root must be private (700)');}
 start(){this.timer=setInterval(()=>void this.tick().catch(()=>console.error(JSON.stringify({event:'message-worker-failed'}))),1000);this.timer.unref();}
 async stop(){this.stopped=true;clearInterval(this.timer);while(this.working)await new Promise(r=>setTimeout(r,50));}
 private async allowed(db:Connection,actor:Actor,patient:string){if(!await this.accounts.permitted(db,actor.id,patient))throw new ApiError(404,'Communication history not found.');}
 private view(row:Row):MessageRecord{return {kind:'message',id:row.id,patientId:row.patient_id,senderId:row.sender_id,senderLabel:row.sender_label,senderRole:row.sender_role,recipientStaffId:row.recipient_staff_id,state:row.state,createdAt:iso(row.created_at)!,publishedAt:iso(row.published_at),expiresAt:iso(row.expires_at)!,durationMs:row.duration_ms,mediaKind:row.media_kind,outputMime:row.output_mime||'audio/mp4',outputBytes:row.output_bytes,width:row.video_width,height:row.video_height,fps:row.video_fps===null?null:Number(row.video_fps),hasThumbnail:Boolean(row.thumbnail_key),failureCode:row.failure_code};}
 async context(actor:Actor):Promise<MessageContext>{return this.accounts.transaction(async db=>{const rows=await db.query(`SELECT p.id,COALESCE(p.display_name,p.external_identifier,p.id) AS displayName FROM patients p WHERE p.archived_at IS NULL ORDER BY p.id`);const patients=[];for(const p of rows)if(await this.accounts.permitted(db,actor.id,p.id))patients.push(p);return {enabled:true,videoEnabled:Boolean(this.config.videoEnabled),patients};});}
 async timeline(actor:Actor,patient:string,cursor?:string,mixed=false):Promise<Timeline>{return this.accounts.transaction(async db=>{
  await this.allowed(db,actor,patient);let offset:{at:string;kind:string;id:string}|undefined;
  if(cursor){try{offset=JSON.parse(Buffer.from(cursor,'base64url').toString());if(!offset||!validId(offset.id)||!['call','message'].includes(offset.kind)||!/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d{3}$/.test(offset.at))throw 0;}catch{throw new ApiError(400,'Invalid history cursor.');}}
  // Calls preserve their existing participant-based audience; messages use current patient relationships.
  const params:any[]=[patient,actor.id,actor.id,patient];let query=`SELECT id,created_at,'message' AS kind FROM audio_messages WHERE patient_id=? AND (published_at IS NOT NULL OR sender_id=?) ${mixed?'':"AND media_kind='audio'"} UNION ALL SELECT c.id,c.created_at,'call' AS kind FROM calls c JOIN call_participants cp ON cp.call_id=c.id AND cp.user_id=? WHERE c.patient_id=?`;
  query=`SELECT * FROM (${query}) history`;
  if(offset){query+=' WHERE (created_at,kind,id)<(?,?,?)';params.push(offset.at,offset.kind,offset.id);}
  const rows=await db.query(query+' ORDER BY created_at DESC,kind DESC,id DESC LIMIT 31',params);const page=rows.slice(0,30);const entries=[];
  for(const r of page){if(r.kind==='message'){const [m]=await db.query('SELECT * FROM audio_messages WHERE id=?',[r.id]);entries.push(this.view(m));}else{const [c]=await db.query('SELECT c.*,u.display_name FROM calls c JOIN users u ON u.id=c.initiated_by_user_id WHERE c.id=?',[r.id]);entries.push({kind:'call' as const,id:c.id,patientId:patient,createdAt:iso(c.created_at)!,state:c.state,senderLabel:c.display_name,observedSeconds:c.observed_connected_seconds});}}
  const last=page.at(-1);const next=rows.length>30&&last?Buffer.from(JSON.stringify({at:last.created_at,kind:last.kind,id:last.id})).toString('base64url'):null;
  const recipients=await db.query("SELECT u.id,u.display_name AS displayName FROM patient_assignments a JOIN users u ON u.id=a.staff_user_id WHERE a.patient_id=? AND a.revoked_at IS NULL AND u.status='active' AND u.role IN ('practitioner','rn','ma','admin') ORDER BY u.display_name,u.id",[patient]);
  const [p]=await db.query('SELECT display_name FROM patients WHERE id=?',[patient]);return {entries,next,recipients,patientName:p.display_name||'Patient'};
 });}
 async create(actor:Actor,patient:string,key:string,recipient?:string,kind:MediaKind='audio'):Promise<MessageRecord>{return this.accounts.transaction(async db=>{
  if(kind==='video'&&!this.config.videoEnabled)throw new ApiError(503,'Video messages are not enabled.');await db.query('SELECT id FROM users WHERE id=? FOR UPDATE',[actor.id]);await this.allowed(db,actor,patient);
  const target=staff(actor.role)?actor.id:recipient;
  if(!validId(target))throw new ApiError(400,'Choose a care-team recipient.');
  const [assigned]=await db.query("SELECT u.id FROM patient_assignments a JOIN users u ON u.id=a.staff_user_id WHERE a.patient_id=? AND a.staff_user_id=? AND a.revoked_at IS NULL AND u.status='active' AND u.role IN ('practitioner','rn','ma','admin')",[patient,target]);if(!assigned)throw new ApiError(404,'Recipient is unavailable.');
  const [old]=await db.query('SELECT * FROM audio_messages WHERE sender_id=? AND request_key=?',[actor.id,key]);if(old){if(old.patient_id!==patient||old.recipient_staff_id!==target||old.media_kind!==kind)throw new ApiError(409,'Send request belongs to a different conversation.');if(old.state==='uploading')throw new ApiError(409,'Upload is still in progress. Keep the draft and try Send again shortly.');return this.view(old);}
  const [quota]=await db.query('SELECT COUNT(*) AS n FROM audio_messages WHERE sender_id=? AND created_at>?',[actor.id,utc(this.now()-86400000)]);if(Number(quota.n)>=100)throw new ApiError(429,'Daily message limit reached.');
  const id=randomUUID();await db.query('INSERT INTO audio_messages(id,patient_id,sender_id,recipient_staff_id,sender_label,sender_role,request_key,media_kind,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[id,patient,actor.id,target,actor.displayName,actor.role,key,kind,utc(this.now()),utc(this.now()+this.config.uploadTtlMs)]);const [row]=await db.query('SELECT * FROM audio_messages WHERE id=?',[id]);await registerCommunication(db,'message',id,patient,row.created_at);return this.view(row);
 });}
 private async row(db:Connection,actor:Actor,id:string,owner=false):Promise<Row>{const [row]=await db.query('SELECT * FROM audio_messages WHERE id=? FOR UPDATE',[id]);if(!row||owner&&row.sender_id!==actor.id)throw new ApiError(404,'Message not found.');await this.allowed(db,actor,row.patient_id);if(!owner&&row.sender_id!==actor.id&&!row.published_at)throw new ApiError(404,'Message not found.');return row;}
 async grant(actor:Actor,id:string,operation:'upload'|'play'|'thumbnail',mixed=false):Promise<MediaGrant>{return this.accounts.transaction(async db=>{
  const row=await this.row(db,actor,id,operation==='upload');if(row.media_kind==='video'&&!mixed)throw new ApiError(409,'Install the video-message update to view this message.');if(operation==='upload'&&row.media_kind==='video'&&!this.config.videoEnabled)throw new ApiError(503,'New video messages are paused.');if(operation==='thumbnail'&&!row.thumbnail_key)throw new ApiError(404,'Thumbnail unavailable.');if(ms(row.expires_at)<=this.now()||operation!=='upload'&&row.state!=='available'||operation==='upload'&&!['pending','failed'].includes(row.state))throw new ApiError(409,'Message is not available for this action. Refresh its status.');
  const [count]=await db.query('SELECT COUNT(*) AS n FROM message_media_grants WHERE session_id=? AND expires_at>?',[actor.sessionId,utc(this.now())]);if(Number(count.n)>=60)throw new ApiError(429,'Too many media requests. Try again shortly.');
  const token=randomBytes(32).toString('base64url'),expires=this.now()+120000;
  await db.query('INSERT INTO message_media_grants(token_hash,message_id,session_id,operation,expires_at) VALUES(?,?,?,?,?)',[hash(token),id,actor.sessionId,operation,utc(expires)]);return {token,path:`/api/message-media/${id}/${operation}`,expiresAt:new Date(expires).toISOString(),mediaKind:row.media_kind,mime:operation==='thumbnail'?'image/jpeg':row.output_mime||(row.media_kind==='video'?'video/mp4':'audio/mp4'),bytes:operation==='thumbnail'?row.thumbnail_bytes:row.output_bytes};
 });}
 private async authorizeGrant(token:string,id:string,operation:string):Promise<{actor:Actor;row:Row}>{return this.accounts.transaction(async db=>{
  const [g]=await db.query("SELECT g.*,s.user_id,s.device_id,u.display_name,u.role FROM message_media_grants g JOIN auth_sessions s ON s.id=g.session_id JOIN users u ON u.id=s.user_id WHERE g.token_hash=? AND g.message_id=? AND g.operation=? AND g.expires_at>? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active' AND (s.device_id IS NULL OR EXISTS(SELECT 1 FROM devices d WHERE d.id=s.device_id AND d.revoked_at IS NULL)) FOR UPDATE",[hash(token),id,operation,utc(this.now()),utc(this.now())]);
  if(!g||g.used_at)throw new ApiError(401,'Media access expired. Try again.');
  const actor:Actor={id:g.user_id,sessionId:g.session_id,deviceId:g.device_id,displayName:g.display_name,role:g.role};const row=await this.row(db,actor,id,operation==='upload');if(operation==='upload'&&row.media_kind==='video'&&!this.config.videoEnabled)throw new ApiError(503,'New video messages are paused.');if(operation==='thumbnail'&&!row.thumbnail_key)throw new ApiError(404,'Thumbnail unavailable.');if(ms(row.expires_at)<=this.now())throw new ApiError(410,'Media has expired.');
  if(operation==='upload'){await db.query('UPDATE message_media_grants SET used_at=? WHERE token_hash=?',[utc(this.now()),hash(token)]);if(!['pending','failed'].includes(row.state))throw new ApiError(409,'Refresh message status before retrying.');}
  else if(row.state!=='available')throw new ApiError(410,'Media is unavailable.');return {actor,row};
 });}
 async media(req:IncomingMessage,res:ServerResponse,id:string,operation:string){
  const token=req.headers.authorization?.match(/^Media ([A-Za-z0-9_-]{43})$/)?.[1];if(!token)throw new ApiError(401,'Media access required.');
  if(operation==='upload'&&req.method==='POST'){
   if(this.transfers>=2)throw new ApiError(429,'Uploads are busy. Try again shortly.');this.transfers++;
   try{const {actor,row}=await this.authorizeGrant(token,id,operation);if(row.media_kind==='video'&&!this.config.videoEnabled)throw new ApiError(503,'New video messages are paused.');await this.upload(req,actor,id,row.media_kind);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"ok":true}');}finally{this.transfers--;}
  }else if(['play','thumbnail'].includes(operation)&&req.method==='GET'){
   const {row}=await this.authorizeGrant(token,id,operation);const file=this.path(operation==='thumbnail'?row.thumbnail_key:row.output_key);const info=await stat(file).catch(()=>{throw new ApiError(410,'Media is unavailable.');});let start=0,end=info.size-1;const range=req.headers.range;
   if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);const first=m?.[1]?Number(m[1]):null,last=m?.[2]?Number(m[2]):null;
    if(!m||first===null&&(!last||!Number.isSafeInteger(last))||first!==null&&(!Number.isSafeInteger(first)||first>=info.size)||last!==null&&(!Number.isSafeInteger(last)||first!==null&&last<first)){res.writeHead(416,{'Content-Range':`bytes */${info.size}`,'Cache-Control':'private, no-store'});res.end();return;}
    if(first===null)start=Math.max(0,info.size-last!);else{start=first;if(last!==null)end=Math.min(end,last);}
   }
   res.writeHead(range?206:200,{'Content-Type':operation==='thumbnail'?'image/jpeg':row.output_mime||'audio/mp4','Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...(range?{'Content-Range':`bytes ${start}-${end}/${info.size}`}:{})});await pipeline(createReadStream(file,{start,end}),res);
  }else throw new ApiError(405,'Unsupported media request.');
 }
 private async liveSession(db:Connection,actor:Actor){const [session]=await db.query("SELECT s.id FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.user_id=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active' AND (s.device_id IS NULL OR EXISTS(SELECT 1 FROM devices d WHERE d.id=s.device_id AND d.revoked_at IS NULL))",[actor.sessionId,actor.id,utc(this.now())]);if(!session)throw new ApiError(401,'Media session ended. Try again after signing in.');}
 private async upload(req:IncomingMessage,actor:Actor,id:string,kind:MediaKind){
  const video=kind==='video',max=video?VIDEO.maxBytes:this.config.maxBytes,timeout=video?VIDEO.uploadMs:120000;
  const declared=Number(req.headers['content-length']||0);if(declared>max)throw new ApiError(413,'Recording is too large.');
  const attempt=randomUUID(),key=attempt+'.input';let previousHash:string|null=null;
  // Serialize reservation checks until DB uploading state is committed; body streams remain concurrent.
  const before=this.uploadGate;let unlock!:()=>void;this.uploadGate=new Promise<void>(r=>{unlock=r;});await before;
  try{
   await this.accounts.transaction(async db=>{
    await db.query('SELECT id FROM users WHERE id=? FOR UPDATE',[actor.id]);const r=await this.row(db,actor,id,true);if(!['pending','failed'].includes(r.state))throw new ApiError(409,'Upload already started.');
    const [q]=await db.query("SELECT COALESCE(SUM(CASE WHEN state='uploading' THEN ? ELSE COALESCE(size_bytes,0) END),0) AS bytes FROM audio_messages WHERE sender_id=? AND media_kind=? AND created_at>? AND id<>?",[max,actor.id,kind,utc(this.now()-86400000),id]);if(Number(q.bytes)+max>(video?VIDEO.dailyBytes:this.config.dailyBytes))throw new ApiError(429,'Daily upload limit reached.');
    const jobs=await db.query("SELECT media_kind,state FROM audio_messages WHERE state IN ('uploading','processing')");if(video&&jobs.filter((j:Row)=>j.media_kind==='video').length>=VIDEO.maxQueued)throw new ApiError(429,'Video processing is busy. Keep the draft and retry shortly.');
    const reserve=jobs.reduce((n:number,j:Row)=>n+(j.state==='uploading'?(j.media_kind==='video'?VIDEO.maxBytes:this.config.maxBytes):0)+(j.media_kind==='video'?VIDEO.maxOutput+262144:this.config.maxBytes),0)+max+(video?VIDEO.maxOutput+262144:this.config.maxBytes);
    const disk=await statfs(this.config.root);if(Number(disk.bavail)*Number(disk.bsize)<this.config.minFree+reserve)throw new ApiError(507,'Recording storage is temporarily full.');
    let total=0;for(const n of await readdir(this.config.root))if(/^[a-f0-9-]{36}\.(input|part|posterpart|m4a|mp4|jpg)$/.test(n))total+=(await stat(this.path(n)).catch(()=>({size:0}))).size;
    if(total+reserve>this.config.maxStorage)throw new ApiError(507,'Recording storage limit reached.');
    previousHash=r.input_hash;await db.query("UPDATE audio_messages SET state='uploading',lease_key=?,lease_until=?,failure_code=NULL WHERE id=?",[attempt,utc(this.now()+timeout+10000),id]);
   });
  }finally{unlock();}
  let size=0;const digest=createHash('sha256');let file:Awaited<ReturnType<typeof open>>|undefined;const timer=setTimeout(()=>req.destroy(),timeout);
  try{
   file=await open(this.path(key),'wx',0o600);
   for await(const chunk of req){size+=chunk.length;if(size>max)throw new ApiError(413,'Recording is too large.');digest.update(chunk);await file.writeFile(chunk);}
   if(!size)throw new ApiError(400,'Recording is empty.');const checksum=digest.digest('hex');if(previousHash&&previousHash!==checksum)throw new ApiError(409,'Recording changed. Discard and send it as a new message.');await file.sync();
   await this.accounts.transaction(async db=>{await this.liveSession(db,actor);await this.row(db,actor,id,true);const result=await db.query("UPDATE audio_messages SET state='processing',input_key=?,input_hash=?,size_bytes=?,lease_until=NULL WHERE id=? AND lease_key=? AND state='uploading'",[key,checksum,size,id,attempt]);if(!result.affectedRows)throw new ApiError(409,'Upload expired.');});
  }catch(error){await unlink(this.path(key)).catch(()=>{});await this.accounts.transaction(db=>db.query("UPDATE audio_messages SET state='failed',lease_until=NULL,failure_code='upload-failed' WHERE id=? AND lease_key=? AND state='uploading'",[id,attempt]));throw error;
  }finally{clearTimeout(timer);await file?.close();}
 }
 async tick(){if(this.working||this.stopped)return;this.working=true;
  try{
   await this.sweep();
   const job=await this.accounts.transaction(async db=>{const [row]=await db.query("SELECT * FROM audio_messages WHERE state='processing' AND (lease_until IS NULL OR lease_until<?) ORDER BY created_at LIMIT 1 FOR UPDATE",[utc(this.now())]);if(!row)return;const key=randomUUID();await db.query('UPDATE audio_messages SET lease_key=?,lease_until=?,attempts=attempts+1 WHERE id=?',[key,utc(this.now()+(row.media_kind==='video'?VIDEO.jobMs:120000)),row.id]);return {...row,lease_key:key};});if(!job)return;
   const video=job.media_kind==='video',output=job.lease_key+(video?'.mp4':'.m4a'),part=job.lease_key+'.part',poster=job.lease_key+'.jpg',posterpart=job.lease_key+'.posterpart';
   try{
    if(job.attempts>=3)throw new Error('processing-retry-limit');
    const media=await normalizeMessage(this.path(job.input_key),this.path(part),this.path(posterpart),job.media_kind,this.config.ffmpeg,this.config.ffprobe,this.config.maxSeconds);
    await chmod(this.path(part),0o600);await rename(this.path(part),this.path(output));if(video){await chmod(this.path(posterpart),0o600);await rename(this.path(posterpart),this.path(poster));}
    await this.accounts.transaction(async db=>{const [r]=await db.query('SELECT state,lease_key FROM audio_messages WHERE id=? FOR UPDATE',[job.id]);if(r.state!=='processing'||r.lease_key!==job.lease_key||!await this.accounts.permitted(db,job.sender_id,job.patient_id))throw new Error('stale-job');await db.query("UPDATE audio_messages SET state='available',output_key=?,duration_ms=?,output_mime=?,output_bytes=?,video_width=?,video_height=?,video_fps=?,thumbnail_key=?,thumbnail_bytes=?,published_at=?,expires_at=?,input_key=NULL,lease_until=NULL,failure_code=NULL WHERE id=?",[output,media.durationMs,media.mime,media.bytes,media.width,media.height,media.fps,video?poster:null,media.thumbnailBytes,utc(this.now()),utc(this.now()+this.config.retentionMs),job.id]);});
    await unlink(this.path(job.input_key)).catch(()=>{});
   }catch(error){const code=error instanceof Error&&/^[a-z-]{3,80}$/.test(error.message)?error.message:'processing-failed';console.error(JSON.stringify({event:'message-media-rejected',kind:job.media_kind,code}));for(const key of [part,output,poster,posterpart])await unlink(this.path(key)).catch(()=>{});await this.accounts.transaction(db=>db.query("UPDATE audio_messages SET state='failed',failure_code=?,lease_until=NULL WHERE id=? AND lease_key=? AND state='processing'",[video?'invalid-or-unsupported-video':'invalid-or-unsupported-audio',job.id,job.lease_key]));}
  }finally{this.working=false;}
 }
 async sweep(){if(this.now()-this.lastSweep<60000)return;this.lastSweep=this.now();
  const remove=await this.accounts.transaction(async db=>{await db.query("UPDATE audio_messages SET state='failed',failure_code='upload-interrupted',lease_until=NULL WHERE state='uploading' AND lease_until<?",[utc(this.now())]);const rows=await db.query("SELECT * FROM audio_messages WHERE expires_at<? AND state<>'expired' FOR UPDATE",[utc(this.now())]);for(const r of rows)await db.query("UPDATE audio_messages SET state='expired',lease_until=NULL WHERE id=?",[r.id]);return rows;});
  for(const row of remove)for(const key of [row.input_key,row.output_key,row.thumbnail_key])if(key)await unlink(this.path(key)).catch(()=>{});
  const referenced=await this.accounts.transaction(async db=>new Set((await db.query("SELECT input_key,output_key,thumbnail_key,lease_key FROM audio_messages WHERE state<>'expired'")).flatMap((r:Row)=>[r.input_key,r.output_key,r.thumbnail_key,r.lease_key+'.part',r.lease_key+'.input',r.lease_key+'.posterpart',r.lease_key+'.jpg',r.lease_key+'.mp4',r.lease_key+'.m4a'])));
  for(const name of await readdir(this.config.root))if(/^[a-f0-9-]{36}\.(input|part|posterpart|m4a|mp4|jpg)$/.test(name)&&!referenced.has(name)){const info=await stat(this.path(name)).catch(()=>null);if(info&&info.mtimeMs<this.now()-600000)await unlink(this.path(name)).catch(()=>{});}
 }
}
