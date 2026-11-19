# Phoneapp call audio output

Local Expo module for foreground call output selection. It adds no recording, second audio engine, persistent settings, device-name collection, Bluetooth pairing, background calls, or microphone mute behavior. Expo autolinks it from `modules/`; both development apps must be rebuilt to include it. Existing binaries use an optional-module fallback and continue calling without this control.

- `start(session)` observes routing after WebRTC connects. Android enters communication mode; iOS leaves audio-session activation with WebRTC.
- `setRoute("speaker" | "earpiece" | "automatic")` returns an OS route snapshot. Current output and requested preference are separate; OS selection can lag/change. Automatic releases explicit selection so the system can use connected accessories.
- `onRouteChanged` reports only the per-call session generation, active flag, generic output kind, preference, and available choices. It contains no hardware names/addresses or call/room credentials. JS rejects previous-call events.
- `stop()` removes observers and releases overrides with best-effort restoration of settings still owned by this module. JS serializes start/select/stop across calls; late results cannot restore ended-call UI.

Android 12+ uses communication-device APIs. Older Android uses speaker flags and restricts earpiece selection around external devices; those flags are weaker evidence than a communication-device snapshot. iOS speaker uses output override; Phone removes a default-speaker/video-chat preference only when earpiece selection is offered, restoring its captured category options/mode on Automatic/stop when still owned. Wired/Bluetooth output and interruptions need hardware acceptance. No sound or private-earpiece success is established merely by a returned snapshot.

See [plan 0006](../../docs/plans/0006-native-audio-output.md) for checks/build authorization/device acceptance and [setup](../../docs/SETUP.md) for installing development apps.
