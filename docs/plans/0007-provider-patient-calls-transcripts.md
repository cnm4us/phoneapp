# 0007 Provider/patient app calls, history, and post-call transcripts

Status: staged; database/foreground calls/history and ringtone implemented through 0008–0010; native incoming plan 0011 prepared, implementation and recording/transcription pending. Updated: 2026-11-18.

Requirements: PAT-01–04, TEAM-01–02, COM-01, COM-05–06, COM-10, TX-01–06, REP-03, OPS-01–03 in [PRD](../PRD.md).

## Outcome and scope

Owner's requested next product slice:

1. Provider/care-team view lists synthetic Patient A, Patient B, Patient C.
2. Selecting a patient shows call options. Only **App Audio/Video** is actionable initially. App Audio and Phone #1/#2/#3 are later options; do not invoke a personal SIM dialer or imply Twilio/PSTN is implemented.
3. Provider taps App Audio/Video; the enrolled patient's phone rings with answer/decline, including native background/locked handling in its own acceptance gate. Manual room codes disappear from this product flow.
4. Both authorized participants receive a durable call-log entry. With transcription enabled and consented, an attributed transcript appears after the call finishes processing. Live captions and LLM summaries are outside this slice.
5. Transcription Off permits an ordinary unrecorded call with a call-log entry and no transcription job. Owner subsequently requested playable saved audio in both call logs. Retention duration/deletion and exact recording/transcription toggle behavior still need definition.

Use synthetic accounts/patients/test conversations. Real clinical deployment, HIPAA implementation, Twilio numbers/SMS, clinical summaries, and billing automation remain outside this proposed iteration. This pulls a narrow app-calling/history/transcription slice forward from portions of M2/M3/M5; it does not silently complete those milestones or original M1 device acceptance.

## Current evidence

The repository has native/browser foreground two-person WebRTC, signaling/TURN, shared quality, native audio routing, and successful EAS builds. The [0008 database foundation](0008-database-foundation.md) now provides isolated MariaDB dev/test schemas, migrations, disabled synthetic A/B/C directory and tooling. 0009 now implements synthetic one-time account enrollment, authorized directory/foreground call APIs, private media access and shared durable history. Push registrations, native background incoming-call integration, media recording, object storage, worker queue, playback and transcription provider remain absent. Existing native AppState handling deliberately ends a call on backgrounding; foreground success does not demonstrate locked-phone ringing or background audio.

Unique identity and push are feasible building blocks. Patient record IDs identify clinical subjects; authenticated account IDs identify app users; device tokens address a specific app installation/platform and can rotate. These must be modeled separately. Provider-to-patient authorization is checked on the server for dialing, answer/join, call history, transcript viewing, and export. Possessing/guessing a patient ID or choosing a UI role is insufficient authorization.

The current signaling server and TURN relay do not expose decoded participant audio for transcription. Choose an authorized media-receiving/recording design (such as an SFU/media worker, or a carefully integrated native forwarding path) before promising recording. Preserve separate participant tracks, call-time offsets, and mute/consent behavior; map source endpoints to authenticated identities/role snapshots without claiming biometric speaker identity. Multiple people sharing one endpoint remain uncertain and reviewable.

## Proposed app organization

Separate provider/patient navigation and permissions now while sharing calling, audio routing, networking, and transcript components. Implemented for this synthetic demonstration: role-specific authenticated accounts in one shared binary (0009). If distinct icons/apps are preferred, EAS variants can produce separate provider/patient app IDs from shared source. This is a proposed packaging decision, not an accepted requirement for two binaries or two repositories. Variant app IDs also require corresponding push/service/signing configuration; app name/variant must never grant a role.

## Proposed call and transcription lifecycle

