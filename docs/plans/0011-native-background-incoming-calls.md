# 0011 Native incoming calls while backgrounded or not running

Status: implemented/source and development backend deployed; final builds, physical iPhone signing and handset acceptance in progress. Updated: 2026-11-18.

## Outcome and scope

After owner-reported foreground ringtone success, owner asks what is next for background/non-running delivery, excluding explicit force-quit. Implement the native incoming-call gate of [0007](0007-provider-patient-calls-transcripts.md), building on 0008–0010. Supports PAT-04, TEAM-02, COM-05–06, COM-10–11, REP-03 and OPS-01–02.

Target synthetic flow: enrolled Provider selects Patient A → backend creates the durable call → enrolled patient phone receives native incoming UI/ringing while another app is open, locked, or normally not running → Answer connects WebRTC audio and the app can show video when foreground → cancellation/end/missed status reconciles into both call histories. No manual room codes or repeated enrollment after an ordinary app restart. Test iPhone first end-to-end, then Android with the same backend/device contract; do not treat success on one platform as acceptance of the other.

Initial reboot baseline: phone has been unlocked once since restart, is online, and enrollment/device delivery permission remains valid. Android Settings Force stop and manufacturer restrictions are documented separately; reboot does not clear explicit stopped state. Pre-first-unlock/Direct Boot, guaranteed delivery, force-stop bypass, browser ringing, PSTN/Twilio, recording/transcripts, billing and clinical deployment are outside this increment. A normal push banner alone does not satisfy native incoming-call acceptance.

## Current evidence and gaps

- Foreground native/browser WebRTC, authenticated directory/call history and native ringtone are implemented; both 0010 EAS builds compiled. Owner reports foreground ringtone works. Current native account credential is memory-only and expires after 12 hours; reloading requires another enrollment code.
- `devices` has stable installation/owner/platform/app fields and encrypted token/hash placeholders, but no registration API, push SDK, token encryption key/service or populated device enrollment flow.
- `call_runtime` owns calls by caller/answering **session ID**. Session replacement during cold-start restoration must not make a valid answering device lose media ownership or allow a second device to steal a call.
- Foreground discovery polls every two seconds; AppState background deliberately ends calls, local alerts deliberately stop, and call presence relies on JS reports/timers. Those behaviors must be replaced selectively for native-managed account calls, preserving legacy POC behavior.
- Current native audio routing directly manages AVAudioSession/Android AudioManager. CallKit/Telecom must become the appropriate native lifecycle/audio owner when used; no competing route/session managers.
- EAS signing/profiles exist. Key-name-only inspection found no APNs/PushKit/FCM/Firebase configuration in `.env.server`, `.env.database`, or process environment. Root `google-services.json` / `GoogleService-Info.plist` are absent. This does not establish whether Apple/EAS or the owner already has reusable remote credentials/projects; verify before creating duplicates. No push credential values were read or printed.

## Architecture to implement

### A. Secure resumable device enrollment

Retain existing synthetic account issuance for the POC. Add a native-accessible credential vault: iOS Keychain (`AfterFirstUnlockThisDeviceOnly`) and Android Keystore-backed encryption, with no user-presence/biometric requirement on each background read. Store only the device-bound credential/bootstrap metadata needed for authenticated restoration, never plaintext AsyncStorage, build variables or push payloads. Native launch handlers must access this before React/JS is ready; choose a common native vault interface rather than assuming a JS-only storage module can serve PushKit/FCM cold start.

Introduce revocable device enrollment/refresh credentials and short-lived access sessions with rotation/reuse protection. Confirm exact lifetimes in implementation; do not extend a temporary account session indefinitely without a device revocation model. Native restore must be atomic across concurrent foreground/background requests. Logout, account disable, reassignment, credential loss and uninstall/reinstall invalidate old bindings as appropriate. iOS Keychain can survive uninstall in some circumstances: absence of this installation's local marker must not silently restore a prior installation/account. Exclude device secrets from cross-device backup/migration; require re-enrollment after loss/restore where needed.

Shift native first-answer/media ownership to an authenticated **device binding**, while retaining transient session ownership for browser/legacy paths. A validated refresh from the same winning device may resume authorized control; another enrolled device cannot. Never trust a client-provided installation/device ID without its bound credential. Keep user/patient/device/provider-token identities separate.

### B. Authenticated device registration and delivery

Add register/update/revoke endpoints scoped to the authenticated installation. Native token callbacks register APNs VoIP or FCM tokens with app ID/environment and encrypted-at-rest token material plus lookup hash. APNs VoIP tokens are not Expo/ordinary APNs tokens. Rotate bindings safely, reject revoked registrations and handle provider-invalid-token responses without exposing token values.

