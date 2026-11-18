package com.bawebtech.phoneapp.audio

import android.content.Context
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PhoneappAudioModule : Module() {
  private var incoming: IncomingAlertPlayer? = null
  private var foreground = true
  private var manager: AudioManager? = null
  private var active = false
  private var sessionID = 0
  private var preference = "automatic"
  private var originalMode = AudioManager.MODE_NORMAL
  private var originalSpeaker = false
  private val handler = Handler(Looper.getMainLooper())
  private var communicationListener: Any? = null
  private val devices = object : AudioDeviceCallback() {
    override fun onAudioDevicesAdded(added: Array<AudioDeviceInfo>) = publish()
    override fun onAudioDevicesRemoved(removed: Array<AudioDeviceInfo>) = publish()
  }

  override fun definition() = ModuleDefinition {
    Name("PhoneappAudio")
    Events("onRouteChanged")
    Constant("incomingAlertVersion") { 1 }
    AsyncFunction("getAlertPreferences") { incomingPlayer().preferences() }.runOnQueue(Queues.MAIN)
    AsyncFunction("setAlertPreferences") { sound: Boolean, vibration: Boolean -> incomingPlayer().save(sound, vibration) }.runOnQueue(Queues.MAIN)
    AsyncFunction("ring") { id: String, sound: Boolean, vibration: Boolean, leaseMs: Double ->
      if (!active && foreground) incomingPlayer().ring(id, sound, vibration, leaseMs)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("silence") { id: String -> incoming?.silence(id) }.runOnQueue(Queues.MAIN)
    OnActivityEntersForeground { foreground = true }
    OnActivityEntersBackground { foreground = false; handler.post { incoming?.stop() } }
    OnActivityDestroys { foreground = false; handler.post { incoming?.stop() } }

    AsyncFunction("start") { session: Int ->
      startRouting(session)
      snapshot()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setRoute") { route: String ->
      val audio = audioManager()
      check(active && choices().contains(route)) { "Audio output is unavailable" }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        if (route == "automatic") {
          audio.clearCommunicationDevice()
        } else {
          val type = if (route == "speaker") AudioDeviceInfo.TYPE_BUILTIN_SPEAKER else AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
          val device = audio.availableCommunicationDevices.firstOrNull { it.type == type }
          check(device != null && audio.setCommunicationDevice(device)) { "Audio output selection was rejected" }
        }
      } else {
        @Suppress("DEPRECATION")
        audio.isSpeakerphoneOn = if (route == "automatic") originalSpeaker else route == "speaker"
      }
      preference = route
      snapshot()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stop") { stopRouting() }.runOnQueue(Queues.MAIN)
    OnDestroy { handler.post { incoming?.stop(); stopRouting() } }
  }

  private fun incomingPlayer(): IncomingAlertPlayer {
    if (incoming == null) incoming = IncomingAlertPlayer(appContext.reactContext ?: error("Audio context is unavailable"))
    return incoming!!
  }

  private fun audioManager(): AudioManager {
    if (manager == null) {
      val context = appContext.reactContext ?: error("Audio context is unavailable")
      manager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }
    return manager!!
  }

  @Suppress("DEPRECATION")
  private fun startRouting(session: Int) {
    incoming?.stop()
    if (active && sessionID == session) return
    if (active) stopRouting()
    sessionID = session
    val audio = audioManager()
    originalMode = audio.mode
    originalSpeaker = audio.isSpeakerphoneOn
    audio.mode = AudioManager.MODE_IN_COMMUNICATION
    active = true
    preference = "automatic"
    audio.registerAudioDeviceCallback(devices, handler)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val listener = AudioManager.OnCommunicationDeviceChangedListener { publish() }
      communicationListener = listener
      audio.addOnCommunicationDeviceChangedListener({ task -> handler.post(task) }, listener)
    }
  }

  @Suppress("DEPRECATION")
  private fun stopRouting() {
    if (!active) return
    active = false
    val audio = manager ?: return
    runCatching { audio.unregisterAudioDeviceCallback(devices) }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      runCatching { (communicationListener as? AudioManager.OnCommunicationDeviceChangedListener)?.let { audio.removeOnCommunicationDeviceChangedListener(it) } }
      communicationListener = null
      if (preference != "automatic") runCatching { audio.clearCommunicationDevice() }
    } else {
      runCatching { audio.isSpeakerphoneOn = originalSpeaker }
    }
    runCatching { if (audio.mode == AudioManager.MODE_IN_COMMUNICATION) audio.mode = originalMode }
    preference = "automatic"
  }

  private fun choices(): List<String> {
    val audio = audioManager()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val types = audio.availableCommunicationDevices.map { it.type }
      return listOf("automatic") + listOfNotNull(
        "speaker".takeIf { types.contains(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) },
        "earpiece".takeIf { types.contains(AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) }
      )
    }
    val types = audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).map { it.type }
    val external = types.any { it in listOf(AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_BLUETOOTH_SCO, AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, AudioDeviceInfo.TYPE_USB_HEADSET, AudioDeviceInfo.TYPE_USB_DEVICE) }
    return listOf("automatic", "speaker") + listOfNotNull("earpiece".takeIf { !external && types.contains(AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) })
  }

  private fun kind(type: Int?): String = when (type) {
    AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "speaker"
    AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "earpiece"
    AudioDeviceInfo.TYPE_BLUETOOTH_SCO, AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, AudioDeviceInfo.TYPE_BLE_HEADSET, AudioDeviceInfo.TYPE_BLE_SPEAKER -> "bluetooth"
    AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_USB_HEADSET, AudioDeviceInfo.TYPE_USB_DEVICE -> "headset"
    else -> "unknown"
  }

  @Suppress("DEPRECATION")
  private fun snapshot(): Map<String, Any> {
    val audio = audioManager()
    val route = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      kind(audio.communicationDevice?.type)
    } else if (audio.isBluetoothScoOn) {
      "bluetooth"
    } else if (audio.isSpeakerphoneOn) {
      "speaker"
    } else if (audio.isWiredHeadsetOn) {
      "headset"
    } else {
      "earpiece".takeIf { choices().contains("earpiece") } ?: "unknown"
    }
    return mapOf("session" to sessionID, "active" to active, "route" to route, "preference" to preference, "choices" to choices())
  }

  private fun publish() {
    if (active) sendEvent("onRouteChanged", snapshot())
  }
}