- Provider requests an app call to a patient ID; backend validates account, care relationship, availability, and rate limits, creates one durable call ID, and resolves active eligible device registrations.
- Deliver an incoming call to enrolled patient device(s). Push is a wake/alert mechanism, not audio transport or proof the patient is ringing. Payloads carry minimal call routing/expiry data; authenticated APIs supply authorized details. APNs VoIP tokens are distinct from ordinary/Expo notification tokens.
- iOS uses native PushKit/APNs VoIP delivery with prompt CallKit reporting. Android uses FCM with native Telecom/Core-Telecom integration and call-style UI/services as required by platform/version. Respect notification permissions, DND, battery/OS restrictions, and offline/force-stopped limitations; no guaranteed delivery claim. Ordinary notification banners are not accepted as a completed background-calling implementation.
- Answer/decline/cancel/timeout are idempotent server-authorized transitions. Expired or delayed pushes cannot revive ended calls. If several enrolled devices ring, first valid answer wins and remaining invitations close. Stop ringing after caller cancellation/no answer. Do not infer connected duration from push delivery.
- After acceptance and appropriate mic/camera consent, issue short-lived media access bound to that call/participant and establish WebRTC. Native CallKit/Telecom lifecycle must coordinate WebRTC audio activation and the existing output controller; avoid conflicting audio-session owners. Background audio and foreground video require explicit separate device tests.
- Persist call outcomes and observed connection events; both call-log views query the same logical call. Recorded duration remains separate from billing eligibility and approved staff time.
- With explicit call recording/transcription consent, capture participant audio according to the selected media design. Off/decline prevents capture/upload/processing; turning Off mid-call stops subsequent capture and marks any partial transcript. Define consent/re-enable/retention behavior before implementation. Do not save a muted person's unsent microphone audio.
- After call completion, queue a bounded, retry-safe transcription job. Merge timestamped per-track results into a common transcript with source labels, versioning/corrections, and Processing/Ready/Failed/Off/Partial states. Both authorized apps retrieve it. Provider/transcription failures preserve the call history. A later LLM summary can reference this stored transcript/version without replacing it.

## Implementation steps

- [ ] Confirm packaging preference (one binary with roles versus separate app variants), audio retention/deletion expectations, consent UX, and exact first-call matrix.
- [ ] Select auth, native incoming-call, media capture/storage, and batch transcription components (persistence/migrations selected and implemented in 0008); document tradeoffs, pricing/access dependencies, and decisions. Do not treat this proposal as provider/spending approval.
- [x] Establish a dedicated project dev/test DB with versioned migrations, synthetic seeds, connectivity/schema/test commands, and clean-install/upgrade recovery evidence per [database workflow](../DATABASE.md); completed in [0008](0008-database-foundation.md).
- [x] Implement synthetic enrolled provider/patient views, assigned directory and shared call history in 0009; verified server-side access and current-session logout/expiry. Durable push device registration/rotation/reassignment and private audio playback remain later gates.
- [x] Implement authenticated foreground patient-addressed calls without room-code entry; durable IDs/outcomes, retries/answer ownership, private signaling and shared history verified in 0009. Physical foreground acceptance still pending.
- [ ] Integrate native incoming-call lifecycle and device delivery; verify locked/background/cold-start, cancellation, duplicate/late delivery, multiple devices, and audio-session/output controls. This is a substantial separate implementation gate and requires new native builds.
- [ ] Implement consent-aware media capture, processing worker, post-call labeled transcripts, and both authorized views. Exercise Off, partial recording, retry/failure, retention/deletion, and multiple-speaker uncertainty.
- [ ] Verify the full provider → Patient A → native answer → call → call log → transcript flow with synthetic data on iPhone/Android, plus backend restart and access isolation. Record actual provider/service setup and device/OS details.
- [ ] Update artifacts and deploy only within the authorized development scope. Keep original M1/production/clinical acceptance separate.

## Data and configuration

Implemented foundation: users/primary roles, patients/contact ownership, patient-account and staff-patient bindings, device metadata, calls/participants/events, consent decisions, private media references, transcription jobs/versions/segments, and separate activity observations/reviews. Dedicated MariaDB dev/test schemas, connector 3.5.5 and two SQL migrations are verified under [0008](0008-database-foundation.md) and [decision 0005](../decisions/0005-database-foundation.md). Stable IDs, UTC timestamps, integer-second activity durations, millisecond transcript offsets, idempotency and composite foreign keys are in place. Authenticated synthetic endpoints and foreground native/browser UI are implemented in 0009. Device push delivery, recording/storage objects, job execution and transcript/audio playback remain absent. Capture consent/retention and identity/storage/STT vendors remain unresolved; future services must enforce patient/role access and capture policy. Follow [database workflow](../DATABASE.md) for additional migrations.

