import {spawn} from 'node:child_process';
import {mkdir,writeFile,stat,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {normalizeMessage} from '../server/message-media';
async function main(){
const root=resolve('artifacts/private/video-messages/benchmark');await mkdir(root,{recursive:true,mode:0o700});
const input=root+'/source.webm',output=root+'/normalized.mp4',poster=root+'/poster.jpg';
async function generate(){await new Promise<void>((done,fail)=>{const p=spawn('/usr/bin/nice',['-n','19','/usr/bin/ffmpeg','-v','error','-y','-f','lavfi','-i','testsrc2=size=1280x720:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','120','-threads','1','-c:v','libvpx','-deadline','realtime','-cpu-used','8','-b:v','2000000','-c:a','libopus','-b:a','64000',input],{stdio:'ignore'});p.on('error',fail);p.on('exit',code=>code===0?done():fail(new Error('fixture-generation-failed')));});}
try{await stat(input);}catch{await generate();}
for(const target of [output,poster])await rm(target,{force:true});
const started=Date.now();let samples=0,maxDelay=0;let last=performance.now();const timer=setInterval(()=>{const now=performance.now();maxDelay=Math.max(maxDelay,now-last-50);last=now;samples++;},50);
try{const media=await normalizeMessage(input,output,poster,'video','/usr/bin/ffmpeg','/usr/bin/ffprobe');const report={seconds:(Date.now()-started)/1000,maxEventLoopDelayMs:Math.round(maxDelay),samples,media};await writeFile(root+'/result.json',JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report));}finally{clearInterval(timer);}

}
void main().catch(()=>{console.error("Video benchmark failed; inspect private fixture/processing limits.");process.exitCode=1;});
