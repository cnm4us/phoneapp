# 0012 Audio messages and shared patient history

Status: implementation in progress in isolated stage12; automated/native build and deployment gates being recorded. Updated: 2026-11-18.

## Outcome and scope

Provider and patient can record, preview, send and later play short audio messages in one patient-linked communication history. The recipient can be offline when a message is sent. History belongs to a permanent patient record and survives app enrollment, sign-out and reinstall. Existing calls continue working.

This is the next small increment after [0011 native calling](0011-native-background-incoming-calls.md), advancing M2/M4 and laying groundwork for M5. Requirements: PAT-01, PAT-05, TEAM-01–02, COM-06, COM-12, REP-03–04, TIME-05–06 and OPS-01–02 in the [PRD](../PRD.md). Related direction: [0007](0007-provider-patient-calls-transcripts.md). Original M1 and outstanding 0011 hardware acceptance remain open.

Included:

- Native iPhone/Android and desktop browser recording and playback, so the owner can test browser provider ↔ phone patient.
- Record → Stop → Preview → Re-record/Discard → Send; recipient can Play/Pause/Seek and reply with another recording.
- Patient communication history combining existing call entries and audio-message entries, with sender/role, direction, date, duration and honest availability/failure states.
- Provider can address an authorized patient record before that patient has enrolled. Later verified enrollment exposes eligible existing messages without copying records or changing patient IDs.
- Private file storage, durable metadata, bounded uploads/processing, idempotent send/retry and retention cleanup.
- Sender sees Saving/Processing/Available/Failed; recipients see only published messages. Available means stored and authorized for retrieval, not that the recipient received a notification or listened.

Deferred: video messages; live-call recording; transcription/LLM summaries; patient-initiated live calls and automatic no-answer voicemail; Twilio/PSTN/SMS; shared practice triage/assignment workflows; production identity or arbitrary self-service patient linking; clinical/internal-note editor; staff listening/composition timers, billing allocation and exports. No audio work-time credit is created from clip length or playback in this increment. Existing call timing is preserved.

## Current evidence

- [Current state](../PROJECT_STATE.md) records deployed account calls, four applied dev/test migrations, browser/native calling and preview builds. Owner reports successful iPhone incoming ringing after a described swipe-away. Android/locked/reboot/control matrix is still incomplete.
- `patients`, `patient_accounts` and `patient_assignments` already separate record identity from account identity; synthetic A/B/C records and owner-issued enrollment exist. Verify late enrollment using an isolated fixture rather than disabling a real enrolled owner's device.
- `calls` and its participants/events are durable. `recording_assets` and transcription tables are **call-scoped**; they do not currently store messages or playable files. Do not manufacture calls/participants just to attach a message recording.
- `shared/accounts.ts` exposes call history, not a unified communication timeline. Current account API JSON bodies are capped at 4 KiB. Native account transport is a serialized authenticated JSON bridge; browser uses an in-memory bearer credential. Binary upload/playback needs deliberate transport work.
- No message recorder, private media store, upload routes, cleanup worker or playback authorization exists. `expo-audio` is not installed. SDK is pinned at Expo 57; use its compatible module version, not an unreviewed SDK upgrade.
- EC2 has `/usr/bin/ffmpeg` and `/usr/bin/ffprobe` (4.4.2 observed). Actual codec support, decoder maintenance/security, bounded execution and cross-platform sample compatibility still need verification before processing uploaded recordings.
- Existing command inventory is in [tools](../TOOLS.md); DB and verification rules are in [database](../DATABASE.md) and [testing](../TESTING.md). No migration, dependency, storage provisioning, feature enablement or new cloud build is performed by this plan.

## User experience and visibility

Provider selects a patient and opens Communication history. Existing Call controls remain; Record audio message works even when the patient is not enrolled. Patient opens their history and uses Record reply, addressed to the original provider. A new patient-originated message can target an active assigned provider; with the current one-provider seed this choice is automatic. For multiple assignments show an explicit recipient chooser. Shared triage queues are later work.

