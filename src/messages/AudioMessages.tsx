import {useEffect,useState} from 'react';
import {AppState,Button,Text,View} from 'react-native';
import {requireOptionalNativeModule} from 'expo';
import type {AccountClient,AccountState} from '../accounts/client';
import {MessageController} from './controller';
import {ownMessageAudio} from './focus';
// Old development binaries remain callable and show update guidance without loading ExpoAudio.
const supported=Boolean(requireOptionalNativeModule('ExpoAudio'));
export function AudioMessages(props:{client:AccountClient;account:AccountState;selected:string}){
 if(!supported)return props.account.account?<Text style={{color:'#a4b5c2'}}>Install the audio-message preview update to record and play messages.</Text>:null;
 return <MessagesReady {...props}/>;
}
function MessagesReady({client,account,selected}:{client:AccountClient;account:AccountState;selected:string}){
 const [controller]=useState(()=>new MessageController(client.native?'https://phoneapp.bawebtech.com':client.origin,(path,body)=>client.request(path,body),require('./native-audio').nativeMessageAudio()));
 const [state,setState]=useState(controller.state);const [position,setPosition]=useState({current:0,duration:0,playing:false});const [recipient,setRecipient]=useState('');
 const blocked=Boolean(account.current||account.dashboard?.calls.some(c=>c.canAnswer));
 useEffect(()=>controller.subscribe(setState),[controller]);
 useEffect(()=>{void controller.adopt(account.account?.id||'',blocked);},[controller,account.account?.id,blocked,account.updatedAt]);
 useEffect(()=>{if(selected&&selected!==controller.state.selected&&controller.state.patients.some(p=>p.id===selected))void controller.select(selected);},[controller,selected,state.patients]);
 useEffect(()=>{setRecipient('');},[state.selected]);
 useEffect(()=>{
  const unown=ownMessageAudio(()=>controller.interrupt());
  const listener=AppState.addEventListener('change',s=>{if(s==='background')void controller.interrupt();if(s==='active')void controller.refresh();});
  const timer=setInterval(()=>{setPosition(controller.audio.position());if(controller.state.recording&&controller.audio.hasDraft())void controller.stop();},500);
  return()=>{unown();listener.remove();clearInterval(timer);controller.dispose();};
 },[controller]);
 if(!account.account||!state.enabled)return null;
 const text={color:'#dbe7ed',lineHeight:22};const recipients=state.timeline?.recipients||[];const target=recipient||recipients[0]?.id;const waiting=state.busy||blocked;const isPatient=['patient','caregiver'].includes(account.account.role);
 return <View style={{padding:18,gap:12,backgroundColor:'#142532',borderRadius:18}}>
  <Text style={{...text,fontSize:22,fontWeight:'600'}}>Communication history</Text>
  {state.patients.map(p=><Button key={p.id} title={(p.id===state.selected?'✓ ':'')+p.displayName} disabled={state.busy||state.recording} onPress={()=>void controller.select(p.id)}/>)}
  <Text style={text}>Audio messages · Available for 7 days · Call recording remains off.</Text>
  {isPatient&&recipients.length>1&&recipients.map(r=><Button key={r.id} title={(target===r.id?'✓ ':'')+r.displayName} disabled={waiting} onPress={()=>setRecipient(r.id)}/>)}
  {blocked&&<Text style={text}>Finish the call before recording or playing a message.</Text>}
  {!state.recording?<Button title={state.draft?'Re-record audio message':'Record audio message'} disabled={waiting||!state.selected||isPatient&&!target} onPress={()=>void controller.start()}/>:<Button title="Stop recording" onPress={()=>void controller.stop()} disabled={state.busy}/>}
  {state.draft&&!state.recording&&<><Button title="Preview recording" disabled={waiting} onPress={()=>void controller.preview()}/><Button title="Send audio message" disabled={waiting} onPress={()=>void controller.send(target)}/><Button title="Discard recording" disabled={state.busy} onPress={()=>void controller.discard()}/></>}
  {state.busy&&<Text style={text}>Working…</Text>}
  {!!state.notice&&<Text style={text}>{state.notice}</Text>}
  {!!state.error&&<Text accessibilityRole="alert" style={{color:'#ffabb2'}}>{state.error}</Text>}
  {position.duration>0&&<View style={{gap:8}}><Text style={text}>Playback {Math.floor(position.current)} / {Math.floor(position.duration)} seconds</Text><Button title="Pause playback" onPress={()=>controller.audio.pause()}/><Button title="Resume playback" onPress={()=>void controller.audio.resume()}/><Button title="Back 15 seconds" onPress={()=>void controller.audio.seek(position.current-15)}/><Button title="Forward 15 seconds" onPress={()=>void controller.audio.seek(position.current+15)}/></View>}
  {!state.timeline?.entries.length&&<Text style={text}>Your calls and audio messages will appear here.</Text>}
  {state.timeline?.entries.map(row=><View key={row.kind+row.id} style={{gap:6,paddingVertical:12,borderTopWidth:1,borderTopColor:'#354c5b'}}>
   <Text style={text}>{row.kind==='call'?'Call':'Audio message'} · {row.senderLabel}</Text><Text style={text}>{new Date(row.createdAt).toLocaleString()} · {row.state}</Text>
   {row.kind==='message'?<><Text style={text}>{row.durationMs===null?'Processing duration':Math.ceil(row.durationMs/1000)+' seconds'} · Expires {new Date(row.expiresAt).toLocaleDateString()}</Text>{row.state==='available'&&<Button title="Play audio message" disabled={waiting} onPress={()=>void controller.play(row.id)}/>} {row.state==='available'&&isPatient&&<Button title="Record reply" disabled={waiting} onPress={()=>{setRecipient(row.recipientStaffId);void controller.start();}}/>}{row.state==='failed'&&<Text style={text}>Recording unavailable. {row.failureCode}</Text>}</>:<Text style={text}>Observed connection {row.observedSeconds}s · Recording/transcript off</Text>}
  </View>)}
  {state.timeline?.next&&<Button title="Load earlier communications" disabled={state.busy} onPress={()=>void controller.more()}/>}
 </View>;
}
