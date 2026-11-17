# 0007 Provider/patient app calls, history, and post-call transcripts

Status: proposed; discussion and requirements only, implementation not started. Updated: 2026-11-17.

Requirements: PAT-01–04, TEAM-01–02, COM-01, COM-05–06, COM-10, TX-01–05, REP-03, OPS-01–03 in [PRD](../PRD.md).

## Outcome and scope

Owner's requested next product slice:

1. Provider/care-team view lists synthetic Patient A, Patient B, Patient C.
2. Selecting a patient shows call options. Only **App Audio/Video** is actionable initially. App Audio and Phone #1/#2/#3 are later options; do not invoke a personal SIM dialer or imply Twilio/PSTN is implemented.
3. Provider taps App Audio/Video; the enrolled patient's phone rings with answer/decline, including native background/locked handling in its own acceptance gate. Manual room codes disappear from this product flow.
4. Both authorized participants receive a durable call-log entry. With transcription enabled and consented, an attributed transcript appears after the call finishes processing. Live captions and LLM summaries are outside this slice.
5. Transcription Off permits an ordinary unrecorded call with a call-log entry and no transcription job. Audio archive/playback and retention have not been requested/decided.

Use synthetic accounts/patients/test conversations. Real clinical deployment, HIPAA implementation, Twilio numbers/SMS, clinical summaries, and billing automation remain outside this proposed iteration. This pulls a narrow app-calling/history/transcription slice forward from portions of M2/M3/M5; it does not silently complete those milestones or original M1 device acceptance.

## Current evidence

The repository has native/browser foreground two-person WebRTC, signaling/TURN, shared quality, native audio routing, and successful EAS builds. No auth, patient DB, durable call history, push registrations, native incoming-call integration, media recording, object storage, worker queue, or transcription provider exists. Existing native AppState handling deliberately ends a call on backgrounding; foreground success does not demonstrate locked-phone ringing or background audio.

Unique identity and push are feasible building blocks. Patient record IDs identify clinical subjects; authenticated account IDs identify app users; device tokens address a specific app installation/platform and can rotate. These must be modeled separately. Provider-to-patient authorization is checked on the server for dialing, answer/join, call history, transcript viewing, and export. Possessing/guessing a patient ID or choosing a UI role is insufficient authorization.

The current signaling server and TURN relay do not expose decoded participant audio for transcription. Choose an authorized media-receiving/recording design (such as an SFU/media worker, or a carefully integrated native forwarding path) before promising recording. Preserve separate participant tracks, call-time offsets, and mute/consent behavior; map source endpoints to authenticated identities/role snapshots without claiming biometric speaker identity. Multiple people sharing one endpoint remain uncertain and reviewable.

## Proposed app organization

Separate provider/patient navigation and permissions now while sharing calling, audio routing, networking, and transcript components. Recommendation for the first demonstration: role-specific authenticated accounts in one binary. If distinct icons/apps are preferred, EAS variants can produce separate provider/patient app IDs from shared source. This is a proposed packaging decision, not an accepted requirement for two binaries or two repositories. Variant app IDs also require corresponding push/service/signing configuration; app name/variant must never grant a role.

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

- [ ] Confirm packaging preference (one binary with roles versus separate app variants), audio playback/retention expectations, consent UX, and exact first-call matrix.
- [ ] Select auth/persistence/migration, native incoming-call, media capture/storage, and batch transcription components; document tradeoffs, pricing/access dependencies, and decisions. Do not treat this proposal as provider/spending approval.
- [ ] Establish a dedicated project dev/test DB with versioned migrations, synthetic seeds, connectivity/schema/test commands, and clean-install/upgrade recovery evidence per [database workflow](../DATABASE.md).
- [ ] Implement authenticated provider/patient experiences, assigned patient directory, enrollment/device registration, and shared call history. Verify server-side patient isolation and token logout/rotation/reassignment.
- [ ] Implement authenticated foreground patient-addressed calls without room-code entry; use real durable call IDs/outcomes before adding push.
- [ ] Integrate native incoming-call lifecycle and device delivery; verify locked/background/cold-start, cancellation, duplicate/late delivery, multiple devices, and audio-session/output controls. This is a substantial separate implementation gate and requires new native builds.
- [ ] Implement consent-aware media capture, processing worker, post-call labeled transcripts, and both authorized views. Exercise Off, partial recording, retry/failure, retention/deletion, and multiple-speaker uncertainty.
- [ ] Verify the full provider → Patient A → native answer → call → call log → transcript flow with synthetic data on iPhone/Android, plus backend restart and access isolation. Record actual provider/service setup and device/OS details.
- [ ] Update artifacts and deploy only within the authorized development scope. Keep original M1/production/clinical acceptance separate.

