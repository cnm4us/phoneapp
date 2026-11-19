# Phoneapp product requirements

Version: 1.4 draft. Updated: 2026-11-19 UTC. Product owner: repository owner, with clinical workflow input from his wife, a California nurse practitioner specializing in gerontology.

## Purpose

Capture the small increments of care-team work that are easily missed during chronic care management (CCM) and complex CCM. Combine patient communications with an auditable activity ledger so staff can review time and export supporting information. The app supports documentation and billing review; captured time alone does not establish reimbursement eligibility.

The immediate deliverable is a WebRTC experiment using the owner's iPhone and his wife's Android phone. The full care-management product will be developed through separate, testable implementation plans.

Implementation checkpoint: [0008](plans/0008-database-foundation.md) established MariaDB persistence; [0009](plans/0009-authenticated-foreground-calls.md) implements synthetic enrollment, server-assigned provider/patient screens, assigned directory, patient-addressed calls and shared durable call history. [0010](plans/0010-foreground-ringtone.md) adds foreground sound/vibration; [0011](plans/0011-native-background-incoming-calls.md) adds persistent native device identity, encrypted APNs/FCM delivery, PushKit/CallKit and Android Telecom. Both final physical previews compile, iPhone signed Production APNs entitlement is verified, and the owner reports successful iPhone ringing after a described swipe-away. Remaining device acceptance is in [evidence](testing/2026-11-18-native-background-calls.md). Production identity, live-call recording/transcription and full time review/export remain pending. Audio-message capture/playback is implemented under 0012.

Implemented next increment: [0012 audio messages and shared patient history](plans/0012-audio-messages-shared-history.md), deployed to development with physical message acceptance open. It adds two-way short recorded audio messages, private storage/playback, patient-linked history and late-enrollment access, using synthetic data. Video messages are implemented/deployed to development under [0014](plans/0014-video-messages.md); automated/public checks pass, both final native previews compile/package-check successfully; physical acceptance is tracked in project state. Transcription, patient-initiated live calls, no-answer voicemail and Twilio remain subsequent increments. [0013](plans/0013-persistent-browser-sign-in.md) now retains browser login across reloads; native sign-in already persists.

Current increment: [0015 unified communication workspace](plans/0015-unified-communication-workspace.md). One log/detail groups calls, recorded audio/video and future in-app text by format, interaction and channel; staff receipts/assignment/action state are separate. Planned stages add internal discussion, retained exact originals for new media, saved-message transcription, source-linked reviewed AI clinical draft notes and staff work links. Live-call capture/Twilio/SMS require their own later integration gates. Stage A is implemented/deployed with one filtered call/media log/detail and preserved source-specific access. Native previews and physical acceptance are tracked in current state. Staff workflow/comments, text, originals, transcripts, AI notes, work links and source adapters remain later stages.

## Users and context

| User | Main needs |
| --- | --- |
| NP / supervising practitioner | Review patient activity and staff time, document practitioner work, approve reports. |
| RN / MA / other authorized care-team member | Call, message, document work, and confirm time with little extra effort. Staff role does not by itself establish billable eligibility. |
| Practice administrator | Manage users, patient/contact records, assigned phone numbers, and exports. |
| Patient / caregiver | Answer or initiate telephone calls, exchange messages, and optionally join browser-based audio/video without installing an app. |

The owner's wife is working toward California 104 NP status. Licensure, scope, payer enrollment, and billing-rule verification are external practice responsibilities; this PRD does not establish those permissions.

## Delivery scope

| Milestone | Outcome | Outside that milestone |
| --- | --- | --- |
| M0 Foundation | PRD, agent continuity, plans, tool inventory, database/testing policies. | Application implementation. |
| M1 WebRTC proof of concept | Native iPhone-to-Android audio/video call in the foreground, including cross-network and TURN verification. | Real patients, telephone numbers, SMS, recording, transcription, background ringing, billing, durable patient DB. |
| M2 Care and time foundation | Synthetic patient/contact records, staff roles, durable activity ledger, manual/reviewed time, CSV export. | Claims submission and production use. |
| M3 Telephone calling | Twilio number, outgoing/incoming app-to-telephone audio, background ringing, matching and call-derived activity. | Automatic billing approval. |
| M4 Messaging and browser access | Two-way recorded audio/video messages and shared history, saved browser sign-in, two-way SMS, measured/reviewed reading/composition sessions and patient browser audio/video. | Inference that a displayed message proves attention. |
| M5 Transcription and clinical draft notes | Consented recording/transcription with role attribution/corrections and source-linked AI notes with explicit human review. | Autonomous clinical decisions, automatic patient publication or identity certainty from speaker detection. |
| M6 Production readiness | Privacy/security implementation, applicable agreements, operational reliability, approved billing rules and production acceptance. | A claim that the POC is production-ready. |

