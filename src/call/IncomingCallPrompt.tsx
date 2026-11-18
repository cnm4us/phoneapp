import { Button, Modal, StyleSheet, Text, View } from 'react-native';
import type { CallRecord } from '../../shared/accounts';

export function IncomingCallPrompt({ call, busy, answer, decline }: { call?: CallRecord; busy: boolean; answer(): void; decline(): void }) {
  return <Modal visible={Boolean(call)} transparent animationType="fade" onRequestClose={decline}>
    <View style={styles.backdrop}>
      <View style={styles.card} accessibilityViewIsModal>
        <Text style={styles.title} accessibilityRole="header">Incoming app call</Text>
        <Text style={styles.name}>{call?.callerName}</Text>
        <Text style={styles.note}>{busy ? 'Updating call…' : 'Audio/video call · Recording off'}</Text>
        <Button title="Answer with audio/video" disabled={busy} onPress={answer} />
        <Button title="Decline" disabled={busy} onPress={decline} />
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', backgroundColor: '#000b', padding: 24 },
  card: { backgroundColor: '#142532', padding: 24, borderRadius: 20, gap: 16 },
  title: { color: '#edf5f7', fontSize: 24, fontWeight: '700' },
  name: { color: '#f0f6f7', fontSize: 20 }, note: { color: '#a4b5c2', lineHeight: 21 },
});
