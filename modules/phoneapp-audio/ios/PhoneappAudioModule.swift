import AVFAudio
import ExpoModulesCore
import UIKit

public class PhoneappAudioModule: Module {
  private var active = false
  private var sessionID = 0
  private var preference = "automatic"
  private var observer: NSObjectProtocol?
  private var savedMode: AVAudioSession.Mode?
  private var savedOptions: AVAudioSession.CategoryOptions?

  public func definition() -> ModuleDefinition {
    Name("PhoneappAudio")
    Events("onRouteChanged")

    AsyncFunction("start") { (session: Int) -> [String: Any] in
      self.startRouting(session)
      return self.snapshot()
    }.runOnQueue(.main)

    AsyncFunction("setRoute") { (route: String) -> [String: Any] in
      guard self.active, self.choices().contains(route) else {
        throw NSError(domain: "PhoneappAudio", code: 1, userInfo: [NSLocalizedDescriptionKey: "Audio output is unavailable"])
      }
      let session = AVAudioSession.sharedInstance()
      switch route {
      case "speaker":
        try self.restoreCategory()
        try session.overrideOutputAudioPort(.speaker)
      case "earpiece":
        if self.savedMode == nil {
          self.savedMode = session.mode
          self.savedOptions = session.categoryOptions
        }
        try session.setCategory(.playAndRecord, mode: .voiceChat, options: session.categoryOptions.subtracting(.defaultToSpeaker))
        try session.overrideOutputAudioPort(.none)
      default:
        try session.overrideOutputAudioPort(.none)
        try self.restoreCategory()
      }
      self.preference = route
      return self.snapshot()
    }.runOnQueue(.main)

    AsyncFunction("stop") {
      self.stopRouting()
    }.runOnQueue(.main)

    OnDestroy {
      DispatchQueue.main.async { self.stopRouting() }
    }
  }

  private func startRouting(_ session: Int) {
    if active && sessionID == session { return }
    if active { stopRouting() }
    sessionID = session
    active = true
    preference = "automatic"
    // WebRTC owns activation and capture. Observe rather than activating a
    // second audio engine/session or changing its microphone mute state.
    observer = NotificationCenter.default.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] _ in
      guard let self, self.active else { return }
      self.sendEvent("onRouteChanged", self.snapshot())
    }
  }

  private func restoreCategory() throws {
    guard let mode = savedMode, let options = savedOptions else { return }
    let session = AVAudioSession.sharedInstance()
    // Restore only a category/mode still matching our earpiece override.
    if session.category == .playAndRecord && session.mode == .voiceChat {
      try session.setCategory(.playAndRecord, mode: mode, options: options)
    }
    savedMode = nil
    savedOptions = nil
  }

  private func stopRouting() {
    guard active else { return }
    active = false
    if let observer { NotificationCenter.default.removeObserver(observer) }
    observer = nil
    if preference != "automatic" { try? AVAudioSession.sharedInstance().overrideOutputAudioPort(.none) }
    try? restoreCategory()
    savedMode = nil
    savedOptions = nil
    preference = "automatic"
  }

  private func currentOutput() -> String {
    let types = AVAudioSession.sharedInstance().currentRoute.outputs.map { $0.portType }
    if types.contains(.builtInSpeaker) { return "speaker" }
    if types.contains(.builtInReceiver) { return "earpiece" }
    if types.contains(where: { [AVAudioSession.Port.bluetoothHFP, .bluetoothA2DP, .bluetoothLE].contains($0) }) { return "bluetooth" }
    if types.contains(where: { [AVAudioSession.Port.headphones, .usbAudio, .lineOut].contains($0) }) { return "headset" }
    return "unknown"
  }

  private func choices() -> [String] {
    var result = ["automatic", "speaker"]
    let output = currentOutput()
    let inputs = AVAudioSession.sharedInstance().availableInputs ?? []
    let externalInput = inputs.contains { [AVAudioSession.Port.headsetMic, .bluetoothHFP, .usbAudio].contains($0.portType) }
    if UIDevice.current.userInterfaceIdiom == .phone && !externalInput && !["headset", "bluetooth"].contains(output) {
      result.append("earpiece")
    }
    return result
  }

  private func snapshot() -> [String: Any] {
    ["session": sessionID, "active": active, "route": currentOutput(), "preference": preference, "choices": choices()]
  }
}