M3 through M5 may be reordered after M1 evidence and clinical feedback. HIPAA work is deliberately deferred for the experiment; normal credential hygiene and synthetic data remain part of development.

## Requirements and acceptance criteria

### Proof of concept

| ID | Requirement | Acceptance |
| --- | --- | --- |
| POC-01 | One Expo/React Native codebase for native iOS and Android; custom EAS development builds. | Install and launch builds on both named physical devices; record build IDs and dependency versions. |
| POC-02 | Join a temporary two-person session using a short-lived room/invite. | Both devices join the same session; a third participant is rejected; expired/invalid invites fail clearly. |
| POC-03 | Two-way audio and video, mute, camera on/off, camera switch when supported, and hangup. | Both directions work; either participant can end the session; capture stops on exit. |
| POC-04 | Work across Wi-Fi and cellular using STUN and authenticated TURN fallback. | Complete the matrix in the M1 plan, including a forced-relay test with evidence of a relay candidate pair. Same-Wi-Fi success alone is insufficient. |
| POC-05 | Show connection state and elapsed connected duration. | Joining, connected, reconnecting/disconnected, ended, and error states are understandable; failed setup is not displayed as connected time. |
| POC-06 | Handle permissions, peer departure, network loss, and repeated calls. | Permission denial offers a recovery path; no stale session/media capture remains after hangup; another call can start without relaunch. |
| POC-07 | Make failures diagnosable without collecting conversations. | Capture session IDs, timestamps, platform/build, connection transitions, and relevant WebRTC statistics; redact session credentials and avoid raw SDP/IP dumps in shared artifacts. No recording. |

### Patients, contacts, and staff

| ID | Requirement | Acceptance |
| --- | --- | --- |
| PAT-01 | A stable patient identifier with an optional display name/external practice identifier. | Updates to a name do not change the patient ID; exports can use identifiers without names. |
| PAT-02 | Multiple contact numbers per patient, with owner, relationship, preferred number, SMS capability, and contact permission/status. | Patient, spouse, caregiver, and facility numbers can be represented; a shared number may link to several patients. |
| PAT-03 | Candidate matching for incoming calls/messages. | Unique matches are suggested; ambiguous/unknown matches require staff resolution and preserve the original sender/number. Caller ID is not treated as verified identity. |
| PAT-04 | Route app calls to enrolled patient accounts and devices. | Stable patient record IDs link to authenticated patient accounts and active device registrations. Provider authorization is checked before dialing. Push tokens can rotate; logout/reassignment revokes old bindings. A patient ID is an identifier, not an access credential. |
| PAT-05 | Communication history belongs to the patient record before and after app enrollment. | Calls/messages attach to a stable patient ID independently of app installation. Verified enrollment links an authorized account to eligible existing history and retained media without copying/rekeying records. Phone-number matching alone never grants access; shared/unknown numbers need staff resolution. Internal notes and staff time-review data are not exposed through patient history. |
| TEAM-01 | Individual staff accounts and roles. | Each activity identifies its actor; RN, MA, NP, and admin permissions are configurable. Later role changes do not rewrite historical attribution. |
| TEAM-02 | Separate provider and patient experiences. | Provider sees authorized patients and their call options/history; patient sees their own incoming calls/history/transcripts. Backend enforces access independently of UI or app variant. Shared calling code serves both experiences; separate installable variants remain a packaging choice. |
| TEAM-03 | Browser sign-in survives normal reloads and browser-profile reopen. | Redeem enrollment once, retain a revocable browser session with an explicit expiry, restore authorized identity after reload, and forget/revoke on Sign out. Do not save one-use enrollment codes or reusable session secrets in Web Storage. Saved login does not automatically restart camera/microphone or a previous call. Cookie expiry/site-data removal and separate-profile account testing are explained. Implemented POC policy: 30 fixed days under plan 0013. |

