import { Button, StyleSheet, Text, View } from 'react-native';
import { AUDIO_PREFERENCES, audioOutputLabel, type AudioOutputState, type AudioPreference } from './audio-routing';

export function AudioOutputControls({ state, active, select }: { state: AudioOutputState; active: boolean; select(value: AudioPreference): void }) {
  const labels = { automatic: 'Automatic / headset', speaker: 'Speakerphone · Room', earpiece: 'Phone earpiece · Private' };
  const ready = state.available && state.active;
  return <View style={styles.box}>
    <Text style={styles.title}>Audio output</Text>
    {ready ? <>
      <Text style={styles.text}>Current output: {audioOutputLabel(state.route)}</Text>
      <View style={styles.options}>{AUDIO_PREFERENCES.map(p =>
        <Button key={p} title={`${state.preference === p && (p === 'automatic' || state.route === p) ? '✓ ' : ''}${labels[p]}`} disabled={state.busy || !state.choices.includes(p)} onPress={() => select(p)} />)}</View>
      {state.preference !== 'automatic' && state.route !== state.preference && <Text style={styles.text}>Requested: {labels[state.preference]}. The current output above has not confirmed that selection.</Text>}
    </> : <Text style={styles.text}>{state.error || (active ? 'Audio output controls become available after the call connects.' : 'Connect a call to select its audio output.')}</Text>}
    <Text style={styles.text}>Phone earpiece is for holding the phone to your ear. Speakerphone lets others in your room hear. Automatic lets the phone choose, including connected headsets. Each phone chooses independently; microphone mute is separate.</Text>
    {state.busy && <Text style={styles.text}>Updating audio output…</Text>}
    {ready && !!state.error && <Text style={styles.error} accessibilityRole="alert">{state.error}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  box: { gap: 10 }, title: { color: '#edf5f7', fontSize: 17, fontWeight: '600' },
  text: { color: '#a4b5c2', lineHeight: 21 }, error: { color: '#ffabb2', lineHeight: 21 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