Messages are patient-visible communications. No internal notes or staff-only activity details enter the patient feed. Current authorized care-team members can review a patient's published messages; the addressed staff recipient is retained for routing and future inbox work. A patient/self binding can see that patient's published history, including messages sent before enrollment. Caregivers require a current explicit binding; do not infer historical access from a telephone number. Any narrower caregiver history policy must be explicit before caregiver functionality is exposed.

Validate current account status, patient binding/assignment, visibility and asset availability on every list, upload, publish and playback request. A message's creation-time role/label remains an attribution snapshot, not permanent access permission. Revocation or reassignment must prevent new requests and stop/clear active playback on clients when observed. Sender-only pending/failed drafts never leak to recipients.

The first version discovers messages through authenticated refresh/polling while the app/page is visible and refresh on foreground return. Add a simple new-message indicator relative to the viewer's last displayed timeline if useful; do not label it a verified read/listened receipt. There is no background message notification in this slice. Never use a VoIP call push or fake incoming call to announce a saved message.

## Implementation steps

Implementation decision: [ADR 0008](../decisions/0008-audio-messages.md) selects short-lived, session-bound media grants through the existing JSON credential broker instead of extending native binary methods. Transfers run outside the call-control queue. Private filesystem storage and pinned Expo 57 recorder/player are selected for the synthetic POC.

### 1. Record contracts and compatibility decisions

- [ ] Inspect current native audio/session owners, secure account transport, browser build and runtime grants. Use an isolated implementation checkout while the canonical checkout serves calls.
- [ ] Record an ADR covering private POC storage, message/asset schema, access matrix, supported media formats, proposed limits/retention and native transport changes. Distinguish accepted user requirements from implementation defaults.
- [ ] Prototype native Expo 57 recording/playback and browser `MediaRecorder` with runtime codec checks; verify native/browser-produced samples can be decoded and played on all intended recipients. Pin compatible dependencies and lockfile; configure foreground-only recording/playback explicitly.
- [ ] Verify FFmpeg/FFprobe suitability before accepting untrusted files; document any maintenance/update dependency and its project-scoped deployment. Resolve codec failures with a bounded normalization path, not filename changes.

### 2. Add persistence and patient-history access

- [ ] Add the next immutable migration, provisionally `0005_audio_messages.sql` (confirm numbering at implementation), under the existing runner. Keep migrations 0001–0004 unchanged.
- [ ] Introduce audio messages, private message assets and durable processing jobs or equivalent leased state. Store patient ID, authenticated sender, role/label snapshot, recipient staff routing where applicable, visibility, creation/published timestamps, stable request key, asset status/hash/bytes/verified duration/type, retention and sanitized failure metadata.
- [ ] Enforce patient/asset scope with composite keys or equivalent DB constraints; unique sender/request key prevents duplicate messages. Do not weaken existing call-scoped recording/transcription constraints. Preserve future source-kind/provider-reference extension without implementing telephone ingestion now.
- [ ] Add a stable, paginated communication timeline using a deterministic `(timestamp, kind, id)` cursor. Merge calls and published messages without rewriting call records or inventing call participation; sender can separately reconcile their pending sends.
- [ ] Define eligibility for existing call entries under current participant/binding rules explicitly; do not broaden every historical call's audience as a side effect of adding messages. Test late enrollment for patient-visible message history now; future telephone-history linking follows PAT-05.
- [ ] Review scoped runtime grants, then test clean install, v4 upgrade/data preservation and failure recovery in `phoneapp_test`. Record snapshot and checksum evidence before development migration.

### 3. Implement private media storage and upload lifecycle

