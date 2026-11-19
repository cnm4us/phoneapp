package com.bawebtech.phoneapp.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator

@Suppress("DEPRECATION")
class IncomingAlertPlayer(private val context: Context) {
  private val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
  private val preferences = context.getSharedPreferences("phoneapp_incoming", Context.MODE_PRIVATE)
  private val handler = Handler(Looper.getMainLooper())
  private val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
  private var callID: String? = null
  private var interruptedID: String? = null
  private var player: MediaPlayer? = null
  private var focusRequest: AudioFocusRequest? = null
  private var legacyFocus = false
  private var deadline = 0L
  private var nextVibration = 0L
  private var ringerMode = AudioManager.RINGER_MODE_NORMAL
  private var sound = false
  private var vibration = false
  private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
    if (change < 0) { interruptedID = callID; stop() }
  }
  private val pulse = object : Runnable {
    override fun run() {
      if (callID == null || SystemClock.elapsedRealtime() >= deadline) { stop(); return }
      val now = SystemClock.elapsedRealtime()
      if (vibration && now >= nextVibration && audio.ringerMode != AudioManager.RINGER_MODE_SILENT && vibrator.hasVibrator()) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) vibrator.vibrate(VibrationEffect.createOneShot(300, VibrationEffect.DEFAULT_AMPLITUDE), attributes)
        else vibrator.vibrate(300, attributes)
        nextVibration = now + 2400
      }
      handler.postDelayed(this, 200)
    }
  }

  fun preferences(): Map<String, Boolean> = mapOf("sound" to preferences.getBoolean("sound", true), "vibration" to preferences.getBoolean("vibration", true))
  fun save(sound: Boolean, vibration: Boolean) { preferences.edit().putBoolean("sound", sound).putBoolean("vibration", vibration).apply() }

  fun ring(id: String, sound: Boolean, vibration: Boolean, leaseMs: Double) {
    if (id.isEmpty() || id.length > 100 || !leaseMs.isFinite() || leaseMs <= 0 || leaseMs > 6000 || interruptedID == id) return
    val expires = SystemClock.elapsedRealtime() + leaseMs.toLong()
    if (callID == id && this.sound == sound && this.vibration == vibration && ringerMode == audio.ringerMode) { deadline = expires; return }
    stop()
    if (!sound && !vibration) return
    callID = id
    this.sound = sound
    this.vibration = vibration
    ringerMode = audio.ringerMode
    deadline = expires
    nextVibration = 0
    try {
      if (sound && audio.ringerMode == AudioManager.RINGER_MODE_NORMAL && requestFocus()) {
        val media = MediaPlayer()
        player = media
        media.setAudioAttributes(attributes)
        val resource = context.resources.openRawResourceFd(R.raw.phoneapp_incoming) ?: error("Incoming ringtone resource is unavailable")
        resource.use { descriptor ->
          media.setDataSource(descriptor.fileDescriptor, descriptor.startOffset, descriptor.length)
        }
        media.isLooping = true
        media.prepare()
        media.start()
      }
      handler.post(pulse)
    } catch (error: Exception) { stop(); throw error }
  }

  private fun requestFocus(): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(attributes).setOnAudioFocusChangeListener(focusListener, handler).build()
      focusRequest = request
      return audio.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }
    legacyFocus = true
    return audio.requestAudioFocus(focusListener, AudioManager.STREAM_RING, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
  }

  fun silence(id: String) { if (callID == id) stop() }
  fun stop() {
    handler.removeCallbacks(pulse)
    player?.release()
    player = null
    if (callID != null) vibrator.cancel()
    callID = null
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) focusRequest?.let { audio.abandonAudioFocusRequest(it) }
    else if (legacyFocus) audio.abandonAudioFocus(focusListener)
    focusRequest = null
    legacyFocus = false
  }
}
