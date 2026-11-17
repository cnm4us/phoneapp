# 0004 Native call audio output

Date: 2026-11-17. Status: implementation prepared; native build/device validation pending.

Use a small local Expo module for output routing, with a serial JS controller owned by CallSession. The WebRTC audio track remains the sole microphone/media owner. Start route observation on connected media and release it on cleanup; do not conflate speaker output with microphone mute or audio-only video suppression.

Android 12+ selects available communication devices with AudioManager and clears its request on Automatic/cleanup. Legacy speakerphone flags are a fallback, not a modern route guarantee. iOS uses AVAudioSession output overrides and narrowly scoped earpiece category/mode changes while leaving activation with WebRTC. Observe system route changes, report current output independently of preference, and tag events by call generation to reject stale data.

Expose Speaker on the call overlay and Automatic/Speaker/Phone choices under Settings. Offer Phone only when native code considers it available; Automatic leaves accessory routing to the OS. A full Bluetooth device picker and native incoming/background call integration are separate features.

Existing binaries probe the module optionally and keep calling without routing controls. New Swift/Kotlin requires rebuilt EAS development apps. No additional native/npm provider package or backend/DB change. Inspected react-native-incall-manager 4.3.0; chose the local module because that package's current Android source still relies on deprecated speakerphone APIs and brings unrelated call/sensor behavior.

References: [Expo local modules](https://docs.expo.dev/workflow/customizing/), [Android AudioManager](https://developer.android.com/reference/android/media/AudioManager), [Apple AVAudioSession](https://developer.apple.com/documentation/avfaudio/avaudiosession). Evidence and remaining gates: [plan 0006](../plans/0006-native-audio-output.md).
