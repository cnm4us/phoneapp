import { StyleSheet, Switch, Text, View } from 'react-native';
import type { AlertPreferences, IncomingAlertState } from './incoming-alert';

export function IncomingAlertControls({ state, change }: { state: IncomingAlertState; change(value: AlertPreferences): void }) {
  return <View style={styles.group}>
    <Text style={styles.heading}>Incoming calls</Text>
    {!state.available ? <Text style={styles.note}>Install the updated Phoneapp build to enable ringtone and vibration. Visual incoming calls still work.</Text> : <>
      <View style={styles.row}><Text style={styles.label}>Ringtone</Text><Switch accessibilityLabel="Incoming ringtone" value={state.preferences.sound} disabled={!state.ready || state.saving} onValueChange={sound => change({ ...state.preferences, sound })} /></View>
      <View style={styles.row}><Text style={styles.label}>Vibration</Text><Switch accessibilityLabel="Incoming vibration" value={state.preferences.vibration} disabled={!state.ready || state.saving} onValueChange={vibration => change({ ...state.preferences, vibration })} /></View>
      <Text style={styles.note}>Saved on this device. Uses the phone’s sound, silent and haptic settings. Keep Phoneapp open to receive calls.</Text>
    </>}
    {!!state.error && <Text style={styles.error} accessibilityRole="alert">{state.error}</Text>}
  </View>;
}
const styles = StyleSheet.create({ group: { gap: 12 }, heading: { color: '#edf5f7', fontSize: 17, fontWeight: '600' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, label: { color: '#f0f6f7', flexShrink: 1 }, note: { color: '#a4b5c2', lineHeight: 21 }, error: { color: '#ffabb2', lineHeight: 21 } });