- [ ] Use a storage interface with an isolated temporary-directory adapter in tests. Proposed first development backend: project-owned filesystem storage outside the repository and all nginx web roots, such as `/var/lib/phoneapp/media`, with owner-only directories/files and explicit capacity/backup policy. This avoids requiring a new paid storage service for synthetic POC data. A dedicated private S3 adapter is a later option; do not assume bucket/IAM permissions exist.
- [ ] Define small authenticated JSON endpoints to create/reconcile a send, complete/publish it, and fetch timeline/media metadata. Use a dedicated bounded binary upload route rather than increasing every JSON API limit or embedding base64 media in JSON. Endpoint names are proposed until implementation.
- [ ] Create an authorized upload intent with a stable client request UUID. Stream into a server-chosen temporary object; never accept client filesystem paths, remote media URLs or arbitrary object keys. Check authenticated ownership, byte limits and expiry before and during upload; reject unsupported streams and incomplete data.
- [ ] Verify actual container/audio streams, duration and content hash. Normalize supported native M4A/AAC and browser WebM/Opus or MP4 inputs to a tested audio-only playback format (proposed AAC in M4A). Strip extraneous metadata; reject video, empty/invalid/oversized/overlong clips. Client duration/MIME is advisory.
- [ ] Run parsing/transcoding off the request/event loop with one bounded worker initially, a restricted local-file protocol/input allowlist, argument-array invocation (no shell), time/resource/output limits and no remote fetches. Keep processing separate from signaling so it cannot starve active calls.
- [ ] Atomically finalize the asset before marking the message Available. Persist worker leases/retry state; restart/crash between file write and DB publication must reconcile idempotently. Delete abandoned temporary objects and unreferenced output after a grace period, preserving in-flight work.
- [ ] Provide authenticated, seekable playback (`Range`, correct MIME/length, private/no-store cache headers). Use native authenticated download to app-private temporary files if the player cannot attach the existing authorization securely; use browser authenticated fetch/Blob playback. Never put long-lived session tokens in media URLs or expose storage paths in API responses/logs.
- [ ] Keep existing 4 KiB JSON limits. Scope nginx upload/time limits only to the new media route and project hostname. Authenticate before accepting media and bound server/nginx temporary buffering, disk, request rate, per-user bytes and total worker backlog.
- [ ] Implement retention/orphan cleanup with retryable object deletion and a retained unavailable/expired metadata entry. Asset bytes and DB metadata have separate recovery needs; a DB-only backup is insufficient for restoring playable messages.

### 4. Build native and browser compose/playback

- [ ] Add native recording/playback through the pinned compatible Expo module and browser adapters using supported MIME detection. No autoplay of received audio. Permission denial provides recovery; reject unavailable browser capture cleanly.
- [ ] Present record/stop, duration, preview, re-record/discard and explicit Send. No upload before Send. Stop capture on navigation/background/logout, incoming call or interruption; preserve a playable draft only if finalization succeeded. Never silently resume capture.
- [ ] Give live calling priority over message recording/playback. Stop/release the message audio owner before CallKit/Telecom/WebRTC activation; block starting a message during a call. Verify headset removal, earpiece/speaker behavior and audio-session cleanup on both platforms.
- [ ] Extend the native credential broker with constrained file-upload and media-download methods using the same account epoch, serialized refresh and revocation rules; do not expose persistent refresh credentials or arbitrary URLs/paths to JS. Large media transfers must not hold the credential/control queue for their entire duration or block Answer/End.
- [ ] Use cancellable bounded transfers and sender request keys to reconcile lost responses. A retry of identical content returns the same message; changed content requires a new key or is rejected as conflict. Disable double Send while preserving retry after an ambiguous result.
- [ ] Expose Saving/Processing/Available/Failed honestly. Keep the draft after recoverable failure while the compose session remains alive; allow retry/discard. App termination/browser reload may discard an unsent local draft in this first version; show that limitation. After successful publication the server copy survives app close/reload. Durable offline/background upload queues are deferred.
- [ ] Clear draft/media caches, Blob URLs and patient-specific state on logout/account switch; reject stale response adoption. Local native draft files get bounded cleanup on startup as well as logout.
- [ ] Add combined call/message history and reply navigation to native and browser UIs. Existing old binaries keep their call workflow; native message capability is gated and prompts update where needed.

### 5. Verify, deploy and hand off

