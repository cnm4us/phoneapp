import {AudioMessages,supportsCommunicationWorkspace} from '../messages/AudioMessages';
import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { AccountClient, type AccountState } from './client';
import { terminalCall } from '../../shared/accounts';

export function AccountPanel({ client, state, showIncoming = true }: {client:AccountClient;state:AccountState;showIncoming?:boolean}) {
  const [code,setCode]=useState('');
  const [selected,setSelected]=useState('');
  const patient=state.dashboard?.patients.find(row=>row.id===selected);
  const unified=Boolean(state.dashboard?.communicationWorkspace&&supportsCommunicationWorkspace);
  const incoming=state.dashboard?.calls.find(row=>row.canAnswer);
  return <View style={styles.stack}>
    <Text style={styles.title}>{state.account ? state.account.displayName : 'Connect to your care team'}</Text>
    <Text style={styles.note}>Synthetic test accounts · {client.native?'Native calling test':'Keep this screen open'} · Recording off</Text>
    {!state.account ? <View style={styles.card}>
      <Text style={styles.text}>Paste the one-time enrollment code issued for this device’s test account.</Text>
      <TextInput accessibilityLabel="Enrollment code" placeholder="One-time enrollment code" placeholderTextColor="#81929d" style={styles.input} value={code} onChangeText={setCode} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!state.busy} />
      <Button title={state.busy?'Signing in…':'Sign in'} disabled={state.busy||!code.trim()} onPress={()=>{const value=code;setCode('');void client.signIn(value);}} />
    </View> : <>
      <Text style={styles.note}>{state.account.role==='patient'?'Patient':state.account.role==='caregiver'?'Caregiver':'Care team'} account · {client.native?'Sign-in saved on this phone':'Signed in until reload or session expiry'}</Text>
      {client.native&&<Text style={styles.note}>{state.incomingReady?'Incoming call registration ready':'Incoming call registration pending. Reopen the app while online if this persists.'}</Text>}
      <Button title="Sign out" disabled={state.busy||Boolean(state.current)} onPress={()=>void client.signOut()} />
      {showIncoming && incoming && !state.current && <View style={styles.card} accessibilityLiveRegion="assertive">
        <Text style={styles.heading}>Incoming app call</Text><Text style={styles.text}>{incoming.callerName}</Text>
        <Button title="Answer with audio/video" disabled={state.busy} onPress={()=>void client.act(incoming,'answer')} />
        <Button title="Decline" disabled={state.busy} onPress={()=>void client.act(incoming,'decline')} />
      </View>}
      {state.current && <View style={styles.card}>
        <Text style={styles.heading}>{state.current.state==='ringing'?'Calling…':'App call'}</Text>
        <Text style={styles.text}>{state.current.patientName} · {state.current.state}</Text>
        <Button title={state.current.state==='ringing'?'Cancel call':'End app call'} onPress={()=>void client.hangup()} />
      </View>}
      {!unified&&!!state.dashboard?.patients.length && !state.current && <View style={styles.card}>
        <Text style={styles.heading}>Patients</Text>
        {state.dashboard.patients.map(row=><Button key={row.id} title={row.displayName} onPress={()=>setSelected(row.id)} />)}
        {patient && <View style={styles.stack}>
          <Text style={styles.heading}>{patient.displayName} · Call options</Text>
          <Button title="App Audio/Video" disabled={state.busy||!patient.enrolled} onPress={()=>void client.dial(patient.id)} />
          {!patient.enrolled && <Text style={styles.note}>Patient must enroll before calling.</Text>}
          <Text style={styles.note}>App Audio · Coming later{ '\n' }Phone #1 / #2 / #3 · Coming later</Text>
        </View>}
      </View>}
      {unified&&state.dashboard?.calls.filter(row=>!terminalCall(row.state)&&!row.ownsMedia&&!row.canAnswer).map(row=><Text key={row.id} style={styles.note}>{row.patientName} · {row.state} · Active on another signed-in device.</Text>)}
      <AudioMessages client={client} account={state} selected={selected}/>
      {!unified&&<View style={styles.card}>
        <Text style={styles.heading}>Call history</Text>
        {!state.dashboard?.calls.length && <Text style={styles.note}>Your app calls will appear here.</Text>}
        {state.dashboard?.calls.map(row=><View key={row.id} style={styles.history}>
          <Text style={styles.text}>{row.direction==='incoming'?row.callerName:row.patientName} · {row.direction}</Text>
          <Text style={styles.note}>{new Date(row.createdAt).toLocaleString()} · {row.state}</Text>
          <Text style={styles.note}>Observed connection: {Math.floor(row.observedSeconds/60)}m {row.observedSeconds%60}s</Text>
          <Text style={styles.note}>Recording / transcript: Off</Text>
          <Text selectable style={styles.id}>Call ID: {row.id}</Text>
          {!terminalCall(row.state)&&!row.ownsMedia&&!row.canAnswer&&<Text style={styles.note}>Active on another signed-in device.</Text>}
        </View>)}
      </View>}
    </>}
    {!!state.error&&<Text style={styles.error} accessibilityRole="alert">{state.error}</Text>}
  </View>;
}
const styles=StyleSheet.create({
  stack:{gap:12},title:{color:'#f0f6f7',fontSize:28,fontWeight:'700'},heading:{color:'#edf5f7',fontSize:18,fontWeight:'600'},text:{color:'#f0f6f7',lineHeight:22},note:{color:'#a4b5c2',lineHeight:21},card:{backgroundColor:'#142532',borderRadius:18,padding:18,gap:12},input:{backgroundColor:'#0b1923',borderColor:'#354c5b',borderWidth:1,color:'#fff',borderRadius:10,padding:12,minHeight:46},history:{gap:5,paddingVertical:10,borderTopColor:'#354c5b',borderTopWidth:1},id:{color:'#a4b5c2',fontSize:10},error:{color:'#ffabb2',lineHeight:21},
});