## Data and configuration

Proposed entities, not an implemented schema: authenticated users/roles, patients/contact ownership, provider-patient permissions, device registrations, calls/participants/lifecycle events, recording consent intervals, media references, transcription jobs/segments/versions. Use stable IDs, UTC timestamps, integer-second duration, event idempotency, and access-controlled storage. No actual DB/provider/ORM/auth/storage/queue/transcription selection or credentials yet. Follow [database workflow](../DATABASE.md) before migrations; never reuse another EC2 project's DB.

Future APNs/FCM/auth/STT/storage credentials belong on scoped backend/native build configuration as appropriate; provider secrets never become EXPO_PUBLIC variables. Minimal push payloads and server-authorized media access are required even during synthetic testing. No services, keys, migrations, uploads, recording, or builds are created by this plan.

## Acceptance and verification

| Scenario | Expected evidence | Status |
| --- | --- | --- |
| Provider/patient views | Authorized list A/B/C; only App Audio/Video functional; patient sees own history | Not implemented |
| Identity and access | Patient A cannot view/join B's call/transcript; unassigned provider denied; client role/ID spoof rejected | Not implemented |
| Device routing | Registration/rotation/logout; delayed/duplicate push; first answer wins on multiple devices | Not implemented |
| Incoming native calls | Both platforms foreground/background/locked/cold-start, decline/cancel/no-answer/offline/DND/force-stop behavior documented | Not implemented |
| Media lifecycle | Connected clock/outcomes consistent; native answer/audio activation; routing/private speaker/headsets; video consent and cleanup | Not implemented |
| Shared durable history | Same call ID/data in both views, restart/reconnect safe, missed/declined/canceled entries, no double durations | Not implemented |
| Transcription consent | Off produces no captured audio or STT job; stopping mid-call stops subsequent capture; clear partial/status evidence | Not implemented |
| Post-call transcript | Separate endpoint labels/timestamps, common text/version, processing errors/retries/corrections/retention, role uncertainty visible | Not implemented |
| Continuity | No ordinary banner or mocked ringing reported as native hardware acceptance; DB/build/service steps recorded | Proposed tests only |

Use [testing strategy](../TESTING.md) and device reports. Existing compilation/POC tests do not prove any acceptance row above. No tests for this proposed slice have run.

## Risks and recovery

Background phone behavior is the largest native expansion beyond current POC. Delivery is conditional on OS/device/network state, and push acceptance is not a ringing or answered call. Preserve missed-call/no-answer behavior and observable statuses. Existing AppState cleanup and audio-routing ownership need deliberate refactoring rather than bypassing safeguards. Separate patient access and recording consent from authentication/notifications. Retention/access/job failures must not leak records or invalidate the call log. Reversible dev migrations and feature-gated rollout are required once chosen; no runtime rollback is needed for this documentation-only proposal.

## Handoff

User selected post-call transcripts and shared call logs; live captions and summaries are deferred. Architecture/packaging and audio playback/retention are open. Next action is discussion/review of this proposed slice, then a bounded implementation plan with actual stack/access decisions. No implementation or new cloud spend initiated. Existing native speaker/earpiece physical acceptance remains independently open.

References: [Apple PushKit/CallKit](https://developer.apple.com/documentation/pushkit/responding-to-voip-notifications-from-pushkit), [Android Telecom](https://developer.android.com/develop/connectivity/telecom), [FCM priority](https://firebase.google.com/docs/cloud-messaging/android-message-priority), [Android call notifications](https://developer.android.com/develop/ui/compose/notifications/call-style), [Expo app variants](https://docs.expo.dev/build-reference/variants/).
