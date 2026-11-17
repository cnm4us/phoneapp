import { useState } from 'react';
import { Button, Keyboard, StyleSheet, Text, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';

type Props = {
  remoteURL?: string; localURL?: string; expanded: boolean; muted: boolean;
  cameraIntent: boolean; cameraDisabled: boolean; audioOnly: boolean;
  status: string; roomTime: string;
  toggleExpanded(): void; mute(): void; camera(): void; switchCamera(): void; audio(): void; hangup(): void;
};

// Keep the same native renderer, stream and parent hierarchy while resizing.
// The owner reported black video on the two-renderer native Modal path.
// This presentation keeps one renderer in the existing native window.
export function CallVideoStage(props: Props) {
  const [fill, setFill] = useState(false);
  return <View style={[styles.stage, props.expanded && styles.expanded]} accessibilityViewIsModal={props.expanded}>
    <View style={props.expanded ? styles.expandedFrame : styles.compactFrame}>
      <RTCView accessibilityLabel="Remote video" streamURL={props.remoteURL} style={styles.video} objectFit={props.expanded && fill ? 'cover' : 'contain'} zOrder={0} />
      {(!props.remoteURL || props.audioOnly) && <View style={styles.placeholder} pointerEvents="none">
        <Text style={styles.text}>{props.audioOnly ? 'Audio-only call' : 'Waiting for the other participant…'}</Text>
      </View>}
      {props.localURL && <RTCView accessibilityLabel="Your camera preview" streamURL={props.localURL} style={styles.preview} objectFit="cover" mirror zOrder={1} />}
    </View>
    <View style={styles.controls}>
      <Text style={styles.text} numberOfLines={2}>{props.status}</Text>
      <Text style={styles.time}>Room: {props.roomTime}</Text>
      <View style={styles.row}>
        <Button title={props.expanded ? 'Exit full screen' : 'Full screen'} onPress={() => { Keyboard.dismiss(); props.toggleExpanded(); }} />
        <Button title={props.muted ? 'Unmute' : 'Mute'} onPress={props.mute} />
        <Button title={props.cameraIntent ? 'Camera off' : 'Camera on'} disabled={props.cameraDisabled} onPress={props.camera} />
        <Button title="Switch camera" disabled={!props.localURL} onPress={props.switchCamera} />
        <Button title="Hang up" color="#ff8791" onPress={props.hangup} />
      </View>
      {props.expanded && <>
        <View style={styles.row}>
          <Button title={fill ? 'Show whole video' : 'Fill screen'} onPress={() => setFill(value => !value)} />
          <Button title={props.audioOnly ? 'Audio-only mode is active' : 'Audio only'} disabled={props.audioOnly} onPress={props.audio} />
        </View>
        {fill && <Text style={styles.time}>Fills the display by cropping the edges.</Text>}
      </>}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  stage: { backgroundColor: '#070e14', flexShrink: 0 }, expanded: { flex: 1, flexShrink: 1 },
  compactFrame: { height: 230, width: '100%', overflow: 'hidden' }, expandedFrame: { flex: 1, minHeight: 0, width: '100%', overflow: 'hidden' },
  video: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  preview: { position: 'absolute', right: 12, bottom: 12, width: 75, height: 100, backgroundColor: '#070e14' },
  placeholder: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#070e14' },
  controls: { padding: 10, gap: 5 }, text: { color: '#c7d5de', lineHeight: 19 }, time: { color: '#a4b5c2', fontSize: 11 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around' },
});
