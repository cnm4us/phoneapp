import { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Button, Keyboard, KeyboardAvoidingView, Linking, Platform, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { requireOptionalNativeModule } from 'expo';
import { CallSession } from './src/call/session';
import { endpoint, displayInvitation, roomTimeLeft } from './src/call/core';
import type { Invitation } from './shared/protocol';
import { QualityControls } from './src/call/QualityControls';
import { CallVideoStage } from './src/call/CallVideoStage';
import { SettingsPanel } from './src/call/SettingsPanel';
import { AudioOutputControls } from './src/call/AudioOutputControls';
import { nativeAccounts,watchNativeMedia,calling } from './src/accounts/native';
import { AccountClient } from './src/accounts/client';
import {HistoryOverlayProvider} from './src/communications/Overlay';
import { AccountPanel } from './src/accounts/AccountPanel';
import { IncomingAlerts } from './src/call/incoming-alert';
import { nativeIncomingAlertDriver } from './src/call/native-incoming-alert';
import { IncomingCallPrompt } from './src/call/IncomingCallPrompt';
import { IncomingAlertControls } from './src/call/IncomingAlertControls';

const labels = { idle: 'Ready to test', permissions: 'Requesting microphone / camera', joining: 'Joining room…', waiting: 'Waiting for the other phone…', connecting: 'Connecting media…', connected: 'Connected', reconnecting: 'Connection interrupted…', ended: 'Call ended', error: 'Unable to continue' };

export default function App() {
  return <SafeAreaProvider><CallScreen /></SafeAreaProvider>;
}

function CallScreen() {
  const historyReading=useRef(false);
  const session = useRef(new CallSession()).current;
  const [call, setCall] = useState(session.state);
  const [base, setBase] = useState(process.env.EXPO_PUBLIC_SIGNALING_URL || 'https://phoneapp.bawebtech.com');
  const [incomingAlerts] = useState(()=>new IncomingAlerts(nativeIncomingAlertDriver()));
  const [alertState,setAlertState]=useState(incomingAlerts.state);
  const [accounts] = useState(()=>new AccountClient(endpoint(base), { join: async (invite,id) => { await incomingAlerts.silence(); await session.join(base,'',AppState.currentState==='active',false,invite); }, end:()=>session.end(), phase:()=>session.state.phase,error:()=>session.state.error,setMuted:muted=>session.setMuted(muted) },nativeAccounts()));
  const [accountState,setAccountState]=useState(accounts.state);
  const [legacy,setLegacy]=useState(false);
  const [key, setKey] = useState('');
  const [code, setCode] = useState('');
  const [video, setVideo] = useState(true);
  const [relay, setRelay] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fill, setFill] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(true);
  const active = !['idle', 'ended', 'error'].includes(call.phase);
  useEffect(() => {
    const observeAlert=()=>incomingAlerts.observe({
      callId: !calling && accounts.state.account && !accounts.state.current ? accounts.state.dashboard?.calls.find(row=>row.canAnswer)?.id : undefined,
      updatedAt:accounts.state.updatedAt,foreground:AppState.currentState==='active',
      mediaActive:!['idle','ended','error'].includes(session.state.phase),busy:accounts.state.busy,
    });
    const alertSubscription=incomingAlerts.subscribe(setAlertState);
    const unsubscribe = session.subscribe(state=>{setCall(state);accounts.mediaChanged(state.phase);watchNativeMedia(accounts.state.current?.id,session.nativePeerId,state.phase==='connected');observeAlert();});
    const accountSubscription=accounts.subscribe(state=>{setAccountState(state);watchNativeMedia(state.current?.id,session.nativePeerId,session.state.phase==='connected');observeAlert();});
    void accounts.restore();
    const listener = AppState.addEventListener('change', (state) => {
      observeAlert();
      // iOS permission prompts briefly make the app inactive; only real backgrounding ends a call.
      if(state==='background'&&accounts.native&&accounts.state.current){if(session.state.cameraEnabled)session.toggleCamera();}
      if (state === 'background' && !(accounts.native&&accounts.state.current) && !['idle', 'ended', 'error'].includes(session.state.phase)) session.end('This experiment runs in the foreground. Return to the app and start a new call.');
    });
    return () => { unsubscribe(); accountSubscription(); alertSubscription(); incomingAlerts.dispose(); accounts.dispose(); listener.remove(); session.end(); };
  }, [session,accounts,incomingAlerts]);
  useEffect(() => { setSettingsOpen(false); }, [active]);
  useEffect(() => {
    if (!settingsOpen) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { Keyboard.dismiss(); setSettingsOpen(false); return true; });
    return () => back.remove();
  }, [settingsOpen]);
  useEffect(() => {
    if (!__DEV__ || Platform.OS !== 'ios') return;
    // Pinned Expo 57 iOS bridge; leave shake/three-finger preferences untouched.
    // Optional lookup keeps release/other binaries usable without this module.
    void (async () => {
      try {
        const preferences = requireOptionalNativeModule<{ setPreferencesAsync(value: { showFloatingActionButton: boolean }): Promise<void> }>('DevMenuPreferences');
        await preferences?.setPreferencesAsync({ showFloatingActionButton: false });
      } catch { /* Developer menu → Tools button off remains the manual fallback. */ }
    })();
  }, []);
  async function createRoom() {
    setCreating(true); setFormError('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const origin = endpoint(base);
      const response = await fetch(`${origin}/rooms`, { method: 'POST', headers: { Authorization: `Bearer ${key.trim()}` }, signal: controller.signal });
      const body = await response.json() as Invitation & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not create a room');
      if (AppState.currentState !== 'active') throw new Error('Return to the app before joining the call.');
      setCode(displayInvitation(body));
      // Share the invite first, then both testers tap Join. Share sheets may background the app.
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Could not reach the server'); }
    finally { clearTimeout(timeout); setCreating(false); }
  }
  const incomingCall=!active && !accountState.current ? accountState.dashboard?.calls.find(row=>row.canAnswer) : undefined;
  const incomingAction=(action:'answer'|'decline')=>{
    if(!incomingCall || accountState.busy)return;
    void incomingAlerts.silence().catch(()=>{});
    void accounts.act(incomingCall,action);
  };
  const duration = `${Math.floor(call.seconds / 60)}:${String(call.seconds % 60).padStart(2, '0')}`;
  const closeSettings = () => { Keyboard.dismiss(); setSettingsOpen(false); };
  return <HistoryOverlayProvider suppressed={settingsOpen||active||Boolean(incomingCall)} reading={historyReading}><SafeAreaView style={styles.page}>
    <StatusBar style="light" />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <View style={styles.page} accessibilityElementsHidden={settingsOpen} importantForAccessibility={settingsOpen ? 'no-hide-descendants' : 'auto'}>
        {active && <CallVideoStage
          remoteURL={call.remote?.toURL()}
          localURL={call.cameraEnabled && call.hasCamera ? call.local?.toURL() : undefined}
          muted={call.muted} cameraIntent={call.quality.cameraIntent}
          cameraDisabled={call.quality.audioOnly || call.quality.peerAudioOnly || call.quality.busy}
          audioOnly={call.quality.audioOnly || call.quality.peerAudioOnly}
          fill={fill} previewVisible={previewVisible} settingsOpen={settingsOpen}
          status={call.quality.status} duration={duration} phase={labels[call.phase]}
          audioOutput={call.audioOutput} speaker={() => session.toggleSpeaker()}
          settings={() => { Keyboard.dismiss(); setSettingsOpen(true); }}
          mute={() => {session.mute();const id=accounts.state.current?.id;if(id&&Platform.OS==='ios')void calling?.setMuted?.(id,session.state.muted);}} camera={() => session.toggleCamera()} hangup={() => accountState.current ? void accounts.hangup() : session.end()}
        />}<ScrollView style={active?{display:'none'}:undefined} onScroll={e=>{historyReading.current=e.nativeEvent.contentOffset.y>30;}} scrollEventThrottle={100} contentContainerStyle={[styles.content,accountState.account&&{paddingHorizontal:0}]} keyboardShouldPersistTaps="handled">
          <View style={[styles.row,accountState.account&&{paddingHorizontal:18}]}>
            <Text style={styles.title}>Phoneapp</Text>
            <Button title="⚙ Settings" accessibilityLabel="Open Phoneapp settings" onPress={() => { Keyboard.dismiss(); setSettingsOpen(true); }} />
          </View>
          <AccountPanel client={accounts} state={accountState} showIncoming={false} />
          {legacy && !accountState.account && <><Text style={styles.muted}>Manual POC calls · No recording</Text>
          <View style={styles.card}>
            <Text style={styles.label}>{labels[call.phase]}</Text>
            {call.seconds > 0 && <Text style={styles.muted}>Last connected time: {duration}</Text>}
            {!!call.error && <><Text style={styles.error} accessibilityRole="alert">{call.error}</Text><Button title="Open app settings" onPress={() => void Linking.openSettings()} /></>}
            <Text style={styles.label}>Create or join a call</Text>
            <Text style={styles.muted}>Create an invitation on one device, then join with the same code on both. Share before joining.</Text>
            {key.trim().length < 24 && <Button title="Add creator access key in Settings" onPress={() => setSettingsOpen(true)} />}
            <Button title={creating ? 'Creating…' : 'Create invitation'} disabled={creating || key.trim().length < 24} onPress={() => void createRoom()} color="#5ce1c2" />
            <Text style={styles.fieldLabel}>Room code</Text>
            <TextInput accessibilityLabel="Room code" style={[styles.input, styles.invite]} value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} placeholder="1234 5678" keyboardType="number-pad" placeholderTextColor="#81929d" multiline editable={!creating} />
            <Button title="Share room code" disabled={!code || creating} onPress={() => void Share.share({ message: code })} />
            {formError ? <Text style={styles.error} accessibilityRole="alert">{formError}</Text> : null}
            <Button title="Join call" disabled={!code || creating} onPress={() => { Keyboard.dismiss(); setFormError(''); void session.join(base, code, video, relay); }} color="#5ce1c2" />
          </View></>}
        </ScrollView>
      </View>
      {settingsOpen && <SettingsPanel close={closeSettings}>
        <View style={styles.card}>{calling ? <Text style={styles.muted}>Incoming call sound follows your phone’s call and notification settings.</Text> : <IncomingAlertControls state={alertState} change={preferences=>void incomingAlerts.setPreferences(preferences)} />}</View>
        {!active && <View style={styles.card}>
          <Text style={styles.label}>Test connection setup</Text>
          <View style={styles.row}><Text style={styles.text}>Show manual room testing</Text><Switch accessibilityLabel="Show manual room testing" value={legacy} onValueChange={setLegacy} disabled={Boolean(accountState.account)} /></View>
          <Text style={styles.muted}>Only the invitation creator needs the access key.</Text>
          <Text style={styles.fieldLabel}>Manual room signaling server</Text>
          <TextInput accessibilityLabel="Signaling server" style={styles.input} value={base} onChangeText={setBase} autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={!creating && !accountState.account} />
          <Text style={styles.fieldLabel}>Test access key</Text>
          <TextInput accessibilityLabel="Test access key" style={styles.input} value={key} onChangeText={setKey} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="Creator only" placeholderTextColor="#81929d" editable={!creating} />
          <View style={styles.row}><Text style={styles.text}>Send video when joining</Text><Switch accessibilityLabel="Send video when joining" value={video} onValueChange={setVideo} disabled={creating} /></View>
          <View style={styles.row}><Text style={styles.text}>Force TURN relay for testing</Text><Switch accessibilityLabel="Force TURN relay for testing" value={relay} onValueChange={setRelay} disabled={creating} /></View>
        </View>}
        <View style={styles.card}>
          <Text style={styles.label}>{labels[call.phase]}</Text>
          <Text style={styles.muted}>Connected time: {duration}</Text>
          {active && <Text style={styles.muted}>Room: {roomTimeLeft(call.expiresAt)}</Text>}
          {!!call.error && <Text style={styles.error} accessibilityRole="alert">{call.error}</Text>}
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Display and camera</Text>
          <View style={styles.row}><Text style={styles.text}>Fill screen</Text><Switch accessibilityLabel="Fill screen" value={fill} onValueChange={setFill} /></View>
          <Text style={styles.muted}>{fill ? 'Fills the display by cropping the edges.' : 'Shows the whole video without cropping.'}</Text>
          <View style={styles.row}><Text style={styles.text}>Show self preview</Text><Switch accessibilityLabel="Show self preview" value={previewVisible} onValueChange={setPreviewVisible} /></View>
          {active && <Button title="Switch camera" disabled={!call.hasCamera || !call.cameraEnabled} onPress={() => session.switchCamera()} />}
        </View>
        <View style={styles.card}><AudioOutputControls state={call.audioOutput} active={active} select={p => session.setAudioOutput(p)} /></View>
        <View style={styles.card}><QualityControls state={call.quality} active={active} select={p => session.setQuality(p)} limits={(send, receive) => session.setLimits(send, receive)} audioOnly={() => session.toggleAudioOnly()} /></View>
        {!!call.sessionId && <View style={styles.card}>
          <Text style={styles.label}>Connection details</Text>
          <Text selectable style={styles.mono}>Session: {call.sessionId}</Text>
          {call.diagnostics.map((line, index) => <Text key={`${index}-${line}`} selectable style={styles.mono}>{line}</Text>)}
          {active && <Button title="Refresh connection details" onPress={() => session.refreshDiagnostics()} />}
        </View>}
      </SettingsPanel>}
      <IncomingCallPrompt call={incomingCall} busy={accountState.busy} answer={()=>incomingAction('answer')} decline={()=>incomingAction('decline')} />
    </KeyboardAvoidingView>
  </SafeAreaView></HistoryOverlayProvider>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0b1620' }, content: { padding: 22, gap: 18, paddingBottom: 50 },
  title: { color: '#f0f6f7', fontSize: 32, fontWeight: '700' },
  muted: { color: '#a4b5c2', lineHeight: 21 }, text: { color: '#f0f6f7', flexShrink: 1 },
  card: { backgroundColor: '#142532', borderRadius: 18, padding: 18, gap: 12 }, label: { color: '#edf5f7', fontSize: 17, fontWeight: '600' },
  fieldLabel: { color: '#c7d5de', fontSize: 13 },
  input: { backgroundColor: '#0b1923', borderColor: '#354c5b', borderWidth: 1, color: '#fff', borderRadius: 10, padding: 12, minHeight: 46 },
  invite: { minHeight: 72, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  error: { color: '#ffabb2', lineHeight: 21 }, mono: { color: '#a4b5c2', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