### Communications

| ID | Requirement | Acceptance |
| --- | --- | --- |
| COM-01 | App-to-app and browser-to-app audio/video. | Patients/caregivers can use a time-limited browser invitation; voice-only participation is available. Mobile app UI uses native components. Native call video uses the available screen with essential controls overlaid; a separate app settings button opens quality/configuration without ending the call. Native audio output supports Speaker, Phone earpiece where available, and Automatic/headset routing independently of microphone mute; report current output separately from the requested preference. Developer tooling is separate from app configuration. |
| COM-02 | Outgoing audio calls to normal telephone numbers through a Twilio number. | Staff select patient/contact, place the call, and the recipient sees the configured service number; the patient needs no app. |
| COM-03 | Incoming calls to an assigned service number delivered to authorized app users. | Document routing ownership (practice/team/individual), answer/decline/missed behavior, locked/background behavior, and no-answer fallback; preserve a single logical encounter across provider legs. |
| COM-04 | Two-way SMS through service-owned numbers, displayed in the app. | Outgoing status and incoming messages appear in a patient-linked conversation, with failures and unresolved matches visible. No dependence on reading the staff phone's personal SMS inbox. |
| COM-05 | Track who actually participated. | Caller number, selected patient, staff actor, contact relationship, connection/disconnection, and relevant transfer/participant events are retained. Shared phones do not silently establish a patient identity. |
| COM-06 | Provider operations are resilient. | Duplicate/reordered callbacks do not duplicate encounters, messages, or time; users can distinguish pending, delivered, failed, missed, and completed states. |
| COM-07 | Adaptive video with user-selectable quality ceilings. | Auto, High (1080p/30 fps), HD (720p/30 fps), and lower/data-saver presets work before and during calls, with an opt-in experimental ceiling up to 4K/60 fps on verified devices/routes. Advanced controls bound resolution, frame rate, and bitrate; automatic adaptation can go below the chosen ceiling. A constrained participant can request less incoming video as well as limit outgoing video. Full-screen viewing remains available at every quality; expose actual measured quality separately from requested limits and explain device/peer/network limits. |
| COM-08 | Audio-first behavior in every quality mode. | Reduce or pause video to protect intelligible, low-latency speech; use supported media priority controls where available. Coordinate both directions and show when video is paused to protect audio. Recover video gradually after sustained improvement. No guarantee of uninterrupted audio on an inadequate or disconnected network. |
| COM-09 | Explicit two-way audio-only mode. | A clear in-call action stops sending and requests stopping receipt of video while audio continues. Show the active mode on both clients. Requesting video again never enables another person's camera without that person's permission. Distinguish this from the existing local camera toggle. |
| COM-10 | Initiate an app call directly from the provider patient list. | Provider selects Patient A/B/C, then App Audio/Video; the enrolled patient receives a native incoming call with answer/decline. No manual room-code exchange in this flow. Validate foreground, background, locked, unavailable/expired, cancellation, and duplicate/multi-device notifications on actual phones. Initially only App Audio/Video is actionable; App Audio and Phone #1–3 remain future options. |
| COM-11 | Audible foreground incoming calls with configurable vibration. | While Phoneapp is visible, including its settings panel, an incoming call can repeat a ringtone and optional vibration with device-local toggles. Respect system sound/silent/haptic policy; stop on Answer/Decline, caller cancellation, timeout, logout, background, teardown and before WebRTC audio. Show a reachable incoming prompt above settings. Old native binaries retain visual calling with update guidance. Background/locked native ringing remains a separate COM-10 gate. |
| COM-12 | Two-way recorded audio/video messages with later playback. | Provider and patient can deliberately record, preview, discard/re-record and send to an authorized recipient; recipient can play later while sender is offline. Retain sender/role, patient, timestamps, verified media duration, explicit availability/failure/expiry and idempotent retry. Audio-only is implemented under 0012. Plan 0014 adds deliberate video-with-sound recording on iPhone/Android/browser, camera choice before recording, private thumbnail, upload progress/retry, correct orientation and play/pause/seek/full-screen; initial synthetic limits are two minutes and normalized 720p/30. Verify actual formats/duration, preserve existing audio and patient access, and release camera/audio for calls or interruption without automatic resume. Video backend/browser is implemented under 0014; native previews/package checks pass; remaining device gates are in project state. Automatic no-answer message offers remain later work. This does not automatically record a live call or credit staff time. |
| COM-13 | Patient-initiated contact through app or practice telephone number. | Patient app offers audio/video and audio calling; desired telephone audio path uses the practice Twilio service inside Phoneapp. Patients without the app can dial the practice number normally. Route unanswered app calls to later audio/video message options and ordinary telephone calls to audio voicemail. Existing non-Twilio numbers require an explicit forwarding/porting/carrier integration for Phoneapp-managed routing/history. Later implementation; not supplied by 0012. |
| COM-14 | Distinct communication receipts, assignment and action state. | Record actor/time/source-version for viewer receipts independently of original recipient, mutable work owner and Needs review/Needs response/Waiting for patient/Resolved state. Playback does not resolve work; failed replies/comments do not count as patient responses. Authorized concurrent changes are version-checked, linked replies drive response state, and new incoming content can reopen work. Historical receipts remain unknown rather than fabricated. |
| COM-15 | Internal staff discussion linked to a communication. | Current authorized staff can comment/revise with author/time/history, visibly separated from Reply to patient. Patient-facing APIs, exports and default AI inputs exclude internal comments. A comment or reassignment never grants broader patient/source access. |
| COM-16 | In-app text messages and grouped conversations. | Authorized patient/staff can compose/send/reply with stable IDs, sender/time, immutable original/revisions and idempotent retry. Text threads group individual messages without erasing timestamps, double-counting items or creating one task per short text. Foreground discovery is explicit; SMS delivery and background pushes require their own integration. |

