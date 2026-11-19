import {memo,useEffect,useState,type ReactNode} from 'react';
import {BackHandler,Button,Pressable,ScrollView,Text,View} from 'react-native';
import {communicationDate,communicationIcon,communicationTitle,type CommunicationEntry,type CommunicationFilters} from '../../shared/communications';
import type {CommunicationController,WorkspaceState} from './controller';
import {HistoryOverlay} from './Overlay';
import {DatePicker} from './DatePicker';
import {rangeError} from './date';
export const text={color:'#dbe7ed',lineHeight:22},heading={...text,fontSize:19,fontWeight:'600' as const};
type Props={canCall:boolean;patientMode:boolean;controller:CommunicationController;state:WorkspaceState;locked:boolean;onPatient:(id:string)=>void;onCall:(patient:string)=>void};
function Workspace({controller,state,locked,onPatient,onCall,canCall,patientMode}:Props){
 const [advanced,setAdvanced]=useState(false),[from,setFrom]=useState(''),[to,setTo]=useState(''),[picker,setPicker]=useState<'from'|'to'|null>(null),[error,setError]=useState('');
 useEffect(()=>{setFrom(state.filters.fromDate||'');setTo(state.filters.toDate||'');},[state.filters.fromDate,state.filters.toDate]);
 useEffect(()=>{if(!picker)return;const back=BackHandler.addEventListener('hardwareBackPress',()=>{setPicker(null);return true;});return()=>back.remove();},[picker]);
 const context=state.context,disabled=locked||state.loading;const change=(key:keyof CommunicationFilters,value:string)=>{if(key==='patientId')onPatient(value);else void controller.filters({...state.filters,[key]:value||undefined});};
 useEffect(()=>{if(patientMode&&!state.filters.patientId&&context?.patients.length)onPatient(context.patients[0].id);},[patientMode,state.filters.patientId,context?.patients]);
 const choices=(label:string,key:keyof CommunicationFilters,options:{id:string;label:string}[])=> <View style={{gap:6}}><Text style={text}>{label}</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>{options.map(o=><Pressable key={o.id} accessibilityRole="button" accessibilityState={{selected:(state.filters[key]||'')===o.id,disabled}} disabled={disabled} onPress={()=>change(key,o.id)} style={{padding:10,minHeight:44,borderRadius:10,backgroundColor:(state.filters[key]||'')===o.id?'#245b74':'#203846',opacity:disabled?0.5:1}}><Text style={text}>{(state.filters[key]||'')===o.id?'✓ ':''}{o.label}</Text></Pressable>)}</View></View>;
 const patient=context?.patients.find(p=>p.id===state.filters.patientId);
 return <View style={{gap:12}}>
  <Text accessibilityRole="header" style={{...heading,fontSize:23}}>Communication history</Text>
  <Text style={text}>{patient?.displayName||(patientMode?'Your communications':'All authorized patients')} · Pacific time</Text>
  {(!patientMode||(context?.patients.length||0)>1)&&choices('Patient','patientId',[...(!patientMode?[{id:'',label:'All patients'}]:[]),...(context?.patients||[]).map(p=>({id:p.id,label:p.displayName}))])}
  {patient&&<><Text selectable style={text}>Patient ID: {patient.identifier}</Text>{canCall&&<Button title="App Audio/Video" disabled={locked||!patient.enrolled} onPress={()=>onCall(patient.id)}/>}{canCall&&!patient.enrolled&&<Text style={text}>The patient must enroll before an app call.</Text>}</>}
  {choices('Show','kind',[{id:'',label:'All'},{id:'call',label:'Calls'},{id:'message',label:'Messages'}])}
  <Button title={advanced?'Hide filters':'More filters'} onPress={()=>setAdvanced(!advanced)}/>
  {advanced&&<View style={{gap:12}}>
   {choices('Format','format',[{id:'',label:'Any format'},{id:'audio_video',label:'Audio/video'},{id:'audio',label:'Audio'},{id:'unknown',label:'Not recorded'}])}
   {choices('Direction','direction',[{id:'',label:'Any direction'},{id:'incoming',label:'Incoming'},{id:'outgoing',label:'Outgoing'}])}
   {choices('Channel','channel',[{id:'',label:'Any channel'},{id:'app',label:'App calls'},{id:'unknown',label:'Not recorded'}])}
   {choices('Sender','senderId',[{id:'',label:'Any sender'},...(context?.people||[]).map(p=>({id:p.id,label:p.displayName}))])}
   {choices('Recipient','recipientId',[{id:'',label:'Any recipient'},...(context?.recipients||[]).map(p=>({id:p.id,label:p.displayName}))])}
   <Text style={text}>Date range · Pacific time · end date included</Text>
   <Button title={'From date: '+(from||'Any date')} disabled={disabled} onPress={()=>setPicker('from')}/><Button title={'To date: '+(to||'Any date')} disabled={disabled} onPress={()=>setPicker('to')}/>
   <Button title="Apply dates" disabled={disabled} onPress={()=>{const message=rangeError(from,to);setError(message);if(!message)void controller.filters({...state.filters,fromDate:from||undefined,toDate:to||undefined});}}/>
   {!!error&&<Text accessibilityRole="alert" style={{color:'#ffabb2'}}>{error}</Text>}
  </View>}
  {picker&&<HistoryOverlay><DatePicker value={picker==='from'?from:to} onCancel={()=>setPicker(null)} onDone={date=>{if(picker==='from')setFrom(date);else setTo(date);setPicker(null);}}/></HistoryOverlay>}
  <View style={{minHeight:44,justifyContent:'center'}}>{state.newer?<Button title="New communications" disabled={disabled||!!state.detail} onPress={()=>void controller.reveal()}/>:<Text style={text}>{state.loading?'Loading communications…':`${state.page?.total??0} communications${state.earlier?' · Earlier page':''}`}</Text>}</View>
  {!!state.error&&<Text accessibilityRole="alert" style={{color:'#ffabb2'}}>{state.error}</Text>}
  {state.page&&!state.page.entries.length&&<Text style={text}>No communications match these filters.</Text>}
  {state.page?.entries.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Open '+communicationTitle(item)+' from '+item.senderLabel} disabled={locked} onPress={()=>void controller.open(item.id)} style={{paddingVertical:14,borderTopWidth:1,borderTopColor:'#354c5b',gap:5}}>
   <View style={{flexDirection:'row',gap:12,justifyContent:'space-between'}}><Text style={[heading,{flex:1}]}>{item.patientName}</Text><Text accessibilityLabel={communicationTitle(item)} style={heading}>{communicationIcon(item)}</Text></View>
   <Text style={text}>Patient ID: {item.patientIdentifier}</Text><Text style={text}>{communicationDate(item.createdAt)} · {item.direction} · {item.state}</Text><Text style={text}>{item.kind==='call'?`Observed connection ${item.observedSeconds}s`:item.durationMs===null?'Duration pending':`${Math.ceil(item.durationMs/1000)}s`} · Review status not recorded</Text>
  </Pressable>)}
  <View style={{gap:7}}>{state.earlier&&<Button title="Previous page" disabled={disabled} onPress={()=>void controller.back()}/>} {!!state.page?.next&&<Button title="Earlier communications" disabled={disabled} onPress={()=>void controller.more()}/>}</View>
 </View>;
}
export const CommunicationWorkspace=memo(Workspace,(a,b)=>a.state===b.state&&a.locked===b.locked&&a.canCall===b.canCall&&a.patientMode===b.patientMode);
export function CommunicationDetail({state,locked,canCall,onClose,onReply,onCall,children,composer,videoEnabled}:{videoEnabled:boolean;state:WorkspaceState;locked:boolean;canCall:boolean;onClose:()=>void;onReply:(row:CommunicationEntry,kind:'audio'|'video')=>void;onCall:(id:string)=>void;children:ReactNode;composer:boolean}){
 const [menu,setMenu]=useState(false);const row=state.detail!.entry;
 useEffect(()=>{const back=BackHandler.addEventListener('hardwareBackPress',()=>{if(menu)setMenu(false);else onClose();return true;});return()=>back.remove();},[menu,onClose]);
 return <View style={{flex:1}}><View style={{padding:18,gap:10,borderBottomColor:'#354c5b',borderBottomWidth:1}}><View style={{flexDirection:'row',gap:12,justifyContent:'space-between'}}><View style={{flex:1,gap:5}}><Text accessibilityRole="header" style={{...heading,fontSize:22}}>{row.patientName}</Text><Text style={text}>Patient ID: {row.patientIdentifier}</Text></View><View style={{gap:8}}><Pressable accessibilityRole="button" accessibilityLabel="Close communication" onPress={onClose} style={{minWidth:48,minHeight:44,alignItems:'center',justifyContent:'center'}}><Text style={{color:'#fff',fontSize:28}}>×</Text></Pressable><Button title="Reply ▾" disabled={locked} onPress={()=>setMenu(!menu)}/></View></View>
 {menu&&<View style={{gap:6}}><Button title={videoEnabled?"Video Message":"Video Message · Unavailable"} disabled={locked||!videoEnabled} onPress={()=>{setMenu(false);onReply(row,'video');}}/><Button title={canCall?'Video Call':'Video Call · Coming later'} disabled={locked||!canCall} onPress={()=>{setMenu(false);onCall(row.patientId);}}/><Button title="Audio Message" disabled={locked} onPress={()=>{setMenu(false);onReply(row,'audio');}}/><Button title="Audio Call · Coming later" disabled onPress={()=>{}}/></View>}
 </View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:18,gap:12,paddingBottom:40}}><Text style={text}>From: {row.senderLabel} ({row.senderRole})</Text><Text style={text}>To: {row.recipient.label}</Text><Text style={text}>{communicationDate(row.createdAt)}</Text>{!composer&&row.kind==='call'&&<Text style={text}>Observed connection {row.observedSeconds}s · Call recording is off.</Text>}{!composer&&row.kind==='message'&&!state.detail!.playbackAvailable&&<Text style={text}>Media {row.state==='available'?'unavailable':row.state}.</Text>}{children}</ScrollView></View>;
}