- [ ] Run meaningful tests below; preserve existing account/media/TURN and native calling behavior. DB suites run sequentially on the established disposable target.
- [ ] After test success, snapshot the development schema and relevant private config, apply the additive migration/grants, provision only project storage, and verify feature-disabled behavior before enabling `ENABLE_AUDIO_MESSAGES` (proposed name).
- [ ] Verify source archives exclude all recordings, temporary media, DB credentials and server configuration. Rebuild native preview binaries with bundled JS because of the new native dependency/bridge; record exact IDs/outcomes and signed-call capability regression. Use existing authorized EAS workflow; record any real credential failure precisely.
- [ ] Roll out project browser/backend changes between calls; avoid interrupting active owner calls. Test with synthetic recordings only. Keep background call acceptance from 0011 visible rather than marking it complete from message tests.
- [ ] Complete owner-operated iPhone/Android/browser acceptance, attach sanitized evidence, and update tools/database/state/roadmap/work log. Mark complete only after the stated cross-platform outcome is established.

## Data and configuration

No schema changes are executed during planning. Development target is `phoneapp`; destructive isolated tests target only `phoneapp_test`. Next migration numbering, actual grants and snapshot reference must be recorded during implementation. No generic reset/down migration for populated development.

Proposed POC defaults: 180-second clip maximum, 10 MiB input maximum, 24-hour incomplete-upload expiry, seven-day published-audio retention, one conversion worker. Retain only the playback asset after processing; remove original/temporary files promptly. Before enablement, select explicit per-user/day upload and global disk/backlog limits based on measured host capacity, and set a minimum free-space cutoff. These are synthetic-test defaults, not clinical retention policy. Display expiry in the UI; don't imply permanent audio availability. Preserve message metadata as an expired/unavailable entry after audio removal.

Proposed configuration names: `ENABLE_AUDIO_MESSAGES`, `MEDIA_STORAGE_BACKEND`, `MEDIA_STORAGE_ROOT`, `MEDIA_MAX_DURATION_SECONDS`, `MEDIA_MAX_UPLOAD_BYTES`, `MEDIA_UPLOAD_TTL_SECONDS`, `MEDIA_RETENTION_DAYS`, `MEDIA_MAX_STORAGE_BYTES`, `MEDIA_MIN_FREE_BYTES`, `MEDIA_MAX_USER_UPLOAD_BYTES_PER_DAY`, `FFMPEG_PATH`, `FFPROBE_PATH`. Finalize names/defaults in implementation and document only names/paths. No new provider secret is required for the local POC store; storage permissions and host encryption/backup capability still need explicit verification. A production storage/encryption design remains separate.

The API owns access; nginx must not expose a static alias into the media root. Dev/test directories must be distinct. Test cleanup must verify a dedicated temporary root before removing files. Do not store recordings in Git, EAS archives, public `artifacts/public`, normal application logs or browser persistent storage. Reuse the existing native account keys; do not rotate the native push encryption key for this feature.

## Acceptance and verification

All rows below are **not run for 0012**. Suggested new test scripts are proposals until actually implemented/documented in tools.

