import { Button, StyleSheet, Text, View } from 'react-native';
import { AUDIO_PREFERENCES, audioOutputLabel, type AudioOutputState, type AudioPreference } from './audio-routing';

export function AudioOutputControls({ state, active, select }: { state: AudioOutputState; active: boolean; select(value: AudioPreference): void }) {
  const labels = { automatic: 'Automatic / headset', speaker: 'Speaker', earpiece: 'Phone earpiece' };
  return <View style={styles.box}>
    <Text style={styles.title}>Audio output</Text>
    <Text style={styles.text}>Current output: {audioOutputLabel(state.route)}</Text>
    <View style={styles.options}>{AUDIO_PREFERENCES.map(p =>
      <Button key={p} title={`${state.preference === p ? '✓ ' : ''}${labels[p]}`} disabled={!state.active || state.busy || !state.choices.includes(p)} onPress={() => select(p)} />)}</View>
    <Text style={styles.text}>Automatic lets the phone choose its output, including connected headsets. Speaker plays the other participant aloud. This does not mute your microphone.</Text>
    {!active && <Text style={styles.text}>Connect a call to change its audio output.</Text>}
    {state.busy && <Text style={styles.text}>Updating audio output…</Text>}
    {!!state.error && <Text style={styles.error} accessibilityRole="alert">{state.error}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  box: { gap: 10 }, title: { color: '#edf5f7', fontSize: 17, fontWeight: '600' },
  text: { color: '#a4b5c2', lineHeight: 21 }, error: { color: '#ffabb2', lineHeight: 21 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
