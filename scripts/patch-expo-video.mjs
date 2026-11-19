// Pinned native hooks release message capture/playback before OS calling owns audio/camera.
import {readFileSync,writeFileSync} from 'node:fs';
for(const [pkg,version] of [['expo-camera','57.0.6'],['expo-video','57.0.5']])if(JSON.parse(readFileSync(`node_modules/${pkg}/package.json`,'utf8')).version!==version)throw new Error('Review Phoneapp video interruption patch after dependency upgrade.');
function patch(path,fn){let text=readFileSync(path,'utf8');if(text.includes('PHONEAPP_MESSAGE_VIDEO'))return;const edit=(a,b)=>{if(!text.includes(a))throw new Error('Video patch anchor changed: '+path);text=text.replace(a,b);};fn(edit);writeFileSync(path,text);}
patch('node_modules/expo-camera/ios/Current/CameraView.swift',edit=>{
 edit('  public func onAppForegrounded() {',`  // PHONEAPP_MESSAGE_VIDEO
  @objc private func phoneappStopMessageVideo() {
    stopRecording()
    sessionQueue.async { [weak self] in
      guard let self else { return }
      self.isSessionPaused = false
      self.session.stopRunning()
    }
  }
  public func onAppForegrounded() {`);
 edit('    lifecycleManager?.register(self)',`    NotificationCenter.default.addObserver(self, selector: #selector(phoneappStopMessageVideo), name: Notification.Name("PhoneappCallAudioWillStart"), object: nil)
    lifecycleManager?.register(self)`);
 edit('  public func onAppBackgrounded() {\n', '  public func onAppBackgrounded() {\n    phoneappStopMessageVideo()\n');
 edit('        isSessionPaused = true', '        isSessionPaused = false // New camera mount requires explicit user action.');
 edit('  deinit {','  deinit {\n    NotificationCenter.default.removeObserver(self, name: Notification.Name("PhoneappCallAudioWillStart"), object: nil)');
});
patch('node_modules/expo-camera/android/src/main/java/expo/modules/camera/ExpoCameraView.kt',edit=>{
 edit('  private var isRecording = false',`  // PHONEAPP_MESSAGE_VIDEO
  private val phoneappCallReceiver = object : android.content.BroadcastReceiver() {
    override fun onReceive(c: android.content.Context?, intent: android.content.Intent?) { stopRecording(); pausePreview() }
  }
  private var isRecording = false`);
 edit('  init {','  init {\n    androidx.core.content.ContextCompat.registerReceiver(context, phoneappCallReceiver, android.content.IntentFilter("com.bawebtech.phoneapp.CALL_AUDIO"), androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED)');
 edit('  fun cleanupCamera() {','  fun cleanupCamera() {\n    runCatching { context.unregisterReceiver(phoneappCallReceiver) }');
});
patch('node_modules/expo-video/ios/VideoManager.swift',edit=>{
 edit('  private init() {',`  // PHONEAPP_MESSAGE_VIDEO
  private var phoneappCallObserver: NSObjectProtocol?
  private init() {
    phoneappCallObserver = NotificationCenter.default.addObserver(forName: Notification.Name("PhoneappCallAudioWillStart"), object: nil, queue: .main) { [weak self] _ in
      guard let self else { return }
      Self.managerQueue.async {
        let players = self.videoPlayers.allObjects
        DispatchQueue.main.async { for player in players { player.ref.pause() } }
      }
    }`);
 edit('  deinit {', '  deinit {\n    if let phoneappCallObserver { NotificationCenter.default.removeObserver(phoneappCallObserver) }');
});
patch('node_modules/expo-video/android/src/main/java/expo/modules/video/managers/VideoManager.kt',edit=>{
 edit('  fun onAppForegrounded() {',`  // PHONEAPP_MESSAGE_VIDEO
  fun phoneappPauseMessages() { for (player in videoPlayersToVideoViews.keys) { player.player.pause() } }
  fun onAppForegrounded() {`);
});
patch('node_modules/expo-video/android/src/main/java/expo/modules/video/VideoModule.kt',edit=>{
 edit('class VideoModule : Module() {',`class VideoModule : Module() {
  // PHONEAPP_MESSAGE_VIDEO
  private val phoneappCallReceiver = object : android.content.BroadcastReceiver() {
    override fun onReceive(c: android.content.Context?, intent: android.content.Intent?) { VideoManager.phoneappPauseMessages() }
  }`);
 edit('    OnCreate {','    OnCreate {\n      appContext.reactContext?.let { androidx.core.content.ContextCompat.registerReceiver(it, phoneappCallReceiver, android.content.IntentFilter("com.bawebtech.phoneapp.CALL_AUDIO"), androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED) }');
 edit('    OnDestroy {','    OnDestroy {\n      appContext.reactContext?.let { runCatching { it.unregisterReceiver(phoneappCallReceiver) } }');
});
console.log('Applied pinned Phoneapp video call-interruption hooks.');
// CameraX's activity lifecycle may otherwise reopen the preview after returning foreground.
{
 const path='node_modules/expo-camera/android/src/main/java/expo/modules/camera/ExpoCameraView.kt';let text=readFileSync(path,'utf8');
 if(!text.includes('PHONEAPP_CAMERA_LIFECYCLE')){
  const anchor='  private var isRecording = false';if(!text.includes(anchor))throw new Error('Camera lifecycle patch anchor changed');text=text.replace(anchor,`  // PHONEAPP_CAMERA_LIFECYCLE
  private val phoneappLifecycleObserver = object : androidx.lifecycle.DefaultLifecycleObserver {
    override fun onStop(owner: androidx.lifecycle.LifecycleOwner) { stopRecording(); pausePreview() }
  }
  private var isRecording = false`);
  text=text.replace('  init {','  init {\n    (appContext.currentActivity as? androidx.lifecycle.LifecycleOwner)?.lifecycle?.addObserver(phoneappLifecycleObserver)');
  text=text.replace('  fun cleanupCamera() {','  fun cleanupCamera() {\n    (appContext.currentActivity as? androidx.lifecycle.LifecycleOwner)?.lifecycle?.removeObserver(phoneappLifecycleObserver)');writeFileSync(path,text);
 }
}