Ordinary telephone calls are audio; browser/app video is a separate channel. Calls outside this service, including unrelated personal cellular calls, are not automatically captured. Routing and missed-call handling must set expectations for nonemergency use before production.

COM-07 through COM-09 now have native/browser quality controls, audio-first policy, receive requests, and coordinated audio-only implementation. Browser/server changes are deployed and automated media checks pass; physical-device acceptance remains open. Experimental 4K stays disabled pending device/route verification. The separate Send video/camera controls affect local video; use Audio only for coordinated suppression. See [implementation plan](plans/0003-adaptive-call-quality.md) and [verification](testing/2026-11-17-adaptive-quality.md). Ceilings are limits, not guaranteed output.

### Time and activity ledger

| ID | Requirement | Acceptance |
| --- | --- | --- |
| TIME-01 | Automatically create draft activity from connected app/video/telephone calls. | Preserve raw lifecycle events; separate ringing, connected segments, hold/voicemail classification where observable, and after-call work. No claim that every connected second qualifies. |
| TIME-02 | Measure active text composition. | Track active draft sessions in the app, pause on inactivity/background/navigation, and permit a quick correction. Sending a message does not determine composition duration. |
| TIME-03 | Support measured/reviewed text reading sessions. | Track foreground viewing as an estimate, apply idle handling, and obtain staff confirmation; message arrival/delivery/read receipt is never substituted for staff reading duration. |
| TIME-04 | Manual timers and retrospective entries for other care work. | Support chart review, coordination, documentation, and work outside the app with timestamps, task type, clinical purpose, and source. |
| TIME-05 | Separate measured duration, reviewed duration, and billing allocation. | Draft, reviewed, approved, excluded, and corrected states preserve original observations and actor/reason/history. Confirming time is distinct from approving reimbursement. |
| TIME-06 | Detect overlapping/duplicate work. | Flag the same staff member's overlapping entries and prevent double allocation of the same work to patients/services. Do not reject legitimate contributions from different staff solely because their wall-clock intervals overlap. |
| TIME-07 | Reliable patient/month totals. | Store integer seconds and UTC timestamps; use a configured practice timezone for month boundaries; specify rules for calls spanning months and aggregate before display rounding. |
| TIME-08 | Role-aware review and configuration. | Reports distinguish practitioner and clinical-staff work; eligibility rules are versioned and approved separately from instrumentation. |

### Transcription and roles

