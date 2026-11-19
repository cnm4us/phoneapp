import {messagePanel} from './messages';
import { AccountClient, type AccountState } from '../src/accounts/client';
import { terminalCall } from '../shared/accounts';
import type { BrowserCall } from './call';

export function accountPanel(call:BrowserCall):AccountClient {
  const root=document.getElementById('accounts')!;
  const client=new AccountClient(location.origin,{join:invite=>call.join('',true,false,invite),end:()=>call.end(),phase:()=>call.state.phase,error:()=>call.state.error},undefined,true);
  let selected='';let enrollment='';
  const node=(tag:string,text?:string):HTMLElement=>{const element=document.createElement(tag);if(text)element.textContent=text;return element;};
  const button=(text:string,action:()=>void,disabled=false):HTMLButtonElement=>{const result=document.createElement('button');result.type='button';result.textContent=text;result.className='button secondary';result.disabled=disabled;result.onclick=action;return result;};
  function render(state:AccountState):void {
    root.replaceChildren();
    root.append(node('h2',state.account?.displayName || 'Provider / patient test accounts'),node('p','Synthetic accounts · Keep this page open · Recording off'));
    root.dataset.role=state.account?.role || 'signed-out';
    if(!state.account){
      const form=document.createElement('form');form.className='account-stack';
      const label=node('label','One-time enrollment code');label.setAttribute('for','enrollment-code');
      const input=document.createElement('input');input.id='enrollment-code';input.type='password';input.autocomplete='off';input.placeholder='Paste the owner-issued code';input.value=enrollment;input.oninput=()=>{enrollment=input.value;};
      const signIn=button(state.busy?'Signing in…':'Sign in',()=>{const code=enrollment;enrollment='';void client.signIn(code);},state.busy);signIn.type='submit';
      form.onsubmit=event=>{event.preventDefault();};form.append(label,input,signIn,button('Restore saved sign-in',()=>void client.restore(),state.busy));root.append(form);
    }else{
      root.append(node('p',`${state.account.role==='patient'?'Patient':'Care team'} account · Sign-in saved in this browser for up to 30 days`),button('Sign out',()=>void client.signOut(),state.busy||Boolean(state.current)));
      const incoming=state.dashboard?.calls.find(row=>row.canAnswer);
      if(incoming&&!state.current){const box=node('div');box.className='account-card';box.setAttribute('role','status');box.append(node('h3','Incoming app call'),node('p',incoming.callerName),button('Answer with audio/video',()=>void client.act(incoming,'answer'),state.busy),button('Decline',()=>void client.act(incoming,'decline'),state.busy));root.append(box);}
      if(state.current){const box=node('div');box.className='account-card';box.append(node('h3',state.current.state==='ringing'?'Calling…':'App call'),node('p',`${state.current.patientName} · ${state.current.state}`),button(state.current.state==='ringing'?'Cancel call':'End app call',()=>void client.hangup()));root.append(box);}
      if(!state.dashboard?.communicationWorkspace&&state.dashboard?.patients.length&&!state.current){
        const directory=node('div');directory.className='account-stack';directory.append(node('h3','Patients'));
        for(const patient of state.dashboard.patients)directory.append(button(patient.displayName,()=>{selected=patient.id;render(client.state);}));
        const patient=state.dashboard.patients.find(row=>row.id===selected);
        if(patient){directory.append(node('h3',`${patient.displayName} · Call options`),button('App Audio/Video',()=>void client.dial(patient.id),state.busy||!patient.enrolled));if(!patient.enrolled)directory.append(node('p','Patient must enroll before calling.'));directory.append(node('p','App Audio · Coming later. Phone #1 / #2 / #3 · Coming later.'));}
        root.append(directory);
      }
      if(state.dashboard?.communicationWorkspace)for(const row of state.dashboard.calls.filter(r=>!terminalCall(r.state)&&!r.ownsMedia&&!r.canAnswer))root.append(node('p',`${row.patientName} · ${row.state} · Active on another signed-in device.`));
      if(!state.dashboard?.communicationWorkspace){const history=node('div');history.id='account-history';history.className='account-stack';history.append(node('h3','Call history'));
      if(!state.dashboard?.calls.length)history.append(node('p','Your app calls will appear here.'));
      for(const record of state.dashboard?.calls || []){
        const entry=node('article');entry.className='account-card';entry.dataset.callId=record.id;entry.dataset.callState=record.state;
        entry.append(node('h4',`${record.direction==='incoming'?record.callerName:record.patientName} · ${record.direction}`),node('p',`${new Date(record.createdAt).toLocaleString()} · ${record.state}`),node('p',`Observed connection: ${Math.floor(record.observedSeconds/60)}m ${record.observedSeconds%60}s`),node('p','Recording / transcript: Off'),node('small',`Call ID: ${record.id}`));
        if(!terminalCall(record.state)&&!record.ownsMedia&&!record.canAnswer)entry.append(node('p','Active on another signed-in device.'));
        history.append(entry);
      }
      root.append(history); }
    }
    if(state.error){const error=node('p',state.error);error.setAttribute('role','alert');root.append(error);}
    document.body.classList.toggle('account-session',Boolean(state.account));
  }
  client.subscribe(render);
  const messages=document.createElement('section');messages.id='audio-messages';root.after(messages);messagePanel(client,messages);
  void client.restore();
  call.subscribe(state=>client.mediaChanged(state.phase));
  window.addEventListener('pagehide',()=>client.dispose());
  return client;
}
