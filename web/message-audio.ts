import type {AudioAdapter} from '../src/messages/controller';
import type {MediaGrant} from '../shared/messages';
export function browserMessageAudio():AudioAdapter{
 let stream:MediaStream|undefined,recorder:MediaRecorder|undefined,blob:Blob|undefined,player:HTMLAudioElement|undefined,url='',timer:ReturnType<typeof setTimeout>|undefined,stopping:Promise<void>|undefined;
 let generation=0;
 const pause=()=>{player?.pause();};
 const clear=()=>{pause();player?.removeAttribute('src');player?.load();player=undefined;if(url)URL.revokeObjectURL(url);url='';};
 const playBlob=async(value:Blob)=>{clear();url=URL.createObjectURL(value);player=new Audio(url);await player.play();};
 const stop=async()=>{if(stopping)return stopping;if(!recorder||recorder.state==='inactive')return;stopping=new Promise<void>((resolve,reject)=>{recorder!.addEventListener('stop',()=>{clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());stream=undefined;stopping=undefined;resolve();},{once:true});recorder!.addEventListener('error',()=>reject(new Error('Recording interrupted.')),{once:true});recorder!.stop();});return stopping;};
 const discard=async()=>{generation++;await stop();clear();blob=undefined;};
 const checked=async(response:Response)=>{if(!response.ok){let message='Media transfer failed. Try again.';try{message=(await response.json()).error||message;}catch{}throw new Error(message);}return response;};
 return {
  start:async()=>{await discard();const epoch=generation;if(!globalThis.MediaRecorder)throw new Error('Audio recording is unavailable in this browser.');stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});try{if(epoch!==generation||document.hidden)throw new Error('Recording canceled.');const type=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));if(!type)throw new Error('No supported audio recorder format.');const chunks:Blob[]=[];recorder=new MediaRecorder(stream,{mimeType:type,audioBitsPerSecond:64000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.addEventListener('stop',()=>{blob=new Blob(chunks,{type});},{once:true});recorder.start();timer=setTimeout(()=>void stop(),180000);}catch(e){stream.getTracks().forEach(t=>t.stop());throw e;}},
  stop,hasDraft:()=>Boolean(blob?.size),preview:async()=>{if(blob)await playBlob(blob);},discard,
  upload:async(origin,grant,signal)=>{if(!blob)throw new Error('Record a message first.');await checked(await fetch(origin+grant.path,{method:'POST',headers:{Authorization:'Media '+grant.token,'Content-Type':'application/octet-stream'},body:blob,signal}));},
  play:async(origin:string,grant:MediaGrant,signal:AbortSignal)=>{const response=await checked(await fetch(origin+grant.path,{headers:{Authorization:'Media '+grant.token},signal}));const audio=await response.blob();if(signal.aborted)return;await playBlob(audio);},
  pause,resume:async()=>{await player?.play();},seek:async seconds=>{if(player)player.currentTime=Math.max(0,Math.min(player.duration||0,seconds));},position:()=>({current:player?.currentTime||0,duration:player?.duration||0,playing:player?!player.paused:false}),release:async()=>{generation++;await stop();clear();},dispose:()=>{void discard();}
 };
}
