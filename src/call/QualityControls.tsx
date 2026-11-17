import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { PRESETS, type Preset, type VideoLimit } from './quality';
import type { QualityState } from './media-quality';
import { describeAudio } from './stats';

type Props = { state: QualityState; active: boolean; select(preset: Preset): void; limits(send: VideoLimit, receive: VideoLimit): void; audioOnly(): void };
export function QualityControls({ state, active, select, limits, audioOnly }: Props) {
  const [advanced, setAdvanced] = useState(false);
  return <View style={styles.box}>
    <Text style={styles.title}>Call quality</Text>
    <Text style={styles.text}>Ceilings adapt downward as needed. Audio comes first.</Text>
    <View style={styles.options}>{(Object.keys(PRESETS) as Preset[]).map(preset =>
      <Button key={preset} title={`${!state.custom && state.preset === preset ? '✓ ' : ''}${PRESETS[preset].label}`} disabled={preset === 'ultra' && !state.ultraAvailable} onPress={() => select(preset)} />)}</View>
    {state.custom && <Text style={styles.text}>Custom send / receive limits</Text>}
    <Button title={state.audioOnly ? 'Leave audio-only mode' : 'Audio only · both directions'} onPress={audioOnly} />
    <Text style={styles.text} accessibilityLiveRegion="polite">{state.status}</Text>
    {state.peerAudioOnly && <Text style={styles.text}>The other participant requests audio only. Both must leave this mode before video resumes.</Text>}
    {!state.ultraAvailable && <Text style={styles.text}>4K is experimental and stays unavailable until device and server support is verified.</Text>}
    <Text style={styles.text}>Sending ceiling: {state.sendDescription}</Text>
    <Text style={styles.text}>Incoming ceiling: {state.receiveDescription}</Text>
    {active && <><Text style={styles.text}>Actual sent: {state.sent}</Text><Text style={styles.text}>Actual received: {state.received}</Text><Text style={styles.text}>Incoming audio: {describeAudio(state.stats?.incomingAudio)}</Text><Text style={styles.text}>Outgoing audio: {describeAudio(state.stats?.outgoingAudio)}</Text></>}
    {!!state.error && <Text style={styles.error} accessibilityRole="alert">{state.error}</Text>}
    <Button title={advanced ? 'Hide advanced controls' : 'Advanced · separate send / receive limits'} onPress={() => setAdvanced(!advanced)} />
    {advanced && <>{(['send', 'receive'] as const).map(direction => <View key={direction} style={styles.box}>
      <Text style={styles.title}>{direction === 'send' ? 'Outgoing' : 'Incoming'} limits</Text>
      <Text style={styles.text}>Resolution</Text>
      <View style={styles.options}>{(['minimum', 'saver', 'standard', 'hd', 'high', 'ultra'] as const).map(p => <Button key={p} title={`${PRESETS[p].height}p`} disabled={p === 'ultra' && !state.ultraAvailable} onPress={() => {
        const value = { ...state[direction], width: PRESETS[p].width, height: PRESETS[p].height };
        limits(direction === 'send' ? value : state.send, direction === 'receive' ? value : state.receive);
      }} />)}</View>
      <Text style={styles.text}>Frame-rate ceiling</Text>
      <View style={styles.options}>{[15, 24, 30, 60].map(fps => <Button key={fps} title={`${fps} fps`} onPress={() => {
        const value = { ...state[direction], fps };
        limits(direction === 'send' ? value : state.send, direction === 'receive' ? value : state.receive);
      }} />)}</View>
      <Bitrate key={`${direction}-${state[direction].bitrate}`} value={state[direction].bitrate} label={`${direction} bitrate Mbps`} commit={bitrate => {
        const value = { ...state[direction], bitrate };
        limits(direction === 'send' ? value : state.send, direction === 'receive' ? value : state.receive);
      }} />
    </View>)}</>}
  </View>;
}
function Bitrate({ value, label, commit }: { value: number; label: string; commit(v: number): void }) {
  const [text, setText] = useState(String(value / 1_000_000));
  return <><Text style={styles.text}>Video bitrate ceiling · Mbps</Text><TextInput accessibilityLabel={label} style={styles.input} value={text} onChangeText={setText} keyboardType="decimal-pad" /><Button title="Apply bitrate" onPress={() => commit(Number(text) * 1_000_000)} /></>;
}
const styles = StyleSheet.create({
  box: { gap: 10 }, title: { color: '#edf5f7', fontSize: 17, fontWeight: '600' }, text: { color: '#a4b5c2', lineHeight: 21 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, error: { color: '#ffabb2' },
  input: { color: '#fff', borderColor: '#354c5b', borderWidth: 1, borderRadius: 8, padding: 10 },
});
