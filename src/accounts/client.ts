import {releaseMessageAudio} from '../messages/focus';
import type { Account, CallRecord, Dashboard, Enrollment, MediaInvitation, CallAction } from '../../shared/accounts';
import { terminalCall } from '../../shared/accounts';
import type { Invitation } from '../../shared/protocol';

export type AccountState = { account?: Account; dashboard?: Dashboard; current?: CallRecord; busy: boolean; error: string; updatedAt?: number; incomingReady?:boolean };
export type MediaAdapter = { join(invitation: Invitation,callId?:string): Promise<void>; end(): void; phase(): string; error?(): string | undefined;setMuted?(muted:boolean):void };
export interface NativeAccounts {
 enroll(code:string):Promise<Enrollment>;restore():Promise<Partial<Enrollment>>;request(path:string,body?:unknown):Promise<unknown>;
 status?():Promise<{registered:boolean;enrolled:boolean}>;sync(calls:CallRecord[]):Promise<void>;actions():Promise<{id:string;action:string;muted?:string}[]>;answer(id:string):Promise<void>;end(id:string):Promise<void>;
}
export class AccountClient {
  state: AccountState = { busy:false,error:'' };
  private token='';
  private epoch=0;
  private listeners=new Set<(state:AccountState)=>void>();
  private timer?:ReturnType<typeof setInterval>;
  private reporting?:ReturnType<typeof setInterval>;
  private polling=false;
  private joining=false;
  private joinedId='';
  private currentId='';
  private counter=0;
  private previousConnected=false;
  private nativeMuted?:boolean;
  private mediaFailure='';
  private pendingDial?:{patientId:string;key:string};
  constructor(readonly origin:string,private media:MediaAdapter,readonly native?:NativeAccounts) {}
  subscribe(listener:(state:AccountState)=>void):()=>void { this.listeners.add(listener); listener(this.state); return ()=>this.listeners.delete(listener); }
  private update(patch:Partial<AccountState>):void { this.state={...this.state,...patch}; for(const listener of this.listeners)listener(this.state); }
  async request<T>(path:string,body?:unknown):Promise<T> {
    if(this.native){try{return await this.native.request(path,body) as T;}catch(error){if((error as {code?:string})?.code==='UNAUTHORIZED')this.clear();throw error;}}
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8_000);
    const credential=this.token;
    try {
      const response=await fetch(`${this.origin}/api${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(credential?{Authorization:`Bearer ${credential}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
      const value=await response.json() as T & {error?:string};
      if(!response.ok){
        if(response.status===401 && credential && credential===this.token)this.clear();
        throw new Error(value.error || 'Could not complete request.');
      }
      return value;
    } finally {clearTimeout(timeout);}
  }
  private clear():void {
    if(this.currentId)void this.native?.end(this.currentId);
    this.nativeMuted=undefined;this.epoch++; this.token=''; this.currentId='';this.joinedId='';this.pendingDial=undefined;this.mediaFailure='';
    clearInterval(this.timer);clearInterval(this.reporting); this.media.end();
    this.update({account:undefined,dashboard:undefined,current:undefined,busy:false,updatedAt:undefined});
  }
  async signIn(code:string):Promise<void> {
    await this.run(async()=>{
      const result=this.native?await this.native.enroll(code.trim()):await this.request<Enrollment>('/enroll',{code:code.trim()});
      await this.adopt(result);
    });
  }
  private async adopt(result:Enrollment):Promise<void>{this.token=result.token;this.epoch++;this.update({account:result.account});await this.refresh();clearInterval(this.timer);clearInterval(this.reporting);this.timer=setInterval(()=>void this.refresh(),2_000);if(!this.native)this.reporting=setInterval(()=>{if(this.currentId&&this.media.phase()==='connected')void this.report(true);},8_000);}
  async restore():Promise<void>{if(!this.native)return;await this.run(async()=>{const result=await this.native!.restore();if(result.token&&result.account&&result.expiresAt)await this.adopt(result as Enrollment);});}
  async signOut():Promise<void> {
    await this.run(async()=>{try{if(this.currentId)await this.hangup();await this.request('/logout',{});}finally{this.clear();}});
  }
  private async run(operation:()=>Promise<void>):Promise<void> {
    if(this.state.busy)return;
    this.update({busy:true,error:''});
    try{await operation();}catch(error){this.update({error:error instanceof Error?error.message:'Could not complete request.'});}
    finally{this.update({busy:false});}
  }
  async refresh():Promise<void> {
    if(!this.token || this.polling)return;
    this.polling=true;const epoch=this.epoch,initialCurrent=this.currentId;
    try{
      if(this.native){for(const action of await this.native.actions()){if(action.action==='answer')this.currentId=action.id;if(action.action==='mute'&&this.currentId===action.id){this.nativeMuted=action.muted==='true';this.media.setMuted?.(this.nativeMuted);}if(action.action==='end'&&this.currentId===action.id){this.currentId='';this.joinedId='';this.nativeMuted=undefined;this.media.end();}}}
      const dashboard=await this.request<Dashboard>('/dashboard');
      if(this.native&&!this.currentId){const resumed=dashboard.calls.find(c=>c.ownsMedia&&['accepted','connected'].includes(c.state));if(resumed)this.currentId=resumed.id;}
      if(this.native){await this.native.sync(dashboard.calls);const status=await this.native.status?.();if(status)this.update({incomingReady:status.registered});}
      if(epoch!==this.epoch || (initialCurrent!==this.currentId&&!this.native))return;
      let current=dashboard.calls.find(call=>call.id===this.currentId);
      if(this.currentId && (!current || terminalCall(current.state))){this.currentId='';this.joinedId='';this.nativeMuted=undefined;this.media.end();current=undefined;}
      this.update({dashboard,current,error:this.mediaFailure,updatedAt:performance.now()});
      if(current && current.ownsMedia && ['accepted','connected'].includes(current.state) && this.joinedId!==current.id && !this.joining){
        this.joining=true;
        try{
          const result=await this.request<MediaInvitation>(`/calls/${current.id}/media`,{});
          if(epoch!==this.epoch || this.currentId!==current.id)return;
          this.joinedId=current.id;this.previousConnected=false;
          await releaseMessageAudio();
          await this.media.join(result.invitation,current.id);
          if(this.nativeMuted!==undefined)this.media.setMuted?.(this.nativeMuted);
          if(epoch===this.epoch && ['ended','error'].includes(this.media.phase()))await this.hangup();
        }finally{this.joining=false;}
      }
    }catch(error){if(epoch===this.epoch)this.update({error:error instanceof Error?error.message:'Unable to refresh calls.'});}
    finally{this.polling=false;}
  }
  async dial(patientId:string):Promise<void> {
    await this.run(async()=>{
      await releaseMessageAudio();
      this.mediaFailure='';
      if(!this.pendingDial || this.pendingDial.patientId!==patientId)this.pendingDial={patientId,key:`request-${Date.now()}-${Math.random().toString(36).slice(2)}`};
      const result=await this.request<{id:string}>('/calls',{patientId,requestKey:this.pendingDial.key});
      this.pendingDial=undefined;this.currentId=result.id;await this.refresh();
    });
  }
  async act(call:CallRecord,action:CallAction):Promise<void> {
    await this.run(async()=>{
      if(action==='answer')await releaseMessageAudio();
      if(action==='answer'&&this.native){await this.native.answer(call.id);return;}
      await this.request(`/calls/${call.id}/${action}`,{});
      if(action!=='answer')await this.native?.end(call.id);
      if(action==='answer'){this.mediaFailure='';this.currentId=call.id;}
      await this.refresh();
    });
  }
  async hangup():Promise<void> {
    const id=this.currentId,mediaError=this.media.error?.() || '';
    if(mediaError)this.mediaFailure=mediaError;
    this.currentId='';this.joinedId='';this.nativeMuted=undefined;this.media.end();this.update({current:undefined,...(mediaError?{error:mediaError}:{})});
    if(id)await this.native?.end(id);
    if(!id || !this.token)return;
    try{await this.request(`/calls/${id}/end`,{});await this.refresh();}
    catch(error){this.update({error:error instanceof Error?error.message:'Call ended locally; could not update history yet.'});}
  }
  mediaChanged(phase:string):void {
    if(!this.currentId || this.joining)return;
    if(['ended','error'].includes(phase)){void this.hangup();return;}
    const connected=phase==='connected';
    if(connected!==this.previousConnected){this.previousConnected=connected;void this.report(connected);}
  }
  private async report(connected:boolean):Promise<void> {
    if(this.native)return;
    const id=this.currentId;if(!id || !this.token)return;
    try{await this.request(`/calls/${id}/presence`,{connected,eventKey:`state-${++this.counter}`});}
    catch(error){this.update({error:error instanceof Error?error.message:'Media state report failed.'});}
  }
  dispose():void {clearInterval(this.timer);clearInterval(this.reporting);if(this.currentId)void this.hangup();this.listeners.clear();}
}