| ID | Requirement | Acceptance |
| --- | --- | --- |
| TX-01 | Obtain and retain applicable recording/transcription consent before capture. | Record consent state/event and participants; declining permits an unrecorded call; CCM enrollment and recording consent are separate. Consent policy receives appropriate review before clinical deployment. |
| TX-02 | Transcribe with timestamps and speaker/role labels. | Attribute the authenticated team endpoint to staff identity/role, and use patient/caregiver/unknown labels for the other endpoint pending confirmation. Separate channels/tracks are preferred when supported. |
| TX-03 | Correct transcription and attribution errors. | Users can correct text and roles while preserving original/version history. Multiple speakers on one phone remain explicitly uncertain. Transcripts are drafts until reviewed. |
| TX-04 | Controlled lifecycle and failure handling. | Report processing/failure states; make retention, deletion, storage permissions, and provider coverage explicit before enabling real data. Calls and time entries survive a transcription failure. |
| TX-05 | Shared post-call transcript linked to call history. | Both authorized participants see the same durable call record and speaker/role-labeled transcript after processing. Show Off, Processing, Ready, Failed, or partial status. Consent/toggle Off prevents recording/upload/transcription for the affected interval; the call and its log still work. Retained audio is playable under TX-06; retention duration/deletion remains a separate choice. Source-linked AI clinical draft notes are planned separately under 0015 and remain unimplemented. |
| TX-06 | Play saved call audio from the call log. | Both authorized participants can play, pause, and seek a consented retained recording after the call. Access is checked before playback; recordings are private and linked to the call ID. Show unavailable/not-recorded/partial/deleted states honestly. Transcription failure does not erase an otherwise valid call record or playable recording. Retention/deletion policy remains to be selected. |
| TX-07 | Transcribe independent recorded audio/video messages. | Preserve a communication-scoped source/asset/version identity, explicit processing preference/notice, bounded retry-safe jobs, honest Off/Processing/Ready/Failed/Expired states and traceable corrections. Known submitting account/role does not establish every physical speaker. Media remains usable when transcription fails or is off; text messages use original text directly. |
| TX-08 | Source-linked concise AI clinical draft notes with human review. | Generate from pinned transcript/text versions, preserving selected same-patient source membership and provenance. Mark AI draft until authorized review/edit/approval; source corrections flag stale drafts without overwriting approved notes. Preserve meaning/uncertainty, link back to source, bound provider requests/cost and treat source instructions as untrusted. Prototype notes are staff-only; patient publication requires an explicit policy/action. No autonomous clinical decisions, sending or task resolution. |

### Reporting and product operation

| ID | Requirement | Acceptance |
| --- | --- | --- |
| REP-01 | Export encounter/activity records and patient/month summaries. | CSV includes patient identifier, date, timestamps/timezone, staff ID/role, activity type, duration in seconds, review status, clinical-purpose note where selected, and source encounter ID. Display names are optional. |
| REP-02 | Reproducible exports. | Record report range, timezone, included statuses, generation time, and applicable rule version. Corrections remain traceable. Handle CSV formula injection in user-supplied fields. |
| REP-03 | Provider and patient call history. | Call entries retain participants, patient association, direction, timestamps, connected duration, outcome, and transcript status. Provider access is limited to authorized patients; patient access to their own records. Missed/declined/canceled calls and transcription failures remain visible. A call ID connects both views and prevents duplicate records. |
| REP-04 | Unified patient communication history with controlled audience. | Authorized views show patient-linked call and published message entries in stable paginated order, preserving original source IDs. Patient sees shared communications and eligible retained media; care team can additionally access internal work records under separate permissions. Draft/failed uploads remain sender-only; Available never implies listened/read. Account enrollment and phone-number changes do not create a second patient history. |
| REP-05 | Unified communication log, grouping and filters. | Provide authorized practice overview and patient timeline with patient name/ID, date/time, accessible type icon, sender/direction, intended recipient, work owner and action badge. Separate format, interaction and channel. Needs attention/Assigned to me/All and source/type/person/date filters have stable pagination/counts/timezone semantics. Replace duplicate history UI while preserving source-specific call access and active call controls. |
| REP-06 | Communication detail retains source and separates derived artifacts/audiences. | Detail exposes authorized Original, Transcript, Clinical notes and Staff discussion with independent availability/review/expiry. Preserve exact accepted originals for new media plus playback derivatives under explicit retention/quotas; report older originals unavailable where already deleted. Versioned transcripts/notes/comments retain source references; internal notes/comments/time records stay outside patient payloads. Original text is immutable or revision-traceable. |
| OPS-01 | Agent-managed schema changes and reproducible setup. | Every persistent schema change has a committed migration, an identified target environment, verification, and recovery instructions. |
| OPS-02 | Maintainable iterative delivery. | Each substantial feature has a plan, acceptance evidence, updated project state, relevant tests, and recorded decisions. |
| OPS-03 | Future privacy/security and production readiness. | Before real patient use, complete applicable vendor/BAA review, access controls, auditability, encryption, retention, backups/recovery, logging/notification policy, messaging consent, and recording-law review. No POC compliance claim. |

