# 0005 Native call screen and settings panel

Status: implemented; native device acceptance pending. Updated: 2026-11-17. Requirements: COM-01, COM-07, COM-09 in [PRD](../PRD.md).

## Outcome and scope

Give native calls the available screen by default, with a Phoneapp settings button in the upper right. Open quality/display controls and connection diagnostics in a dismissible panel; keep mute, camera, and hangup available on the video. Prepare space for future messaging without implementing it. Hide the separate Expo floating Tools button on the current iPhone development build while retaining shake/three-finger developer access.

## Current evidence

The cogwheel is Expo's development Tools button, not app UI. Installed expo-dev-menu 57.0.21 has iOS `DevMenuPreferences.setPreferencesAsync({showFloatingActionButton:false})`; its Swift setter updates the button immediately and leaves gestures unchanged. This is a version-specific optional native-module bridge, not the newer SDK's public JS API. Probe availability and tolerate failure. Android in this pinned version does not expose that preference bridge; retain its developer controls and document manual hiding where available. No dependency upgrade or paid build is needed for the iOS bridge attempt.

Native full-screen/Fill currently works, using one stable RTCView after earlier duplicate-renderer black screens. Preserve its stream and native parent while opening settings; use an in-window panel, not another video renderer or native Modal. Existing session effect cleanup ends calls during source refresh, so prepare in an isolated checkout and apply after the test call ends. The browser companion is unchanged.

## Implementation steps

- [x] Inspect native layout and pinned Expo code; distinguish Tools from app settings.
- [x] Add a persistent full-height call stage with compact overlay controls/settings access.
- [x] Move quality, display, setup configuration, and diagnostics into a closeable scrollable panel; preserve invite creation/join and errors.
- [x] Hide only the iOS Expo floating Tools button through the guarded existing bridge.
- [x] Verify TypeScript/native JS exports, review renderer/session lifetime, and run documentation checks.
- [x] Apply after no active room, update continuity, and request owner-operated device acceptance.

## Data and configuration

No DB, backend, browser, provider, dependency, EAS profile, or native configuration changes. iOS development preference `showFloatingActionButton` is stored by Expo in app UserDefaults; shake/touch preferences are not changed. Release builds skip the bridge. All Phoneapp settings remain in call-screen memory, as before; no secret persistence added.

## Acceptance and verification

| Scenario | Procedure | Expected | Actual |
| --- | --- | --- | --- |
| Build | `npm run typecheck`; `npm run bundle:check` | Compile without a new native dependency | Both pass in isolated checkout; exports are not native builds/device tests |
| Full-height call | Join native call, including Fill | Video uses available height with overlay controls | Physical pending |
| Settings and media | Repeatedly open/close panel and change quality/Fill | Same remote renderer; ongoing audio/video/timer; no hangup | Physical pending |
| Navigation/accessibility | Close button/backdrop/Android back; readable labels | Panel dismisses; background controls hidden from accessibility | Physical pending |
| Developer Tools | Reload iPhone app; shake/three-finger gesture | Floating Expo button hidden; developer menu still reachable | Physical pending |
| Invitation/errors | Idle create/share/join and denied permissions | Room inputs remain usable; recovery messages visible | Physical pending |

## Risks and recovery

The pinned iOS preference bridge is optional and may differ in another binary; failure must not prevent startup or calls. Manual fallback: developer menu → Tools button off. Android overlay ordering, small-screen keyboard layout, VoiceOver focus, and native media continuity require devices. Revert the UI commit and reload between calls if needed; do not remount video to fix panel issues.

## Handoff

Code review confirms settings state changes no stream/sender/session owner and does not conditionally mount the remote RTCView. Only the self preview is visually hidden beneath the panel to avoid Android overlay stacking; its track is not stopped. Quality, display fit, and camera controls retain their existing media actions. Main invitation flow retains errors/share/join; creator key/server/relay/start-camera options move into Settings before joining. Opening settings or Android back/Done dismissals must still be exercised on hardware.

Implementation and compilation checks pass. Applied the reviewed patch after sanitized signaling history showed zero active rooms; Metro `/status` returned `packager-status:running`. No backend restart or paid build. Runtime media modules, protocol, browser/server, and dependencies are unchanged, so their prior unit/browser suites were not rerun as new native-UI evidence. No native UI/device runner is configured. Next: owner reloads the development app and tests new settings, Fill, ongoing media/clock, Expo button suppression/gestures, and pre-call key/invitation flow. Keep original M1, sustained-call, and Ultra gates open. Apply status and next device action are recorded in [current state](../PROJECT_STATE.md) and [work log](../WORK_LOG.md).
