// Expo 57 recording/playback is foreground-only in Phoneapp. Never auto-resume after interruptions.
// Keep version/anchor guards: upgrading the module requires deliberate native-source review.
import {readFileSync,writeFileSync} from 'node:fs';
const root='node_modules/expo-audio/';
if(JSON.parse(readFileSync(root+'package.json','utf8')).version!=='57.0.5')throw new Error('Review Phoneapp audio interruption patch for the new module version.');
function patch(path,modify){let source=readFileSync(root+path,'utf8');if(source.includes('PHONEAPP_FOREGROUND_AUDIO'))return;const result=modify(source);if(result===source)throw new Error('Audio patch anchors changed');writeFileSync(root+path,result);}
function replace(s,a,b){if(!s.includes(a))throw new Error('Audio patch anchor changed');return s.replace(a,b);}
patch('ios/AudioModule.swift',s=>{
 s=replace(s,'  private func setupInterruptionHandling() {',`  // PHONEAPP_FOREGROUND_AUDIO
  @objc private func phoneappStopMessageAudio() {
    registry.allPlayables.forEach { $0.pause() }
    interruptedPlayers.removeAll()
    #if os(iOS)
    registry.allRecorders.values.forEach { recorder in
      recorder.stopRecording()
      recorder.allowsRecording = false
    }
    #endif
  }
  private func setupInterruptionHandling() {
    NotificationCenter.default.addObserver(self, selector: #selector(phoneappStopMessageAudio), name: Notification.Name("PhoneappCallAudioWillStart"), object: nil)`);
 s=s.replaceAll('recorder.pauseRecording()','recorder.stopRecording(); recorder.allowsRecording = false');
 s=replace(s,'        resumeInterruptedPlayers()','        interruptedPlayers.removeAll()');
 s=replace(s,'        resumeAllPlayers()','        // User explicitly restarts playback after returning foreground.');
 s=replace(s,'        resumeAllRecorders()','        // Recording always requires a new user action.');return s;
});
patch('android/src/main/java/expo/modules/audio/AudioModule.kt',s=>{
 s=replace(s,'class AudioModule : Module() {',`class AudioModule : Module() {
  // PHONEAPP_FOREGROUND_AUDIO
  private fun stopMessageAudio() {
    allPlayables.forEach { it.pause(); it.isPaused = false }
    recorders.values.forEach { if (it.isRecording || it.isPaused) it.stopRecording() }
  }
  private val phoneappCallReceiver = object : android.content.BroadcastReceiver() {
    override fun onReceive(c: Context?, intent: android.content.Intent?) { stopMessageAudio() }
  }`);
 s=replace(s,'    OnCreate {',`    OnCreate {
      ContextCompat.registerReceiver(context, phoneappCallReceiver, IntentFilter("com.bawebtech.phoneapp.CALL_AUDIO"), ContextCompat.RECEIVER_NOT_EXPORTED)`);
 s=replace(s,'    OnDestroy {','    OnDestroy {\n      context.unregisterReceiver(phoneappCallReceiver)');
 s=replace(s,'      when (focusChange) {','      if (focusChange < 0) stopMessageAudio()\n      when (focusChange) {');
 s=s.replaceAll('recorder.pauseRecording()','recorder.stopRecording()');
 s=replace(s,'            recorder.record()','            // No automatic recording restart.');
 return s;
});
console.log('Applied pinned foreground-only message audio interruption patch.');

// Also suppress the Android foreground player's automatic resume after a background pause.
{const path=root+'android/src/main/java/expo/modules/audio/AudioModule.kt';let s=readFileSync(path,'utf8');const anchor='            playable.isPaused = false\n            playable.play()';if(s.includes(anchor))writeFileSync(path,s.replace(anchor,'            playable.isPaused = false\n            // Phoneapp requires explicit playback after returning foreground.'));}
