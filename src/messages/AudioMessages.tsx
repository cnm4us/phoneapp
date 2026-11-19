import {CommunicationController} from '../communications/controller';
import {CommunicationWorkspace} from '../communications/Workspace';
import type {CommunicationEntry} from '../../shared/communications';
import {useEffect,useState,useRef} from 'react';
import {AppState,Button,Text,View,Image} from 'react-native';
import {requireOptionalNativeModule} from 'expo';
import type {AccountClient,AccountState} from '../accounts/client';
import {MessageController} from './controller';
import {ownMessageAudio} from './focus';
// Old development binaries remain callable and show update guidance without loading ExpoAudio.
const videoSupported=Boolean(requireOptionalNativeModule('ExpoCamera')&&requireOptionalNativeModule('ExpoVideo'));
const supported=Boolean(requireOptionalNativeModule('ExpoAudio'));
export const supportsCommunicationWorkspace=supported&&videoSupported;
export function AudioMessages(props:{client:AccountClient;account:AccountState;selected:string}){
 if(!supported)return props.account.account?<Text style={{color:'#a4b5c2'}}>Install the audio-message preview update to record and play messages.</Text>:null;
 return <MessagesReady {...props}/>;
}
function MessagesReady({client,account,selected}:{client:AccountClient;account:AccountState;selected:string}){
 const [controller]=useState(()=>new MessageController(client.native?'https://phoneapp.bawebtech.com':client.origin,(path,body)=>client.request(path,body),videoSupported?require('./native-media').nativeMessageMedia():require('./native-audio').nativeMessageAudio(),videoSupported));
 const VideoSurface=videoSupported?require('./native-media').NativeVideoSurface:null;
 const media=controller.audio as import('./native-media').NativeMessageMedia;const previousSelected=useRef('');const [cameraError,setCameraError]=useState('');
 const [workspace]=useState(()=>new CommunicationController((path,body)=>client.request(path,body),()=>controller.interrupt()));const [workspaceState,setWorkspaceState]=useState(workspace.state);
 const [state,setState]=useState(controller.state);const [position,setPosition]=useState({current:0,duration:0,playing:false});const [recipient,setRecipient]=useState('');
 const blocked=Boolean(account.current||account.dashboard?.calls.some(c=>c.canAnswer));
 useEffect(()=>controller.subscribe(setState),[controller]);
 useEffect(()=>workspace.subscribe(setWorkspaceState),[workspace]);
 useEffect(()=>{if(state.workspaceEnabled&&videoSupported)void workspace.adopt(account.account?.id||'');else void workspace.adopt('');},[workspace,account.account?.id,state.workspaceEnabled]);
 useEffect(()=>{const id=workspaceState.filters.patientId;if(id&&id!==controller.state.selected)void controller.select(id);},[controller,workspaceState.filters.patientId]);
 useEffect(()=>{void controller.adopt(account.account?.id||'',blocked);},[controller,account.account?.id,blocked,account.updatedAt]);
 useEffect(()=>{if(selected&&selected!==previousSelected.current&&controller.state.patients.some(p=>p.id===selected)){previousSelected.current=selected;if(selected!==controller.state.selected&&!controller.state.draft&&!controller.state.recording)void controller.select(selected);}},[controller,selected,state.patients]);
 useEffect(()=>{setRecipient('');},[account.account?.id]);
 useEffect(()=>{
  const unown=ownMessageAudio(()=>controller.interrupt());
  const listener=AppState.addEventListener('change',s=>{if(s!=='active')void controller.interrupt();if(s==='active'){void controller.refresh();void workspace.refresh();}});
  const timer=setInterval(()=>{setPosition(controller.audio.position());void controller.observeCapture();},500);
  const workspaceTimer=setInterval(()=>{if(AppState.currentState==='active'&&controller.state.workspaceEnabled)void workspace.refresh();},4000);
  return()=>{unown();listener.remove();clearInterval(timer);clearInterval(workspaceTimer);workspace.dispose();controller.dispose();};
 },[controller]);
 if(!account.account||!state.enabled)return null;
 const unified=Boolean(state.workspaceEnabled&&videoSupported),composerReady=!unified||Boolean(workspaceState.filters.patientId&&workspaceState.filters.patientId===state.selected);
 const choosePatient=(id:string)=>{setRecipient('');void workspace.filters({...workspace.state.filters,patientId:id||undefined});void controller.select(id);};
 const reply=async(row:CommunicationEntry)=>{if(isPatient)setRecipient(row.senderRole==='patient'||row.senderRole==='caregiver'?row.recipient.id:row.senderId);await workspace.filters({...workspace.state.filters,patientId:row.patientId});await controller.select(row.patientId);await controller.start();};
 const text={color:'#dbe7ed',lineHeight:22};const recipients=state.timeline?.recipients||[];const target=recipients.some(r=>r.id===recipient)?recipient:recipients[0]?.id;const waiting=state.busy||blocked;const isPatient=['patient','caregiver'].includes(account.account.role);
 return <View style={{padding:18,gap:12,backgroundColor:'#142532',borderRadius:18}}>
  {unified&&<CommunicationWorkspace canCall={!isPatient} controller={workspace} state={workspaceState} locked={state.busy||state.recording||state.draft||blocked} onPatient={choosePatient} onPlay={row=>void controller.play(row.sourceId)} onReply={row=>void reply(row)} onCall={id=>void client.dial(id)} renderMedia={row=><>{row.hasThumbnail&&<VideoPoster client={client} id={row.sourceId}/>} {VideoSurface&&state.playingSourceId===row.sourceId&&<VideoSurface media={media}/>}</>}/>}
  <Text style={{...text,fontSize:22,fontWeight:'600'}}>{unified?'Record message':'Communication history'}</Text>
  {unified&&<Text style={text}>{composerReady?'For '+state.patients.find(p=>p.id===state.selected)?.displayName:'Select a patient in communication history to record a message.'}</Text>}
  {!unified&&state.patients.map(p=><Button key={p.id} title={(p.id===state.selected?'✓ ':'')+p.displayName} disabled={state.busy||state.recording||state.draft} onPress={()=>{setRecipient('');void controller.select(p.id);}}/>)}
  <Text style={text}>{state.videoEnabled&&videoSupported?'Audio and video messages':'Audio messages'} · Available for 7 days · Call recording remains off.</Text>
  {isPatient&&recipients.length>1&&recipients.map(r=><Button key={r.id} title={(target===r.id?'✓ ':'')+r.displayName} disabled={waiting||state.draft||state.recording} onPress={()=>setRecipient(r.id)}/>)}
  {blocked&&<Text style={text}>Finish the call before recording or playing a message.</Text>}
  {VideoSurface&&(!unified||!state.playingSourceId)&&<VideoSurface media={media}/>}
  {!!cameraError&&<Text accessibilityRole="alert" style={{color:'#ffabb2'}}>{cameraError}</Text>}
  {state.videoEnabled&&!videoSupported&&<Text style={text}>Install the video-message update to record and play video.</Text>}
  {state.recording&&<Text style={text}>Recording {Math.floor((Date.now()-state.recordedAt)/1000)}s / {state.mediaKind==='video'?120:180}s · Stop to preview</Text>}
  {!state.recording?<Button title={state.draft?'Re-record audio message':'Record audio message'} disabled={waiting||!composerReady||!state.selected||isPatient&&!target} onPress={()=>void controller.start()}/>:<Button title="Stop recording" onPress={()=>void controller.stop()} disabled={state.busy}/>}
  {!state.recording&&state.videoEnabled&&videoSupported&&<>
   {!media.cameraOpen()?<Button title={state.draft?'Re-record video message':'Open video camera'} disabled={waiting||!composerReady} onPress={()=>{setCameraError('');void controller.prepare('video',media.prepareVideo);}}/>:<><Button title="Switch camera" disabled={waiting} onPress={()=>media.switchCamera()}/><Button title="Record video message" disabled={waiting||!composerReady} onPress={()=>void controller.start('video')}/><Button title="Close camera" disabled={waiting} onPress={()=>void media.closeCamera()}/></>}
  </>}
  {state.draft&&!state.recording&&<><Button title="Preview recording" disabled={waiting} onPress={()=>void controller.preview()}/><Button title={'Send '+state.mediaKind+' message'} disabled={waiting} onPress={()=>void controller.send(target)}/><Button title="Discard recording" disabled={state.busy} onPress={()=>void controller.discard()}/></>}
  {state.busy&&<><Text style={text}>{state.progress===null?'Working…':`Transferring ${Math.min(100,Math.round(state.progress*100))}%`}</Text><Button title="Cancel transfer" onPress={()=>void controller.interrupt()}/></>}
  {!!state.notice&&<Text style={text}>{state.notice}</Text>}
  {!!state.error&&<Text accessibilityRole="alert" style={{color:'#ffabb2'}}>{state.error}</Text>}
  {position.duration>0&&<View style={{gap:8}}><Text style={text}>Playback {Math.floor(position.current)} / {Math.floor(position.duration)} seconds</Text><Button title="Pause playback" onPress={()=>controller.audio.pause()}/><Button title="Resume playback" onPress={()=>void controller.audio.resume()}/><Button title="Back 15 seconds" onPress={()=>void controller.audio.seek(position.current-15)}/><Button title="Forward 15 seconds" onPress={()=>void controller.audio.seek(position.current+15)}/></View>}
  {!unified&&!state.timeline?.entries.length&&<Text style={text}>Your calls and audio/video messages will appear here.</Text>}
  {!unified&&state.timeline?.entries.map(row=><View key={row.kind+row.id} style={{gap:6,paddingVertical:12,borderTopWidth:1,borderTopColor:'#354c5b'}}>
   <Text style={text}>{row.kind==='call'?'Call':row.mediaKind==='video'?'Video message':'Audio message'} · {row.senderLabel}</Text><Text style={text}>{new Date(row.createdAt).toLocaleString()} · {row.state}</Text>
   {row.kind==='message'?<>{row.mediaKind==='video'&&row.state==='available'&&row.hasThumbnail&&(state.timeline?.entries.filter(e=>e.kind==='message'&&e.mediaKind==='video'&&e.state==='available').slice(0,6).some(e=>e.id===row.id))&&<VideoPoster client={client} id={row.id}/>}<Text style={text}>{row.durationMs===null?'Processing duration':Math.ceil(row.durationMs/1000)+' seconds'} · Expires {new Date(row.expiresAt).toLocaleDateString()}</Text>{row.state==='available'&&<Button title={row.mediaKind==='video'?'Play video message':'Play audio message'} disabled={waiting} onPress={()=>void controller.play(row.id)}/>} {row.state==='available'&&isPatient&&<Button title="Record reply" disabled={waiting||state.draft||state.recording} onPress={()=>{setRecipient(row.recipientStaffId);void controller.start();}}/>}{row.state==='failed'&&<Text style={text}>Recording unavailable. {row.failureCode}</Text>}</>:<Text style={text}>Observed connection {row.observedSeconds}s · Recording/transcript off</Text>}
  </View>)}
  {!unified&&state.timeline?.next&&<Button title="Load earlier communications" disabled={state.busy} onPress={()=>void controller.more()}/>}
 </View>;
}

function VideoPoster({client,id}:{client:AccountClient;id:string}){
 const [uri,setUri]=useState('');useEffect(()=>{let canceled=false;const fs=require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');const target=fs.cacheDirectory+'phoneapp-video-poster-'+id+'.jpg';let task:import('expo-file-system/legacy').DownloadResumable|undefined;
 void (async()=>{try{const grant=await client.request<import('../../shared/messages').MediaGrant>(`/messages/v2/${id}/thumbnail`,{});if(canceled)return;task=fs.createDownloadResumable((client.native?'https://phoneapp.bawebtech.com':client.origin)+grant.path,target,{headers:{Authorization:'Media '+grant.token},sessionType:fs.FileSystemSessionType.FOREGROUND});const result=await task.downloadAsync();if(!canceled&&result?.status===200)setUri(target);else await fs.deleteAsync(target,{idempotent:true});}catch{await fs.deleteAsync(target,{idempotent:true});}})();return()=>{canceled=true;void task?.cancelAsync();void fs.deleteAsync(target,{idempotent:true});};},[client,id]);return uri?<Image source={{uri}} resizeMode="contain" style={{width:'100%',height:180}}/>:null;
}