Create transactional delivery/outbox records alongside logical call creation, using unique call/device/event identifiers and short expiry. A worker sends bounded retries only while the same call is still ringing. Never retry an expired call into a new session. Push success means provider acceptance, not ringing/answer/media proof. Payload carries minimal call ID/expiry/opaque routing data; authenticate the later request for patient/caller details, media and actions. No patient names, clinical text, room/media credentials or login/refresh tokens in push payloads.

Use existing Phoneapp backend for direct APNs VoIP and FCM sending. Dev token encryption key/provider secrets belong in mode-600 backend configuration or an appropriate secret store, never Git/mobile bundles. Version token encryption format/key ID for later rotation; production key management is a separate readiness decision.

### C. iPhone native incoming lifecycle

Add native early-launch PushKit registration and a single CallKit provider/coordinator through Expo-compatible AppDelegate integration/config plugin. A valid incoming VoIP push must promptly report the call to CallKit in the native callback, without waiting for Metro, React initialization, JS polling, or a network round trip. Then reconcile authenticated server state, expiring/ending unavailable calls honestly. No VoIP pushes for generic reminders or unrelated background work.

Keep an idempotent native call-ID/action queue until bundled JS/WebRTC is ready. Answer, decline, caller cancel, no answer, duplicate/late push, expired enrollment and first-answer-wins must agree with server state. After the first VoIP push, use the live authenticated call connection for cancellation/state changes; do not design repeated VoIP cancel/update pushes as a generic background channel. If native answer cannot establish valid media in time, end the system call with a clear failure rather than leaving it ringing/connecting forever.

Coordinate CallKit audio activation/deactivation with the installed WebRTC SDK. Native-managed calls replace the foreground AppState hangup behavior and continue audio appropriately; camera/video remains consented and foreground-only initially. Keep the ordinary manual POC foreground cleanup. Suppress the 0010 player while CallKit owns ringing to avoid duplicate sound/audio-session ownership. Verify custom CallKit ringtone placement/format; do not assume a nested pod resource works as a system provider ringtone without testing.

### D. Android native incoming lifecycle

Add FCM token/receive handling that can run without a mounted React screen. Register native calls through Core-Telecom/Telecom, call-style Answer/Decline notifications and the required phone-call service/permissions for supported Android versions. Check notification/full-screen intent policy and user grants; provide a useful supported notification/permission-recovery path when full-screen UI is unavailable. Do not promise full-screen presentation under every OS state.

Use the same durable call/action IDs and native pending-action queue as iOS. Native service restores the device credential, validates call state and starts the permitted answered-call lifecycle. Route audio through Telecom endpoint APIs while it owns the call, not the old direct AudioManager path. Stop the 0010 foreground alert when system calling owns presentation; respect ringtone/channel/vibration/DND and audio focus. Token rotation, logout, process death, late/canceled delivery, offline recovery and no-answer must be observable.

### E. Media, history and background liveness

Native system Answer is not evidence of media connectivity. Replace JS-timer-dependent call liveness with validated native lifecycle/transport observations; adapt the backend's existing stale-media timeout so a healthy background call is not failed just because UI/JS timers pause. Preserve raw source events, idempotency and integer-second aggregation without double counting participants. Where media observations are unavailable, pause/mark duration uncertain; do not invent connected seconds from push receipt, OS answer, a generic heartbeat or audio-session activation.

Preserve shared history/revoked-patient isolation and current quality/output controls. Explicitly test native/WebRTC audio ownership and reconnection/teardown; do not simply remove AppState guards or heartbeat safeguards. Scope this rollout to synthetic account calls behind capability flags; keep legacy/manual calling usable until native acceptance is complete.

## Implementation steps and order

- [x] Inspect actual state, credential-key availability and primary native platform requirements; identify session/device/audio/JS-lifecycle gaps.
- [x] Implement native credential vault, resumable device enrollment, auth/session-device model and logout/revocation tests; keep UI/browser behavior compatible.
- [x] Review/add the next migration(s), runtime grants, synthetic fixtures and encrypted-token format; clean-install and data-preserving upgrade/recovery evidence first.
- [x] Implement authorized device registration and durable short-expiry call-delivery outbox with fake-provider isolation/idempotency tests.
- [ ] Verify/provision Apple APNs capability/key/topic/environment and Firebase Android configuration/sender credentials using existing accounts/projects where available. No secret upload to chat/Git or unverified credential reuse.
- [ ] Implement iOS PushKit/CallKit early-launch/answer/cancel and WebRTC audio coordination; verify foreground regression and native build before device delivery testing.
- [ ] Prove iPhone background/locked/non-running → ring/Answer/audio/hangup/history against real APNs with synthetic calls. Fix lifecycle issues before calling the iOS gate complete.
- [ ] Implement Android FCM/Telecom/service/notification/audio ownership with the same backend contracts; prove its own physical-device matrix.
- [ ] Build internal **preview** binaries with bundled JS for cold-start acceptance; use development builds only for development checks. Confirm no Metro connection is required to ring or answer. Existing `preview` EAS profile is configured but not yet used/verified for this feature.
- [ ] Verify multi-device first answer, refresh/revocation, caller cancellation, stale delivery, reboot-after-first-unlock and access isolation. Record force-stop/pre-unlock limitations separately.
- [ ] Roll out tested flags/config/migrations in development, record exact EAS IDs/device OS/network evidence and update all continuity artifacts.

