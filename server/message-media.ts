import {spawn} from 'node:child_process';
import {stat} from 'node:fs/promises';
export type MediaKind='audio'|'video';
export type ProcessedMedia={durationMs:number;mime:string;bytes:number;width:number|null;height:number|null;fps:number|null;thumbnailBytes:number|null};
export const VIDEO={maxBytes:64*1024*1024,maxSeconds:120,maxOutput:32*1024*1024,dailyBytes:256*1024*1024,maxQueued:4,jobMs:660000,uploadMs:600000};
export async function mediaCommand(executable:string,args:string[],video=false):Promise<string>{
 return new Promise((resolve,reject)=>{
  const child=spawn('/usr/bin/nice',['-n','19','/usr/bin/prlimit',`--as=${video?1073741824:536870912}`,`--cpu=${video?300:20}`,`--fsize=${video?VIDEO.maxOutput:10485760}`,'--',executable,...args],{stdio:['ignore','pipe','ignore'],env:{PATH:'/usr/bin:/bin',OPENBLAS_NUM_THREADS:'1'}});
  let output='';const timer=setTimeout(()=>child.kill('SIGKILL'),video?300000:25000);
  child.stdout.on('data',chunk=>{output+=chunk.toString();if(output.length>65536)child.kill('SIGKILL');});
  child.on('error',()=>{clearTimeout(timer);reject(new Error('media-process-unavailable'));});
  child.on('close',code=>{clearTimeout(timer);code===0?resolve(output):reject(new Error('invalid-or-unsupported-media'));});
 });
}
const common=['-v','error','-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,webm,ogg,wav,mp3'];
export async function normalizeMessage(input:string,output:string,poster:string,kind:MediaKind,ffmpeg:string,ffprobe:string,audioMax=180):Promise<ProcessedMedia>{
 const video=kind==='video',max=video?VIDEO.maxSeconds:audioMax;
 const probe=JSON.parse(await mediaCommand(ffprobe,[...common,'-show_streams','-show_format','-of','json',input]));
 const streams=probe.streams||[],audio=streams.filter((s:any)=>s.codec_type==='audio'),visual=streams.filter((s:any)=>s.codec_type==='video');
 if(audio.length!==1||streams.length!==(video?2:1)||!['aac','opus','vorbis','pcm_s16le','mp3'].includes(audio[0].codec_name))throw new Error('unsupported-streams');
 if(video){const v=visual[0];if(visual.length!==1||!['h264','vp8','vp9','hevc'].includes(v.codec_name)||!v.width||!v.height||v.width>3840||v.height>3840||v.width*v.height>8294400)throw new Error('unsupported-video');const [n,d]=String(v.avg_frame_rate||v.r_frame_rate||'0/1').split('/').map(Number);if(d&&n/d>60.5)throw new Error('unsupported-frame-rate');}
 const duration=Number(probe.format?.duration||audio[0].duration);
 if(Number.isFinite(duration)&&duration>max+.2)throw new Error('recording-too-long');
 const encoding=video?['-map','0:v:0','-map','0:a:0','-vf',"scale=w='min(iw,if(gte(iw,ih),1280,720))':h='min(ih,if(gte(iw,ih),720,1280))':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,fps=30",'-c:v','libx264','-preset','veryfast','-crf','23','-maxrate','2000000','-bufsize','4000000','-pix_fmt','yuv420p','-profile:v','main','-metadata:s:v:0','rotate=0']:['-map','0:a:0','-vn'];
 await mediaCommand(ffmpeg,[...common,'-threads','1','-nostdin','-i',input,'-threads','1','-filter_threads','1','-filter_complex_threads','1',...encoding,'-map_metadata','-1','-ac','1','-ar','44100','-c:a','aac','-b:a','64000','-t',String(max+1),'-f',video?'mp4':'ipod','-movflags','+faststart',output],video);
 const verified=JSON.parse(await mediaCommand(ffprobe,[...common,'-show_format','-show_streams','-of','json',output]));
 const seconds=Number(verified.format?.duration),v=verified.streams?.find((s:any)=>s.codec_type==='video');
 if(!Number.isFinite(seconds)||seconds<=0||seconds>max+.2)throw new Error('invalid-duration');
 const bytes=(await stat(output)).size;if(bytes>(video?VIDEO.maxOutput:10485760))throw new Error('output-too-large');
 let thumbnailBytes:null|number=null;
 if(video){if(!v||v.width*v.height>1280*720||Math.max(v.width,v.height)>1280)throw new Error('invalid-video-output');await mediaCommand(ffmpeg,[...common,'-threads','1','-nostdin','-i',output,'-threads','1','-filter_threads','1','-vf','scale=320:320:force_original_aspect_ratio=decrease','-frames:v','1','-an','-map_metadata','-1','-q:v','5','-f','image2',poster],true);thumbnailBytes=(await stat(poster)).size;if(thumbnailBytes>262144)throw new Error('poster-too-large');}
 return {durationMs:Math.round(seconds*1000),mime:video?'video/mp4':'audio/mp4',bytes,width:v?.width??null,height:v?.height??null,fps:video?30:null,thumbnailBytes};
}
