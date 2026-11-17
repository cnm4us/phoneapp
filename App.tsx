import { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Button, KeyboardAvoidingView, Linking, Platform, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CallSession } from './src/call/session';
import { endpoint, displayInvitation, roomTimeLeft } from './src/call/core';
import type { Invitation } from './shared/protocol';
import { QualityControls } from './src/call/QualityControls';
import { CallVideoStage } from './src/call/CallVideoStage';

const labels = { idle: 'Ready to test', permissions: 'Requesting microphone / camera', joining: 'Joining room…', waiting: 'Waiting for the other phone…', connecting: 'Connecting media…', connected: 'Connected', reconnecting: 'Connection interrupted…', ended: 'Call ended', error: 'Unable to continue' };

export default function App() {
  return <SafeAreaProvider><CallScreen /></SafeAreaProvider>;
}

function CallScreen() {
  const session = useRef(new CallSession()).current;
  const [call, setCall] = useState(session.state);
  const [base, setBase] = useState(process.env.EXPO_PUBLIC_SIGNALING_URL || 'https://phoneapp.bawebtech.com');
  const [key, setKey] = useState('');
  const [code, setCode] = useState('');
  const [video, setVideo] = useState(true);
  const [relay, setRelay] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [fullScreen, setFullScreen] = useState(false);
  const active = !['idle', 'ended', 'error'].includes(call.phase);
  useEffect(() => {
    const unsubscribe = session.subscribe(setCall);
    const listener = AppState.addEventListener('change', (state) => {
      // iOS permission prompts briefly make the app inactive; only real backgrounding ends a call.
      if (state === 'background' && !['idle', 'ended', 'error'].includes(session.state.phase)) session.end('This experiment runs in the foreground. Return to the app and start a new room.');
    });
    return () => { unsubscribe(); listener.remove(); session.end(); };
  }, [session]);
  useEffect(() => { if (!active) setFullScreen(false); }, [active]);
  useEffect(() => {
    if (!fullScreen) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { setFullScreen(false); return true; });
    return () => back.remove();
  }, [fullScreen]);
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
  const duration = `${Math.floor(call.seconds / 60)}:${String(call.seconds % 60).padStart(2, '0')}`;
  return <SafeAreaView style={styles.page}>
    <StatusBar style="light" />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      {active && <CallVideoStage
        remoteURL={call.remote?.toURL()}
        localURL={call.cameraEnabled && call.hasCamera ? call.local?.toURL() : undefined}
        expanded={fullScreen} muted={call.muted} cameraIntent={call.quality.cameraIntent}
        cameraDisabled={call.quality.audioOnly || call.quality.peerAudioOnly || call.quality.busy}
        audioOnly={call.quality.audioOnly || call.quality.peerAudioOnly}
        status={call.quality.status} roomTime={roomTimeLeft(call.expiresAt)}
        toggleExpanded={() => setFullScreen(value => !value)} mute={() => session.mute()}
        camera={() => session.toggleCamera()} switchCamera={() => session.switchCamera()} audio={() => session.toggleAudioOnly()}
        hangup={() => { setFullScreen(false); session.end(); }}
      />}
      <ScrollView style={fullScreen ? styles.hidden : undefined} pointerEvents={fullScreen ? 'none' : 'auto'} accessibilityElementsHidden={fullScreen} importantForAccessibility={fullScreen ? 'no-hide-descendants' : 'auto'} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>PHONEAPP · EXPERIMENT 01</Text>
        <Text style={styles.title}>A call between{ '\n' }your two phones.</Text>
        <Text style={styles.muted}>Foreground audio and video. Test conversations only. No recording.</Text>
        <View style={styles.card}>
          <Text style={styles.label}>{labels[call.phase]}</Text>
          <Text style={styles.clock}>{duration}</Text>
          <Text style={styles.muted}>Connected time · experiment only</Text>
          {call.error && <Text style={styles.error} accessibilityRole="alert">{call.error}</Text>}
          {!!call.error && <Button title="Open app settings" onPress={() => void Linking.openSettings()} />}
        </View>
        {!active && <View style={styles.card}>
          <Text style={styles.label}>1. Create an invitation on one phone</Text>
          <Text style={styles.muted}>Both phones use the same server. Only the creator needs the test access key.</Text>
          <Text style={styles.fieldLabel}>Signaling server</Text>
          <TextInput accessibilityLabel="Signaling server" style={styles.input} value={base} onChangeText={setBase} autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={!creating} />
          <Text style={styles.fieldLabel}>Test access key</Text>
          <TextInput accessibilityLabel="Test access key" style={styles.input} value={key} onChangeText={setKey} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="Creator only" placeholderTextColor="#81929d" editable={!creating} />
          <Button title={creating ? 'Creating…' : 'Create invitation'} disabled={creating || key.trim().length < 24} onPress={() => void createRoom()} color="#5ce1c2" />
          <Text style={styles.label}>2. Share, then join on both phones</Text>
          <Text style={styles.muted}>Share before joining. Keep both apps open during the call.</Text>
          <TextInput accessibilityLabel="Room code" style={[styles.input, styles.invite]} value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} placeholder="1234 5678" keyboardType="number-pad" placeholderTextColor="#81929d" multiline editable={!creating} />
          <Button title="Share room code" disabled={!code || creating} onPress={() => void Share.share({ message: code })} />
          <View style={styles.row}><Text style={styles.text}>Send video</Text><Switch value={video} onValueChange={setVideo} disabled={creating} /></View>
          <View style={styles.row}><Text style={styles.text}>Force TURN relay for testing</Text><Switch value={relay} onValueChange={setRelay} disabled={creating} /></View>
          {formError ? <Text style={styles.error} accessibilityRole="alert">{formError}</Text> : null}
          <Button title="Join call" disabled={!code || creating} onPress={() => { setFormError(''); void session.join(base, code, video, relay); }} color="#5ce1c2" />
        </View>}
        <View style={styles.card}><QualityControls state={call.quality} active={active} select={p => session.setQuality(p)} limits={(send, receive) => session.setLimits(send, receive)} audioOnly={() => session.toggleAudioOnly()} /></View>
        {call.sessionId && <View style={styles.card}>
          <Text style={styles.label}>Connection details</Text>
          <Text selectable style={styles.mono}>Session: {call.sessionId}</Text>
          {call.diagnostics.map((line, index) => <Text key={`${index}-${line}`} style={styles.mono}>{line}</Text>)}
          {active && <Button title="Refresh connection details" onPress={() => session.refreshDiagnostics()} />}
        </View>}
      </ScrollView>

    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0b1620' }, hidden: { height: 0, flex: 0, opacity: 0 }, content: { padding: 22, gap: 18, paddingBottom: 50 },
  eyebrow: { color: '#5ce1c2', fontSize: 12, letterSpacing: 2, fontWeight: '700' }, title: { color: '#f0f6f7', fontSize: 34, lineHeight: 39, fontWeight: '700' },
  muted: { color: '#a4b5c2', lineHeight: 21 }, text: { color: '#f0f6f7', flexShrink: 1 },
  card: { backgroundColor: '#142532', borderRadius: 18, padding: 18, gap: 12 }, label: { color: '#edf5f7', fontSize: 17, fontWeight: '600' },
  clock: { color: '#5ce1c2', fontSize: 48, fontVariant: ['tabular-nums'] }, fieldLabel: { color: '#c7d5de', fontSize: 13 },
  input: { backgroundColor: '#0b1923', borderColor: '#354c5b', borderWidth: 1, color: '#fff', borderRadius: 10, padding: 12, minHeight: 46 },
  invite: { minHeight: 72, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  error: { color: '#ffabb2', lineHeight: 21 }, mono: { color: '#a4b5c2', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