## Data and configuration

Migration 0004 is now created/applied in test and development after clean/upgrade/recovery checks and scoped grants. Implemented changes: device credential hashes/rotation/revocation, authenticated session-to-device bindings, native winning-device call ownership, encrypted provider-token metadata, and transactional call-delivery outbox/attempts. Prefer additive expansion with legacy browser/session columns retained until migration/backfill/acceptance. No startup schema sync or destructive dev reset.

Potential server secret names (names only; not configured): APNS_TEAM_ID, APNS_KEY_ID, APNS_KEY_PATH, APNS_ENVIRONMENT, FCM_PROJECT_ID, FCM_CREDENTIALS_PATH or workload identity settings, PUSH_TOKEN_ENCRYPTION_KEY / key ID. Exact names are finalized with code/config example. Existing generic build/signing keys are not assumed to be push sender credentials. Android client `google-services.json` is build configuration, distinct from private FCM service-account credentials; apply a deliberate Git/EAS allowlist and archive verification. No Google service-account key or APNs .p8 may be shipped to a phone.

Native configuration: real app IDs, correct APNs topic/environment/entitlements and PushKit app registration; Android Firebase app/FCM initialization, native messaging service, Telecom permissions/services and applicable notification/full-screen settings. Use existing Apple Developer/EAS accounts and EC2 backend; project-specific changes only. New EAS binaries are required once native implementation is ready. Do not submit builds merely to satisfy this planning checkpoint.

## External setup to resolve

Owner instructions and private file handoff are in [push setup](../PUSH_SETUP.md). Owner supplied matching Firebase client config and Apple P-256 private key; local structural/signature checks pass and permissions are 600. Existing EAS team metadata is retained privately. New owner-supplied Production key `AuthKey_WS664U36TD.p8` passes local EC P-256/signature checks, mode 600; earlier Sandbox key is owner-reported revoked. Confirm Production key scope/topic and inspect actual signed push entitlement after implementation. Firebase server JSON is now supplied under its original download filename; project/account/local RSA checks and Google OAuth exchange with Messaging scope pass. APNs authorization/capability, FCM API/send permission and real delivery remain unverified.

| Item | Current evidence | Needed to complete delivery tests |
| --- | --- | --- |
| Apple Developer / EAS signing | Existing signing verified; owner `.p8` locally parses/signs; key/team metadata available privately | Enable/verify push support for this app ID; verify key authorization and matching VoIP scope/environment/topic. |
| Firebase Android project | Matching client config and Admin SDK service-account JSON supplied; Google OAuth Messaging-scope exchange accepted HTTP 200 | Verify FCM API/send permission in integration, native registration and actual delivery. |
| Physical devices | Owner iPhone/wife Android; foreground flow/ringtone reported successful | Models/OS, permission states, real APNs/FCM enrollment and owner-operated lifecycle matrix. |
| Standalone internal app | EAS preview profile exists | Actual bundled-JS builds installed and tested with Metro stopped/unreachable. |

No provider connection, key creation, paid build or background runtime was initiated during planning. These are external prerequisites for final end-to-end acceptance, not a reason to block independent implementation of secure identity, DB/API contracts and fake-provider tests when requested.

## Acceptance and verification

| Scenario | Expected evidence | Status |
| --- | --- | --- |
| Secure restoration | App restart restores correct account/device; refresh rotation/reuse, logout/reassignment/backup-loss revoke old access; native access works while locked after first unlock | Not implemented |
| Registration / ownership | Token rotation, app/environment separation, no ID spoof; same winning device can refresh session, second device cannot steal media | Not implemented |
| Delivery boundary | No push before authorization/commit; duplicate/retry/provider errors/offline expiry do not create another call; receipt not logged as ringing/connected proof | Not implemented |
| iPhone background/locked/cold start | Real APNs → prompt CallKit UI/ringtone → Answer/audio → end/history; no Metro or mounted JS required for initial report | Not implemented |
| Android background/locked/cold start | Real FCM → native call notification/UI → Answer/audio → end/history; correct service/audio and permission-recovery behavior | Not implemented |
| Cancel/race/failure | Caller cancels before/after delivery, late push, duplicate events, simultaneous answers, no network, failed media, revocation and no answer leave no ghost ring/call | Not implemented |
| Audio/video | One session/route owner, no duplicate foreground ringtone, speaker/earpiece/headset/mute intact; background audio works, foreground camera consent preserved | Not implemented |
| Liveness/time/history | Healthy background audio survives stale JS timers; actual/uncertain media observations remain honest; both authorized histories agree | Not implemented |
| Reboot | Previously enrolled phone, first unlock, no manual app launch → incoming native call; pre-unlock/force-stop/swipe-quit captured separately | Not implemented |
| Regression / recovery | Existing foreground/native/browser/TURN tests pass; flags can disable new delivery without dropping data; clean/upgrade DB and native build evidence | Not run for this stage |

