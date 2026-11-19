# 0006 Native speaker and phone audio output

Status: implemented; both native builds passed; installation/physical acceptance pending. Updated: 2026-11-17. Requirements: COM-01, COM-07 in [PRD](../PRD.md).

## Outcome and scope

Owner clarified the language/use case: **Phone earpiece — private** versus **Speakerphone — share with the room**. Output selection is local to each participant; it never changes the other phone's output or microphone mute. Automatic/headset is a system-routing preference, not a promise of private output.

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
- [x] Obtain paid-build authorization and submit selected EAS development builds.
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
| Native discovery/build | Both platforms link module; native compilation succeeds | Both EAS development builds FINISHED with native compilation/linking; installation/actual audio pending |

## Risks and recovery

OS route changes and WebRTC audio-session updates can override preferences; report actual output instead of claiming requested output succeeded. Native compilation and real audio are not established by TypeScript/prebuild. Tablet earpieces, legacy Android, wired/Bluetooth hotplug, and call interruptions require hardware. Existing installed binaries must keep working until rebuilt. Stage changes outside the live checkout while testers call; do not silently interrupt them. Revert native UI/integration between calls if needed; no backend rollback.

## Handoff

Owner subsequently reports apparently selected Speaker/default Automatic with ineffective taps. At that point, EAS history contained only the two original binaries; the owner then authorized both updated builds, which have now finished successfully. Original apps have only updated JS and no native module, so controls are unavailable. Resolved the misleading default checkmark: unavailable controls show a setup/update message; active explicit-route checkmarks require OS route confirmation. Labels now clarify private earpiece and room speaker. Prepared UI changes separately during the active room, then applied after the owner confirmed hanging up. Owner now explicitly approved both builds. Do not diagnose the old-binary behavior as a failed native routing implementation or claim hardware acceptance.

TypeScript, 50 unit/server cases, and iOS/Android JS exports pass in an isolated checkout. Expo Doctor passes 21/21. Applied after zero active rooms; the live-checkout EAS source archive contains matching native/config sources, excludes .env.server/server files, and has no backend restart. Prebuild with `--no-install` passes. Both platform autolinking resolves list PhoneappAudio's native class/pod; a local EAS archive inspection includes Kotlin/Swift/config files. No native SDK/compiler is configured on EC2; native compilation/linking were subsequently verified by the two successful EAS builds, not these local checks. Actual listening remains unverified. The browser and backend are unchanged, so public browser scenarios were not repeated as proof of native routing. Current original Android/iOS binaries do not contain this module. Next: install the two approved, successful EAS builds and test Speaker/Phone/Automatic, accessory hotplug, audio-only/video transitions, permissions/errors, interruption and repeated hangup/rejoin on both devices. Obtain model/OS details when running acceptance. Keep M1 and physical acceptance gates open. Submitted development builds from commit 258902b: Android [879fa37b](https://expo.dev/accounts/mbcollins2/projects/phoneapp/builds/879fa37b-1746-4a83-baa2-55d666a7a3df), iOS [06b7c87f](https://expo.dev/accounts/mbcollins2/projects/phoneapp/builds/06b7c87f-3ba0-4ec6-8e6e-268555cf13d1). EAS reused existing remote credentials. Both iOS 06b7c87f and Android 879fa37b finished successfully. Android Gradle reports BUILD SUCCESSFUL; iOS packaged and linked PhoneappAudio. Latest display-only clarification passes TypeScript and both native JS exports and is live through Metro after the owner ended the call; native source is unchanged from the build submissions. Native success is not physical routing acceptance.

References: [Expo local modules](https://docs.expo.dev/workflow/customizing/), [Android AudioManager](https://developer.android.com/reference/android/media/AudioManager), [Apple output override](https://developer.apple.com/documentation/avfaudio/avaudiosession/overrideoutputaudioport(_:)).
