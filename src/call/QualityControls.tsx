import { useState } from 'react';
import { Button, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
      <Text style={styles.text}>Resolution ceiling · {state[direction].height}p selected</Text>
      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={`${direction === 'send' ? 'Outgoing' : 'Incoming'} resolution ceiling`}>{(['minimum', 'saver', 'standard', 'hd', 'high', 'ultra'] as const).map(p => <Choice key={p} label={`${PRESETS[p].height}p`} selected={state[direction].height === PRESETS[p].height && state[direction].width === PRESETS[p].width} disabled={p === 'ultra' && !state.ultraAvailable} onPress={() => {
        const value = { ...state[direction], width: PRESETS[p].width, height: PRESETS[p].height };
        limits(direction === 'send' ? value : state.send, direction === 'receive' ? value : state.receive);
      }} />)}</View>
      <Text style={styles.text}>Frame-rate ceiling · {state[direction].fps} fps selected</Text>
      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={`${direction === 'send' ? 'Outgoing' : 'Incoming'} frame-rate ceiling`}>{[15, 24, 30, 60].map(fps => <Choice key={fps} label={`${fps} fps`} selected={state[direction].fps === fps} onPress={() => {
        const value = { ...state[direction], fps };
        limits(direction === 'send' ? value : state.send, direction === 'receive' ? value : state.receive);
      }} />)}</View>
      <Text style={styles.text}>Selections apply immediately. Actual video may run below these ceilings.</Text>
      <Bitrate key={`${direction}-${state[direction].bitrate}`} value={state[direction].bitrate} label={`${direction} bitrate Mbps`} commit={bitrate => {
        const value = { ...state[direction], bitrate };
        limits(direction === 'send' ? value : state.send, direction === 'receive' ? value : state.receive);
      }} />
    </View>)}</>}
  </View>;
}
function Choice({ label, selected, disabled = false, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress(): void }) {
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, disabled && styles.choiceDisabled, pressed && styles.choicePressed]}>
    <Text style={[styles.choiceText, selected && styles.choiceSelectedText]}>{selected ? '✓ ' : ''}{label}</Text>
  </Pressable>;
}
function Bitrate({ value, label, commit }: { value: number; label: string; commit(v: number): void }) {
  const [text, setText] = useState(String(value / 1_000_000));
  return <><Text style={styles.text}>Video bitrate ceiling · Mbps</Text><TextInput accessibilityLabel={label} style={styles.input} value={text} onChangeText={setText} keyboardType="decimal-pad" /><Button title="Apply bitrate" onPress={() => commit(Number(text) * 1_000_000)} /></>;
}
const styles = StyleSheet.create({
  box: { gap: 10 }, title: { color: '#edf5f7', fontSize: 17, fontWeight: '600' }, text: { color: '#a4b5c2', lineHeight: 21 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, error: { color: '#ffabb2' },
  choice: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#81929d', borderRadius: 10, justifyContent: 'center' },
  choiceSelected: { backgroundColor: '#5ce1c2', borderColor: '#5ce1c2' }, choiceText: { color: '#edf5f7', fontSize: 15 },
  choiceSelectedText: { color: '#0b1620', fontWeight: '700' }, choiceDisabled: { opacity: 0.35 }, choicePressed: { opacity: 0.75 },
  input: { color: '#fff', borderColor: '#354c5b', borderWidth: 1, borderRadius: 8, padding: 10 },
});
