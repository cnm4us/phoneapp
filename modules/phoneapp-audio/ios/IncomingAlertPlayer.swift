import AVFAudio
import AudioToolbox
import UIKit

// Foreground-only owner. Never shares activation/route ownership with WebRTC.
final class IncomingAlertPlayer {
  private var callID: String?
  private var sound = false
  private var vibration = false
  private var deadline: TimeInterval = 0
  private var nextVibration: TimeInterval = 0
  private var player: AVAudioPlayer?
  private var timer: Timer?
  private var interruption: NSObjectProtocol?
  private var interruptedID: String?
  private var savedAudio: (AVAudioSession.Category, AVAudioSession.Mode, AVAudioSession.CategoryOptions)?
  private let defaults = UserDefaults.standard

  func preferences() -> [String: Bool] {
    ["sound": defaults.object(forKey: "phoneapp.incoming.sound") as? Bool ?? true,
     "vibration": defaults.object(forKey: "phoneapp.incoming.vibration") as? Bool ?? true]
  }

  func save(sound: Bool, vibration: Bool) {
    defaults.set(sound, forKey: "phoneapp.incoming.sound")
    defaults.set(vibration, forKey: "phoneapp.incoming.vibration")
  }

  func ring(_ id: String, sound: Bool, vibration: Bool, leaseMs: Double) throws {
    guard UIApplication.shared.applicationState == .active,
          leaseMs.isFinite, leaseMs > 0, leaseMs <= 6000,
          !id.isEmpty, id.count <= 100, interruptedID != id else { return }
    let now = ProcessInfo.processInfo.systemUptime
    if callID == id && self.sound == sound && self.vibration == vibration {
      deadline = now + leaseMs / 1000
      return
    }
    stop()
    guard sound || vibration else { return }
    callID = id
    self.sound = sound
    self.vibration = vibration
    deadline = now + leaseMs / 1000
    nextVibration = now
    do {
      if sound {
        let bundles = [Bundle.main, Bundle(for: PhoneappAudioModule.self)]
        guard let bundleURL = bundles.compactMap({ $0.url(forResource: "PhoneappAudioResources", withExtension: "bundle") }).first,
              let bundle = Bundle(url: bundleURL),
              let url = bundle.url(forResource: "incoming", withExtension: "wav") else {
          throw NSError(domain: "PhoneappAudio", code: 2, userInfo: [NSLocalizedDescriptionKey: "Incoming ringtone resource is unavailable"])
        }
        let session = AVAudioSession.sharedInstance()
        savedAudio = (session.category, session.mode, session.categoryOptions)
        try session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        try session.setActive(true)
        let audio = try AVAudioPlayer(contentsOf: url)
        player = audio
        audio.numberOfLoops = -1
        audio.volume = 1
        audio.prepareToPlay()
        guard audio.play() else {
          throw NSError(domain: "PhoneappAudio", code: 3, userInfo: [NSLocalizedDescriptionKey: "Incoming ringtone could not start"])
        }
      }
      interruption = NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] notification in
        guard let self,
              let type = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              type == AVAudioSession.InterruptionType.began.rawValue else { return }
        self.interruptedID = self.callID
        self.stop()
      }
      let tick = Timer(timeInterval: 0.2, repeats: true) { [weak self] _ in self?.pulse() }
      timer = tick
      RunLoop.main.add(tick, forMode: .common)
      pulse()
    } catch {
      stop()
      throw error
    }
  }

  func silence(_ id: String) {
    if callID == id { stop() }
  }

  func stop() {
    timer?.invalidate()
    timer = nil
    player?.stop()
    player = nil
    if let interruption { NotificationCenter.default.removeObserver(interruption) }
    interruption = nil
    if let savedAudio {
      let session = AVAudioSession.sharedInstance()
      // Restore only the session configuration owned by the alert.
      if session.category == .ambient && session.mode == .default {
        try? session.setActive(false, options: [.notifyOthersOnDeactivation])
        try? session.setCategory(savedAudio.0, mode: savedAudio.1, options: savedAudio.2)
      }
    }
    savedAudio = nil
    callID = nil
    sound = false
    vibration = false
  }

  private func pulse() {
    let now = ProcessInfo.processInfo.systemUptime
    guard callID != nil, now < deadline, UIApplication.shared.applicationState == .active else { stop(); return }
    if vibration && now >= nextVibration {
      AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
      nextVibration = now + 2.4
    }
  }
}
