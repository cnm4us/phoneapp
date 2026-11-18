import type {AccountClient,AccountState} from '../src/accounts/client';
import {MessageController} from '../src/messages/controller';
import {browserMessageAudio} from './message-audio';
import {ownMessageAudio} from '../src/messages/focus';
export function messagePanel(client:AccountClient,root:HTMLElement){
 const controller=new MessageController(location.origin,(path,body)=>client.request(path,body),browserMessageAudio());let recipient='',selected='';
 const node=(tag:string,text:string)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 const button=(text:string,action:()=>void,disabled=false)=>{const b=document.createElement('button');b.className='button secondary';b.textContent=text;b.disabled=disabled;b.onclick=action;return b;};
 const blocked=()=>Boolean(client.state.current||client.state.dashboard?.calls.some(c=>c.canAnswer));
 const render=()=>{
  const s=controller.state;root.hidden=!client.state.account||!s.enabled;root.replaceChildren();if(root.hidden)return;
  root.className='account-stack';root.append(node('h2','Communication history'),node('p','Audio messages · Available for 7 days · Call recording remains off.'));
  for(const p of s.patients)root.append(button((s.selected===p.id?'✓ ':'')+p.displayName,()=>void controller.select(p.id),s.busy||s.recording));
  const isPatient=['patient','caregiver'].includes(client.state.account!.role);const recipients=s.timeline?.recipients||[];if(selected!==s.selected){selected=s.selected;recipient='';}const target=recipient||recipients[0]?.id;
  if(isPatient&&recipients.length>1)for(const r of recipients)root.append(button((target===r.id?'✓ ':'')+r.displayName,()=>{recipient=r.id;render();}));
  const busy=s.busy||blocked();if(blocked())root.append(node('p','Finish the call before recording or playing a message.'));
  if(s.recording)root.append(button('Stop recording',()=>void controller.stop(),s.busy));else root.append(button(s.draft?'Re-record audio message':'Record audio message',()=>void controller.start(),busy||!s.selected||isPatient&&!target));
  if(s.draft&&!s.recording)root.append(button('Preview recording',()=>void controller.preview(),busy),button('Send audio message',()=>void controller.send(target),busy),button('Discard recording',()=>void controller.discard(),s.busy));
  if(s.busy)root.append(node('p','Working…'));if(s.notice)root.append(node('p',s.notice));if(s.error){const e=node('p',s.error);e.setAttribute('role','alert');root.append(e);}
  const pos=controller.audio.position();if(pos.duration>0)root.append(button('Pause playback',()=>controller.audio.pause()),button('Resume playback',()=>void controller.audio.resume()),button('Back 15 seconds',()=>void controller.audio.seek(controller.audio.position().current-15)),button('Forward 15 seconds',()=>void controller.audio.seek(controller.audio.position().current+15)));
  if(!s.timeline?.entries.length)root.append(node('p','Your calls and audio messages will appear here.'));
  for(const row of s.timeline?.entries||[]){const article=node('article','');article.className='account-card';article.dataset.communicationId=row.id;article.dataset.communicationState=row.state;article.append(node('h3',(row.kind==='call'?'Call':'Audio message')+' · '+row.senderLabel),node('p',new Date(row.createdAt).toLocaleString()+' · '+row.state));
   if(row.kind==='message'){article.append(node('p',(row.durationMs===null?'Processing duration':Math.ceil(row.durationMs/1000)+' seconds')+' · Expires '+new Date(row.expiresAt).toLocaleDateString()));if(row.state==='available'){article.append(button('Play audio message',()=>void controller.play(row.id),busy));if(isPatient)article.append(button('Record reply',()=>{recipient=row.recipientStaffId;void controller.start();},busy));}if(row.state==='failed')article.append(node('p','Recording unavailable. '+(row.failureCode||'')));}
   else article.append(node('p',`Observed connection ${row.observedSeconds}s · Recording/transcript off`));root.append(article);
  }
  if(s.timeline?.next)root.append(button('Load earlier communications',()=>void controller.more(),s.busy));
 };
 controller.subscribe(render);ownMessageAudio(()=>controller.interrupt());
 client.subscribe((s:AccountState)=>{void controller.adopt(s.account?.id||'',blocked());});
 const timer=setInterval(()=>{if(controller.state.recording&&controller.audio.hasDraft())void controller.stop();if(document.visibilityState==='visible')void controller.refresh();},4000);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)void controller.interrupt();else void controller.refresh();});window.addEventListener('pagehide',()=>{clearInterval(timer);controller.dispose();});
 return controller;
}
