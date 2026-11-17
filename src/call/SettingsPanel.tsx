import type { ReactNode } from 'react';
import { Button, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export function SettingsPanel({ children, close }: { children: ReactNode; close(): void }) {
  return <View style={styles.overlay}>
    <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close Phoneapp settings" accessibilityRole="button" />
    <View style={styles.panel} accessibilityViewIsModal>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">Phoneapp settings</Text>
        <Button title="Done" accessibilityLabel="Close Phoneapp settings" onPress={close} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {children}
      </ScrollView>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#0008', alignItems: 'flex-end' },
  panel: { flex: 1, width: '100%', maxWidth: 460, backgroundColor: '#0b1620' },
  header: { paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomColor: '#354c5b', borderBottomWidth: 1 },
  title: { color: '#edf5f7', fontSize: 20, fontWeight: '600', flexShrink: 1 },
  content: { padding: 18, paddingBottom: 40, gap: 18 },
});