Future APNs/FCM/auth/STT/storage credentials belong on scoped backend/native build configuration as appropriate; provider secrets never become EXPO_PUBLIC variables. Minimal push payloads and server-authorized media access are required even during synthetic testing. Only the explicitly authorized local database foundation and private DB credentials have been created through 0008. No push/auth/media provider, upload, recording or new build is enabled.

## Acceptance and verification

| Scenario | Expected evidence | Status |
| --- | --- | --- |
| DB prerequisite | Isolated schemas, migration history, A/B/C seed, clean/upgrade/recovery/permission evidence | Passed in 0008; not app integration |
| Provider/patient views | Authorized list A/B/C; only App Audio/Video functional; patient sees own history | Implemented; Chromium/API pass in 0009, physical acceptance pending |
| Identity and access | Patient A cannot view/join B's call; unassigned provider denied; role/ID spoof rejected | Synthetic enrollment/API checks pass in 0009; production identity/transcript access remain later |
| Device routing | Registration/rotation/logout; delayed/duplicate push; first answer wins on multiple devices | Not implemented |
| Incoming native calls | Both platforms foreground/background/locked/cold-start, decline/cancel/no-answer/offline/DND/force-stop behavior documented | Not implemented |
| Media lifecycle | Connected clock/outcomes consistent; native answer/audio activation; routing/private speaker/headsets; video consent and cleanup | Not implemented |
| Shared durable history | Same call ID/data in both views, restart retains interrupted/ended history, outcomes and observed intervals | API/browser pass in 0009; automatic media reconnection not promised |
| Transcription consent | Off produces no captured audio or STT job; stopping mid-call stops subsequent capture; clear partial/status evidence | Not implemented |
| Post-call transcript/audio | Separate endpoint labels/timestamps, common text/version, private authorized audio playback, processing errors/retries/corrections/retention, role uncertainty visible | Not implemented |
| Continuity | No ordinary banner or mocked ringing reported as native hardware acceptance; DB/build/service steps recorded | Proposed tests only |

Use [testing strategy](../TESTING.md) and device reports. Existing compilation/POC tests do not prove any acceptance row above. Database, account API and real Chromium foreground-media tests have run; see 0008/0009. Native locked/background and physical device acceptance remain open.

## Risks and recovery

Background phone behavior is the largest native expansion beyond current POC. Delivery is conditional on OS/device/network state, and push acceptance is not a ringing or answered call. Preserve missed-call/no-answer behavior and observable statuses. Existing AppState cleanup and audio-routing ownership need deliberate refactoring rather than bypassing safeguards. Separate patient access and recording consent from authentication/notifications. Retention/access/job failures must not leak records or invalidate the call log. Reversible dev migrations and feature-gated rollout are required once chosen; database recovery is documented in 0008; app/runtime rollout remains pending.

## Handoff

User selected post-call transcripts and shared call logs; live captions and summaries are deferred. Architecture/packaging and audio retention/deletion are open; audio playback is now requested. Persistence 0008 and bounded synthetic identity/directory/foreground history 0009 are implemented. Next: physical foreground acceptance, then native incoming-call and separately consent/media architecture plans; resolve dependent consent/media/native/STT choices before their stages. No new cloud spend initiated. Existing native speaker/earpiece physical acceptance remains independently open.