UI implementation plan: [0016 communication history usability](plans/0016-communication-history-usability.md) consolidates owner refinements to REP-04–06/PAT-04–05 and media presentation: full-width history/overlay, quiet refresh, role-aware patient selection, Reply controls, playback scrubbers and calendar date filters. Media/Transcript/Summary is future detail navigation; existing artifact access/retention requirements remain unchanged. Implemented/deployed to development; native installation/device acceptance is tracked in current state.

## Intended workflows

Preferred workflow: provider and patient use Phoneapp for calls and recorded messages, preserving patient-linked communication evidence. Provider can also call a patient's cell/landline from an app button using the practice Twilio number; patients without Phoneapp can dial that number normally. Eventual telephone recordings/transcripts join the same history after matching/confirmation, and later verified app enrollment exposes the eligible existing patient-visible history. Telephone integration and call transcription remain unimplemented. [0012](plans/0012-audio-messages-shared-history.md) first proves recorded audio messaging and late-enrollment history access; [0007](plans/0007-provider-patient-calls-transcripts.md) retains the broader call/transcript direction.

1. Staff select a patient and contact, call or open a message conversation, and perform care work.
2. The app creates draft activity with measured duration and source evidence. A quick after-work prompt captures clinical purpose and corrections.
3. Unknown/shared incoming numbers enter a resolution queue; staff confirm the patient and contact relationship before allocation.
4. Authorized reviewers resolve overlaps and approve/exclude time. Practitioner work and clinical-staff work remain identifiable.
5. The practice exports the selected period for billing review. A duration threshold does not automatically submit a claim.

## Success criteria

- M1: both physical devices complete audio-only and video calls, including Wi-Fi/cellular and forced TURN relay, and repeat a call after hangup.
- Later workflow pilots: staff can capture and review small increments without reconstructing their entire day. Measure correction rate, missed-activity reports, and review effort before setting numerical targets.
- Activity totals reconcile to their underlying entries; duplicate callbacks and client reconnects do not inflate duration.
- No real patient data, recordings, or billing decisions are required to validate the experiment.

## Open product decisions

- Provider/patient packaging: one authenticated app with role-specific screens for the next prototype, or distinct installable variants sharing core code. Backend permission boundaries are required for either choice.
- Recorded audio/video playback works under 0012/0014. Live-call capture/consent, future exact-original preservation, transcript/note retention and patient publication of reviewed clinical notes need explicit policy under 0015; current seven-day synthetic media limits do not select production retention.
- Speech/AI providers/models, processing budgets and evaluation; native live-call media recording design; practice display timezone; future team membership/organization onboarding. These are later-stage decisions and do not block the first unified-log implementation.

- Practice/team/individual phone-number ownership and call distribution; no-answer/after-hours handling.
- Preferred browser video provider and whether a managed media service should replace the M1 direct WebRTC path.
- Practice timezone, billing review permissions, and export destination/EHR requirements.
- Default idle rules for reading/composition and handling unsent drafts; validate with staff rather than infer a billing rule.
- Production hosting/database provider, authentication, retention, and production agreements. Local MariaDB is selected for synthetic development; this does not select production services.
- Exact payer rules, staff eligibility, and MDM/time treatment; validate before implementing a billing engine.

## References

These are design inputs, not frozen billing or legal specifications. Recheck applicability when implementing the relevant milestone.

- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo WebRTC config plugin and compatibility matrix](https://github.com/expo/config-plugins/blob/main/packages/react-native-webrtc/README.md)
- [Twilio Voice React Native SDK](https://www.twilio.com/docs/voice/sdks/react-native)
- [CMS chronic care management guidance](https://www.cms.gov/files/document/chroniccaremanagement.pdf)
- [CMS CCM FAQs](https://www.cms.gov/files/document/chronic-care-management-faqs.pdf)
- [Twilio HIPAA account requirements](https://www.twilio.com/docs/iam/twilio-editions/hippa)
