import { requireOptionalNativeModule } from 'expo';
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import type { Enrollment,CallRecord } from '../../shared/accounts';
import type { NativeAccounts } from './client';
export type CallingModule={
 version:number;enroll(code:string):Promise<Enrollment>;restore():Promise<Partial<Enrollment>>;request(path:string,body:string|null):Promise<unknown>;
 syncCall(id:string,state:string,direction:string):Promise<void>;actions():Promise<{id:string;action:string}[]>;answer(id:string):Promise<void>;end(id:string):Promise<void>;
 getAudioRoute(session:number):Promise<unknown>;mediaState(id:string,connected:boolean):Promise<void>;watchMedia?(id:string,peer:number):Promise<void>;stopMedia?():Promise<void>;setRoute?(route:string):Promise<void>;
};
export const calling=requireOptionalNativeModule<CallingModule>('PhoneappCalling');
export function nativeAccounts():NativeAccounts|undefined {
 if(!calling)return undefined;
 return {
  enroll:async code=>{
   if(Platform.OS==='android'&&Number(Platform.Version)>=33)await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
   return calling.enroll(code);
  },restore:()=>calling.restore(),request:(path,body)=>calling.request(path,body===undefined?null:JSON.stringify(body)),
  sync:async calls=>{for(const c of calls.slice(0,10))await calling.syncCall(c.id,c.state,c.direction);},
  actions:()=>calling.actions(),answer:id=>calling.answer(id),end:id=>calling.end(id),
 };
}
let watched='';
export function watchNativeMedia(id:string|undefined,peer:number|undefined,connected:boolean):void {
 if(!calling)return;
 if(!id){if(watched){watched='';NativeModules.PhoneappMediaObserver?.stop();void calling.stopMedia?.();}return;}
 void calling.mediaState(id,connected).catch(()=>{});
 if(peer===undefined||watched===id)return;
 watched=id;
 if(Platform.OS==='ios')NativeModules.PhoneappMediaObserver?.watch(id,peer);
 else void calling.watchMedia?.(id,peer).catch(()=>{});
}
