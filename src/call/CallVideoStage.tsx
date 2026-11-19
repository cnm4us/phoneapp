import { Button, Pressable, StyleSheet, Text, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { audioOutputLabel, type AudioOutputState } from './audio-routing';

type Props = {
  remoteURL?: string; localURL?: string; muted: boolean;
  cameraIntent: boolean; cameraDisabled: boolean; audioOnly: boolean;
  fill: boolean; previewVisible: boolean; settingsOpen: boolean;
  status: string; duration: string; phase: string;
  audioOutput: AudioOutputState;
  settings(): void; mute(): void; camera(): void; hangup(): void; speaker(): void;
};

// Keep the renderer and its native parent mounted when settings opens. Overlay
// controls use no layout height, so video owns the available safe-area screen.
export function CallVideoStage(props: Props) {
  return <View style={styles.stage}>
    <RTCView accessibilityLabel="Remote video" streamURL={props.remoteURL} style={styles.video} objectFit={props.fill ? 'cover' : 'contain'} zOrder={0} />
    {(!props.remoteURL || props.audioOnly) && <View style={styles.placeholder} pointerEvents="none">
      <Text style={styles.text}>{props.audioOnly ? 'Audio-only call' : 'Waiting for the other participant…'}</Text>
    </View>}
    {props.localURL && <RTCView accessibilityLabel="Your camera preview" streamURL={props.localURL} style={[styles.preview, (!props.previewVisible || props.settingsOpen) && styles.hidden]} objectFit="cover" mirror zOrder={1} />}
    <View style={styles.header}>
      <View style={styles.callInfo}>
        <Text style={styles.text}>{props.phase} · {props.duration}</Text>
        <Text style={styles.detail} numberOfLines={2}>{props.status}</Text>
        {props.audioOutput.active && <Text style={styles.detail}>Audio: {audioOutputLabel(props.audioOutput.route)}</Text>}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open Phoneapp settings" accessibilityState={{ expanded: props.settingsOpen }} onPress={props.settings} style={styles.settings}>
        <Text style={styles.gear}>⚙</Text>
        <Text style={styles.detail}>Settings</Text>
      </Pressable>
    </View>
    <View style={styles.controls}>
      <Button title={props.muted ? 'Unmute' : 'Mute'} onPress={props.mute} />
      {props.audioOutput.active ? <Button title={props.audioOutput.route === 'speaker' ? 'Speaker on' : 'Speaker'} accessibilityLabel="Toggle speakerphone" accessibilityState={{ selected: props.audioOutput.route === 'speaker' }} disabled={props.audioOutput.busy || (props.audioOutput.route !== 'speaker' && !props.audioOutput.choices.includes('speaker'))} onPress={props.speaker} /> : !!props.audioOutput.error && <Button title="Audio setup" onPress={props.settings} />}
      <Button title={props.cameraIntent ? 'Camera off' : 'Camera on'} disabled={props.cameraDisabled} onPress={props.camera} />
      <Button title="Hang up" color="#ff8791" onPress={props.hangup} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: '#070e14', overflow: 'hidden' },
  video: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, hidden: { display: 'none' },
  preview: { position: 'absolute', right: 14, top: 100, width: 75, height: 100, backgroundColor: '#070e14', borderRadius: 8 },
  placeholder: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#070e14' },
  header: { position: 'absolute', top: 10, right: 10, left: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  callInfo: { flex: 1, backgroundColor: '#0b1620cc', padding: 10, borderRadius: 12 },
  settings: { minWidth: 64, minHeight: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1620e6', borderRadius: 12 },
  gear: { color: '#edf5f7', fontSize: 24 }, text: { color: '#edf5f7', lineHeight: 21 }, detail: { color: '#c7d5de', fontSize: 11, lineHeight: 16 },
  controls: { position: 'absolute', bottom: 12, left: 12, right: 12, backgroundColor: '#0b1620e6', borderRadius: 16, padding: 8, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around' },
});