References: [Apple PushKit/CallKit](https://developer.apple.com/documentation/pushkit/responding-to-voip-notifications-from-pushkit), [Android Telecom](https://developer.android.com/develop/connectivity/telecom), [FCM priority](https://firebase.google.com/docs/cloud-messaging/android-message-priority), [Android call notifications](https://developer.android.com/develop/ui/compose/notifications/call-style), [Expo app variants](https://docs.expo.dev/build-reference/variants/).

## Background ringing discussion — 2026-11-18

After successful owner-reported foreground ringing, owner asks about background, locked and non-running app delivery and ringtone customization. Continue toward native system incoming calls through PushKit/APNs + CallKit (iOS) and FCM + Telecom/call-style integration (Android). This requires persisted secure identity/device enrollment, native early-launch handlers, wake delivery/expiry, system answer/decline/cancel reconciliation and coordinated WebRTC/audio ownership, not a JavaScript background polling/tone loop. No implementation/service/provider/build is activated by this discussion.

CallKit exposes a bundled custom provider ringtone through [ringtoneSound](https://developer.apple.com/documentation/callkit/cxproviderconfiguration/ringtonesound). Android [notification channels](https://developer.android.com/develop/ui/compose/notifications/channels) expose sounds/vibration with user-controlled settings; foreground alert preferences need deliberate mapping to supported system calling behavior. We can propose custom bundled tones/a small picker and call timeout, but cannot promise arbitrary iOS vibration patterns or forced loudness/silent/Focus bypass.

Differentiate ordinary background/process death from explicit force-stop. [Apple PushKit](https://developer.apple.com/documentation/pushkit/responding-to-voip-notifications-from-pushkit) can launch/wake non-running apps; [Apple DTS](https://developer.apple.com/forums/thread/840468) identifies VoIP pushes as an exception to general user-force-quit relaunch restrictions. [Firebase prerequisites](https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages) state Android Settings force-stop requires reopening; its generic iOS FCM guidance is not a PushKit rule. Offline/powered-off devices cannot receive a live internet call; missed/expired handling must not ring stale calls later. Device models/OS, notification permissions, battery/DND and exact lifecycle cases need real testing.

Reboot follow-up: an ordinary reboot is different from Android Settings Force stop. With previously completed enrollment/device registration, online connectivity and native delivery implemented, cold-start incoming calls can work after reboot without manually opening Phoneapp. A pre-existing Android stopped-package flag persists until user interaction with the app; reboot must not be treated as clearing it ([Android stopped-state policy](https://developer.android.com/about/versions/15/behavior-changes-all#stopped-state)). Use first unlock after reboot as the initial acceptance baseline; pre-first-unlock delivery/storage access is separate ([Android FCM Direct Boot](https://firebase.google.com/docs/cloud-messaging/customize-messages/android-direct-boot), [Apple DTS on reboot/unlock VoIP behavior](https://developer.apple.com/forums/thread/758973)). Test ordinary reboot/unlock/no-launch, force-stop→reboot, iOS swipe-quit and pre-unlock separately. Current foreground implementation does not provide this yet; no runtime work authorized by this discussion.

Ordinary push follow-up: a visible alert notification can tell a user “Incoming Phoneapp call — tap to open” while the app is backgrounded/terminated. The OS can display the alert independently of running Phoneapp JS ([Expo notification behavior](https://docs.expo.dev/push-notifications/what-you-need-to-know/), [Apple remote notifications](https://developer.apple.com/documentation/usernotifications/setting-up-a-remote-notification-server)). An interim notification→tap→authenticated call-state check→join-if-live/missed-if-expired flow is feasible, with secure persisted login/device registration first. Use short expiry and no patient/clinical details in the notification. Do not label an ordinary banner/short notification sound as completed CallKit/Telecom incoming ringing acceptance, and do not present it as bypassing Android Force stop, disabled alerts, offline delivery or OS sound policies. This remains discussion, with no notification module/provider/build activated.

Concrete next-stage plan: [0011](0011-native-background-incoming-calls.md) now sequences secure persisted device identity, session-to-device ownership, registration/delivery, iPhone and Android native gates, standalone preview builds and real-device testing. It supersedes discussion-only next-step descriptions as the implementation handoff; ordinary notification-only and recording/transcription proposals remain separate. No migration/provider/native build was initiated by preparing 0011.