Run repository type/unit/DB/account/browser checks as relevant plus native prebuild/archive/real EAS compilation. Mock APNs/FCM cannot prove handset delivery. Capture actual models/OS/build IDs, permission/battery/network state and sanitized call evidence using the device report template. No real patients or recorded calls.

## Risks and recovery

Largest risks are cold-start native deadlines, identity/session ownership, competing audio owners, OS delivery restrictions and JS-only liveness assumptions. Report incoming calls promptly natively; make every subsequent server/native action idempotent and bounded. Delivery is conditional on network/OS/user state, not guaranteed. Never bypass device lock to retrieve credentials or broaden force-stop behavior. Preserve first-unlock baseline and fail gracefully when credentials are unavailable.

Use additive migrations and feature flags; back up/rehearse any data-bearing destructive/backfill step before application. Disable new delivery/restore previous app path without dropping durable calls or device revocation history. Revoke compromised sender/device credentials independently. Keep current foreground route available while new native builds undergo acceptance. No recording, claims or production compliance claim.

## Handoff

Next implementation increment is secure resumable device identity plus backend registration/delivery contracts, then iPhone delivery/native call proof, then Android parity. Resolve Apple/Firebase sender setup in parallel with independent code. This plan is a concrete next-stage artifact, not evidence that background ringing is implemented or a request to create unrelated services.

Primary references: [PushKit native incoming handling](https://developer.apple.com/documentation/pushkit/responding-to-voip-notifications-from-pushkit), [iOS after-first-unlock Keychain](https://developer.apple.com/documentation/security/ksecattraccessibleafterfirstunlockthisdeviceonly), [Android Keystore](https://developer.android.com/privacy-and-security/keystore), [Core-Telecom and audio ownership](https://developer.android.com/develop/connectivity/telecom/voip-app/telecom), [FCM authenticated sending](https://firebase.google.com/docs/cloud-messaging/send/v1-api), [Android stopped-state behavior](https://developer.android.com/about/versions/15/behavior-changes-all#stopped-state).

## Implementation checkpoint

Owner authorized implementation. Added migration 0004 (not yet applied to development), device-bound enrollment/refresh with encrypted idempotent retry and replay revocation, stable media ownership, encrypted provider registration, transactional delivery queue and APNs/FCM senders. Added native Keychain/Keystore identity, early PushKit/CallKit, Android FCM/self-managed Telecom, native RTP observation and conditional native client integration. Browser/legacy remains supported. Native prebuild, autolinking, JS exports, type check, 58 unit cases, DB clean/upgrade/recovery, account/browser-media and six native server scenarios pass. Native compilation/device tests and live rollout remain pending. Build archive contains Firebase client config but excludes server credentials. Current native and provider behavior must not be marked accepted before real builds/devices.

Latest checkpoint: seven native API/store scenarios (8 Node tests including wrapper), development migration/grants/permission check, and all 13 browser checks including TURN pass. Real FCM validate-only request returned HTTP 200, no delivery. iOS first preview build cea655cf failed because existing Ad Hoc profile lacks Push Notifications/aps-environment; owner was asked asynchronously to run EAS credential configuration with Apple login in the isolated worktree. Android b899c8e0 failed Gradle module version metadata, corrected; replacement decf7909 is pending. iOS simulator profile is for independent compile validation while physical signing is pending. No live JS/service rollout yet.

Current handoff: [native evidence](../testing/2026-11-18-native-background-calls.md) supersedes earlier checkpoints. Backend/flags/migration deployed, public legacy/account/native identity smokes and FCM validation pass. iOS native compilation passes in simulator; physical profile update awaits owner Apple authentication (cached session expired). Final Android preview b153aa67 is being checked. No handset ringing/Answer/reboot acceptance is claimed.

Owner completed the requested Apple credential/profile step. Physical iPhone preview e449609b is submitted from 1b6160b; verify outcome before another login request. Final Android b153aa67 finished (APK HTTP 200); latest iOS native code compiles in simulator c8f80317. Real handset acceptance remains pending.