| Requirement / scenario | Command or procedure | Expected | Actual / evidence |
| --- | --- | --- | --- |
| Planning artifacts | `python3 scripts/check_project.py`; `git diff --check` | References and whitespace valid | Pass at planning handoff; documentation/whitespace only |
| Schema and runtime isolation | `npm run test:db`, `npm run test:db:permissions` sequentially, with new migration fixtures | Clean/v4 upgrade preserve calls, credentials and existing media/transcript rows; grants scoped | Not run for 0012 |
| Message API/storage integration | Proposed `npm run test:audio-messages`, isolated MariaDB/temp storage and real media fixtures | Both directions, atomic publish, real decode/playback bytes, bounded work | Not implemented/run |
| Retry/recovery | Concurrent Send, interrupted upload, lost response, duplicate completion, worker crash/restart and disk-full fixtures | One published message per key; no partial recipient asset; failure recoverable | Not run |
| Media validation | Fake MIME, empty/truncated input, video payload, oversized/overlong recording, remote-reference file and decoder timeout fixtures | Reject safely; no remote fetch or unbounded work; no publication | Not run |
| Access and visibility | Patient B/C, unassigned staff, revoked binding/device, guessed IDs, draft/failed assets, logout during upload/playback | No cross-patient/private-draft data; current authorization enforced; clients clear state | Not run |
| Late enrollment | Provider sends to a synthetic unenrolled record; patient later redeems verified binding | Eligible pre-existing message visible under same patient/message IDs; unrelated patient denied | Not run |
| Unified history | Interleaved call/message fixtures, equal timestamps, multiple pages and refresh | Stable order/no duplicate or missing cursor entries; calls retain original IDs/access | Not run |
| Native/browser UI | Proposed `npm run test:audio-messages:browser`; capture permission/retry/pause/seek cases | Actual browser-produced message retrievable/playable; honest states | Not implemented/run |
| Existing regression | `npm run typecheck`, `npm test`, `npm run test:account-client`, `npm run test:native-calls`, `npm run test:accounts`, `npm run test:browser`; DB suites sequentially | Existing identity/calling/audio/video/history/relay tests pass | Not run for 0012 |
| Packaging and compilation | `npm run bundle:check`; inspect EAS archive; new physical `preview` builds | Both compile, bundled JS, call capability retained, no server/media files shipped | Not run |
| Delayed recipient playback | Browser Provider sends, closes page; native patient opens later, plays/seeks and replies; reverse with provider phone | Both directions audibly work after sender closes; no simultaneous connection needed | Owner device test pending |
| Cross-platform audio formats | Browser → iPhone/Android; iPhone → browser/Android; Android → browser/iPhone | Intelligible retained audio, correct duration and seek/play/pause | Owner device test pending |
| Audio ownership/interruption | Incoming native call during compose/preview/playback; background, lock, headset removal and account switch | Capture/player releases, call audio works, no silent recording restart or cross-account cache | Owner device test pending |
| Retention and deployment | Shortened test TTL, failed delete/retry, backup restore in isolated directory, feature off/on | Audio becomes unavailable honestly; no orphan growth; existing calls remain usable | Not run |

## Risks and recovery

- Codec/container differences and native audio ownership are the main device risks. Validate them before building the entire UI; a successful JS export is not native audio acceptance.
- File decoding/upload/conversion can consume EC2 resources used by calls. Bound and isolate workers, reject capacity exhaustion early, and measure call regression during processing. Pause message ingestion if calling degrades.
- Publication races and lost responses can leak incomplete assets or duplicate messages. Use stable request keys, explicit states and leased jobs; preserve committed metadata through retries.
- Local POC storage shares an EC2 failure domain; confirm space, permissions, encryption characteristics and combined DB/media backup/recovery. Do not describe the POC store as a production archival solution.
- A playing/downloaded file cannot be retroactively erased from a recipient's memory. Recheck authorization for new transfers, abort/clear client playback on observed revocation, and avoid promising immediate revocation of already-downloaded bytes.
- Disable the new feature flag/worker and hide compose/playback if recovery is needed; keep calling and historical metadata. Preserve migration history and files pending reconciliation. Fix forward or restore a rehearsed project-scoped backup; never drop populated message tables to roll back code.

## Handoff

Completed now: implementation plan and aligned requirements/roadmap/state/tool notes. Implementation is not started, storage not provisioned, migration not created/applied, new dependencies not installed and no new builds submitted. Next action is step 1: compatibility/audio ownership spike and implementation ADR, then schema/API/storage work in isolation. Routine development migrations remain agent-managed under existing authorization.

No owner credential/action is needed to write this plan. Later external dependencies are real iPhone/Android acceptance and any concrete EAS/storage permission issue found during implementation. Use local synthetic fixtures while resolving those; do not infer new approval requirements from a proposed storage alternative.

Primary references reviewed for planning: [Expo 57 audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/) for native recording/playback/configuration; [W3C MediaStream Recording draft](https://www.w3.org/TR/mediastream-recording/) for browser recording/format negotiation; [FFmpeg documentation](https://ffmpeg.org/ffmpeg.html) for conversion design. These references support platform feasibility, not verified compatibility of an installed feature. See [S3 public-access controls](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html) if a later implementation selects that storage backend.
