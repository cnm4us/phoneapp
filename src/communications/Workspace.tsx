import {useEffect,useState,type ReactNode} from 'react';
import {Button,Pressable,Text,TextInput,View} from 'react-native';
import {communicationDate,communicationIcon,communicationTitle,type CommunicationEntry,type CommunicationFilters} from '../../shared/communications';
import type {CommunicationController,WorkspaceState} from './controller';
const text={color:'#dbe7ed',lineHeight:22},heading={...text,fontSize:19,fontWeight:'600' as const};
export function CommunicationWorkspace({controller,state,locked,onPatient,onPlay,onReply,onCall,renderMedia,canCall}:{canCall:boolean;controller:CommunicationController;state:WorkspaceState;locked:boolean;onPatient:(id:string)=>void;onPlay:(row:CommunicationEntry)=>void;onReply:(row:CommunicationEntry)=>void;onCall:(patient:string)=>void;renderMedia:(row:CommunicationEntry)=>ReactNode}){
 const [advanced,setAdvanced]=useState(false),[from,setFrom]=useState(''),[to,setTo]=useState('');useEffect(()=>{setFrom(state.filters.fromDate||'');setTo(state.filters.toDate||'');},[state.filters.fromDate,state.filters.toDate]);
 const context=state.context,disabled=locked||state.loading;const change=(key:keyof CommunicationFilters,value:string)=>{if(key==='patientId')onPatient(value);else void controller.filters({...state.filters,[key]:value||undefined});};
 const choices=(label:string,key:keyof CommunicationFilters,options:{id:string;label:string}[])=> <View style={{gap:6}}><Text style={text}>{label}</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>{options.map(o=><Pressable key={o.id} accessibilityRole="button" accessibilityState={{selected:(state.filters[key]||'')===o.id,disabled}} disabled={disabled} onPress={()=>change(key,o.id)} style={{padding:9,borderRadius:10,backgroundColor:(state.filters[key]||'')===o.id?'#245b74':'#203846',opacity:disabled?0.5:1}}><Text style={text}>{(state.filters[key]||'')===o.id?'✓ ':''}{o.label}</Text></Pressable>)}</View></View>;
 const row=state.detail?.entry,patient=context?.patients.find(p=>p.id===state.filters.patientId);
 return <View style={{gap:12}}>
  <Text style={{...heading,fontSize:23}}>Communication history</Text>
  <Text style={text}>{state.filters.patientId?patient?.displayName||'Patient':'All authorized patients'} · Times: Pacific ({context?.timezone||'America/Los_Angeles'})</Text>
  {choices('Patient','patientId',[{id:'',label:'All patients'},...(context?.patients||[]).map(p=>({id:p.id,label:p.displayName}))])}
  {patient&&<><Text selectable style={text}>Patient ID: {patient.identifier}</Text>{canCall&&<Button title="App Audio/Video" disabled={locked||!patient.enrolled} onPress={()=>onCall(patient.id)}/>}{canCall&&!patient.enrolled&&<Text style={text}>The patient must enroll before an app call. Recorded messages are still available.</Text>}</>}
  {choices('Show','kind',[{id:'',label:'All'},{id:'call',label:'Calls'},{id:'message',label:'Messages'}])}
  <Button title={advanced?'Hide filters':'More filters'} onPress={()=>setAdvanced(!advanced)}/>
  {advanced&&<View style={{gap:12}}>
   {choices('Format','format',[{id:'',label:'Any format'},{id:'audio_video',label:'Audio/video'},{id:'audio',label:'Audio'},{id:'unknown',label:'Not recorded'}])}
   {choices('Direction','direction',[{id:'',label:'Any direction'},{id:'incoming',label:'Incoming'},{id:'outgoing',label:'Outgoing'}])}
   {choices('Channel','channel',[{id:'',label:'Any channel'},{id:'app',label:'App calls'},{id:'unknown',label:'Not recorded'}])}
   {choices('Sender','senderId',[{id:'',label:'Any sender'},...(context?.people||[]).map(p=>({id:p.id,label:p.displayName}))])}
   {choices('Recipient','recipientId',[{id:'',label:'Any recipient'},...(context?.recipients||[]).map(p=>({id:p.id,label:p.displayName}))])}
   <Text style={text}>Date range (YYYY-MM-DD, Pacific time)</Text>
   <TextInput accessibilityLabel="From date" value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" placeholderTextColor="#9aacb7" style={{...text,padding:10,backgroundColor:'#0b1923'}} editable={!disabled}/>
   <TextInput accessibilityLabel="To date" value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" placeholderTextColor="#9aacb7" style={{...text,padding:10,backgroundColor:'#0b1923'}} editable={!disabled}/>
   <Button title="Apply dates" disabled={disabled} onPress={()=>void controller.filters({...state.filters,fromDate:from||undefined,toDate:to||undefined})}/>
  </View>}
  {state.loading&&<Text style={text}>Updating communications…</Text>}
  {!!state.error&&<Text accessibilityRole="alert" style={{color:'#ffabb2'}}>{state.error}</Text>}
  <Text style={text}>{state.page?.total??0} communications match these filters{state.earlier?' · Earlier page':''}</Text>
  {state.page&&!state.page.entries.length&&<Text style={text}>No communications match these filters.</Text>}
  {state.page?.entries.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Open '+communicationTitle(item)+' from '+item.senderLabel} disabled={locked} onPress={()=>void controller.open(item.id)} style={{paddingVertical:12,borderTopWidth:1,borderTopColor:'#354c5b',gap:5}}>
   <Text style={heading}>{communicationIcon(item)} {communicationTitle(item)} · {item.patientName}</Text><Text style={text}>Patient ID: {item.patientIdentifier}</Text><Text style={text}>{communicationDate(item.createdAt)} · {item.direction} · {item.state}</Text><Text style={text}>From {item.senderLabel} → {item.recipient.label}</Text><Text style={text}>{item.kind==='call'?`Observed connection ${item.observedSeconds}s`:item.durationMs===null?'Duration pending':`${Math.ceil(item.durationMs/1000)}s`} · Review status not recorded</Text>
  </Pressable>)}
  <View style={{gap:7}}>{state.earlier&&<Button title="Previous page" disabled={disabled} onPress={()=>void controller.back()}/>} {!!state.page?.next&&<Button title="Earlier communications" disabled={disabled} onPress={()=>void controller.more()}/>}</View>
  {row&&state.detail&&<View accessibilityLabel="Communication detail" style={{padding:14,borderRadius:12,backgroundColor:'#0b1923',gap:9}}>
   <Text style={heading}>{communicationTitle(row)} · {row.patientName}</Text><Text selectable style={text}>Patient ID: {row.patientIdentifier}</Text><Text style={text}>{communicationDate(row.createdAt)} · {row.direction} · {row.state}</Text><Text style={text}>From {row.senderLabel} ({row.senderRole}) → {row.recipient.label}</Text><Text style={text}>Channel: {row.channel==='app'?'App':'Not recorded'} · Review/read status: not recorded</Text>
   <Text style={heading}>Original</Text>{renderMedia(row)}
   {row.kind==='message'?<><Text style={text}>Exact original upload is not retained. {state.detail.playbackAvailable?'A saved playback copy is available.':'Playback is unavailable.'}</Text>{state.detail.expiresAt&&<Text style={text}>Media expiry: {communicationDate(state.detail.expiresAt)}</Text>}{state.detail.playbackAvailable&&<Button title={row.format==='audio_video'?'Play video message':'Play audio message'} disabled={locked} onPress={()=>onPlay(row)}/>}</>:<><Text style={text}>Observed connection: {row.observedSeconds}s. Call recording is off.</Text><Text style={text}>The call’s actual media format was not recorded.</Text></>}
   {!!state.detail.failureCode&&<Text style={text}>Media unavailable: {state.detail.failureCode}</Text>}
   <Text style={heading}>Transcript</Text><Text style={text}>No transcript is available.</Text>
   {state.detail.staff&&<><Text style={heading}>Clinical notes</Text><Text style={text}>Clinical notes are not available yet.</Text><Text style={heading}>Staff discussion</Text><Text style={text}>Staff comments are not available yet.</Text></>}
   <Button title="Record reply" disabled={locked} onPress={()=>onReply(row)}/><Button title="Close detail" onPress={()=>void controller.close()}/>
  </View>}
 </View>;
}
