# 0006 Native speaker and phone audio output

Status: implementation prepared; native builds and physical acceptance pending. Updated: 2026-11-17. Requirements: COM-01, COM-07 in [PRD](../PRD.md).

## Outcome and scope

Add a visible call-screen speaker control and Settings choices for Automatic, Speaker, and Phone earpiece when available. Display the OS-reported current output independently of the requested preference. Automatic returns routing to the system, including connected Bluetooth/wired devices. This is foreground WebRTC audio routing, not CallKit/ConnectionService, background calls, recording, or a full Bluetooth device picker.

## Current evidence

Owner reports Android installation/calling is working well and asks how to use the loudspeaker. Existing binaries lack any speaker-routing module; react-native-webrtc 155 exposes audio-session activation but no output selector. A JS button alone cannot provide routing. New native development builds and physical tests are required.

Use a small local Expo module with Swift AVAudioSession and Kotlin AudioManager. Expo 57 automatically links local modules from `modules/`. Android 12+ uses available communication devices and set/clearCommunicationDevice; older versions have a guarded speakerphone fallback. Avoid importing a second media engine. Inspected react-native-incall-manager 4.3.0 but its Android implementation still uses deprecated speaker APIs; it is not added. No new npm/native third-party dependency is required.

## Implementation steps

- [x] Inspect installed/native and official API support.
- [x] Implement local native module, route observation, and cleanup.
- [x] Add serialized JS routing lifecycle with optional-module fallback for existing binaries.
- [x] Add call-screen Speaker and Settings output controls without changing mic mute.
- [x] Verify lifecycle/race/error tests, TypeScript, JS exports, native discovery, and generated configuration/archive inclusion.
- [x] Prepare reviewable code and document exact build/device steps.
- [ ] Obtain paid-build authorization and submit selected EAS development builds.
- [ ] Build/install and test Android/iPhone routes on physical devices.

## Data and configuration

No DB, backend, TURN, recording, or patient data. Local module is included in EAS source uploads. Android needs MODIFY_AUDIO_SETTINGS (normal permission), no Bluetooth scan/connect pairing UI or permission is added. iOS uses the existing WebRTC-owned audio session without taking ownership of activation. Native routing state is per call; no device names/addresses or persistent preference/secret storage.

## Acceptance and verification

| Scenario | Expected | Evidence |
| --- | --- | --- |
| Optional module absent | Old installed app keeps calling; route controls clearly unavailable | Unit test passes; physical old-binary smoke pending |
| Serialized lifecycle | Late start/selection/events cannot resurrect route state after hangup; cleanup precedes next call | Unit tests pass, including session-tagged stale events |
| Output selection | Speaker audible, Phone private when available, Automatic respects connected accessories | Device pending |
| Headset changes | Current output/options reflect OS changes; unavailable earpiece rejected honestly | Device pending |
| Repeated calls/errors | No stale speaker/mode override after hangup; errors do not end media | JS error/cleanup tests pass; actual native reset pending |
| Native discovery/build | Both platforms link module; native compilation succeeds | Both autolinking resolves and prebuild pass; source archive includes module; native compilation pending |

## Risks and recovery

OS route changes and WebRTC audio-session updates can override preferences; report actual output instead of claiming requested output succeeded. Native compilation and real audio are not established by TypeScript/prebuild. Tablet earpieces, legacy Android, wired/Bluetooth hotplug, and call interruptions require hardware. Existing installed binaries must keep working until rebuilt. Stage changes outside the live checkout while testers call; do not silently interrupt them. Revert native UI/integration between calls if needed; no backend rollback.

## Handoff

TypeScript, 50 unit/server cases, and iOS/Android JS exports pass in an isolated checkout. Expo Doctor passes 21/21. Applied after zero active rooms; the live-checkout EAS source archive contains matching native/config sources, excludes .env.server/server files, and has no backend restart. Prebuild with `--no-install` passes. Both platform autolinking resolves list PhoneappAudio's native class/pod; a local EAS archive inspection includes Kotlin/Swift/config files. No native SDK/compiler is configured here; these are not native compilation or audio tests. The browser and backend are unchanged, so public browser scenarios were not repeated as proof of native routing. Current original Android/iOS binaries do not contain this module. Next: authorize new EAS builds, install updates, and test Speaker/Phone/Automatic, accessory hotplug, audio-only/video transitions, permissions/errors, interruption and repeated hangup/rejoin on both devices. Obtain model/OS details when running acceptance. Keep M1 and physical acceptance gates open. No cloud build has been submitted for this increment.

References: [Expo local modules](https://docs.expo.dev/workflow/customizing/), [Android AudioManager](https://developer.android.com/reference/android/media/AudioManager), [Apple output override](https://developer.apple.com/documentation/avfaudio/avaudiosession/overrideoutputaudioport(_:)).
