# 0012 Audio messages and shared patient history

Status: implemented and deployed to development; both final previews/package checks pass; remaining physical acceptance open. Updated: 2026-11-18.

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

- [Evidence report](../testing/2026-11-18-audio-messages.md) records implemented scope, exact tests/build IDs, rollout and remaining physical gates. Migration 0005 and private storage are deployed; public synthetic upload/conversion/history/Range playback passes.
- `patients`, bindings and assignments supply stable identity and current access; messages remain independent from call-scoped recording/transcript tables. Combined call/message history preserves source IDs and call participation rules. Late verified enrollment is covered with isolated fixtures.
- Native Expo Audio 57.0.5, FileSystem 57.0.7 and Asset 57.0.21 are pinned, with a version-guarded native foreground/interruption patch. Browser uses actual MediaRecorder/fetch/Blob playback. Message transfers use short-lived JSON-issued grants outside the serialized identity queue (ADR 0008), rather than new native broker methods.
- FFmpeg/FFprobe 4.4.2 run actual tested conversions with local format/protocol/resource limits, one worker and low priority. Processing lease/orphan recovery, remote-reference refusal and scoped metadata/file restore pass. These controls do not establish a full OS decoder sandbox, host encryption or production disaster recovery.
- TypeScript, 58 existing unit tests, five message-client cases, eight message integration scenarios (including Chromium UI), DB clean/v4 upgrade/recovery/grants, existing account/native and 13 local/public browser call cases pass. Both native JS exports, prebuild and EAS archive inclusion/exclusion pass. Final native previews with the history-refresh fix are FINISHED on both platforms; see evidence/current state for IDs.
- Owner installed iPhone preview 9242ea52 and confirms recording/sending; subsequent feedback confirms provider playback of the patient message. Reverse playback/reply, other native audio controls/interruptions and remaining 0011 hardware cases still need explicit results. Browser Provider-only code was reissued privately on request.

## User experience and visibility

Provider selects a patient and opens Communication history. Existing Call controls remain; Record audio message works even when the patient is not enrolled. Patient opens their history and uses Record reply, addressed to the original provider. A new patient-originated message can target an active assigned provider; with the current one-provider seed this choice is automatic. For multiple assignments show an explicit recipient chooser. Shared triage queues are later work.

Messages are patient-visible communications. No internal notes or staff-only activity details enter the patient feed. Current authorized care-team members can review a patient's published messages; the addressed staff recipient is retained for routing and future inbox work. A patient/self binding can see that patient's published history, including messages sent before enrollment. Caregivers require a current explicit binding; do not infer historical access from a telephone number. Any narrower caregiver history policy must be explicit before caregiver functionality is exposed.

Validate current account status, patient binding/assignment, visibility and asset availability on every list, upload, publish and playback request. A message's creation-time role/label remains an attribution snapshot, not permanent access permission. Revocation or reassignment must prevent new requests and stop/clear active playback on clients when observed. Sender-only pending/failed drafts never leak to recipients.

The first version discovers messages through authenticated refresh/polling while the app/page is visible and refresh on foreground return. Add a simple new-message indicator relative to the viewer's last displayed timeline if useful; do not label it a verified read/listened receipt. There is no background message notification in this slice. Never use a VoIP call push or fake incoming call to announce a saved message.

## Implementation steps

Implementation decision: [ADR 0008](../decisions/0008-audio-messages.md) selects short-lived, session-bound media grants through the existing JSON credential broker instead of extending native binary methods. Transfers run outside the call-control queue. Private filesystem storage and pinned Expo 57 recorder/player are selected for the synthetic POC.

### 1. Record contracts and compatibility decisions

- [x] Inspect current native audio/session owners, secure account transport, browser build and runtime grants. Use an isolated implementation checkout while the canonical checkout serves calls.
- [x] Record an ADR covering private POC storage, message/asset schema, access matrix, supported media formats, proposed limits/retention and native transport changes. Distinguish accepted user requirements from implementation defaults.
- [ ] Prototype native Expo 57 recording/playback and browser `MediaRecorder` with runtime codec checks; verify native/browser-produced samples can be decoded and played on all intended recipients. Pin compatible dependencies and lockfile; configure foreground-only recording/playback explicitly.
- [x] Verify FFmpeg/FFprobe suitability before accepting untrusted files; document any maintenance/update dependency and its project-scoped deployment. Resolve codec failures with a bounded normalization path, not filename changes.

### 2. Add persistence and patient-history access

- [x] Add the next immutable migration, provisionally `0005_audio_messages.sql` (confirm numbering at implementation), under the existing runner. Keep migrations 0001–0004 unchanged.
- [x] Introduce audio messages, private message assets and durable processing jobs or equivalent leased state. Store patient ID, authenticated sender, role/label snapshot, recipient staff routing where applicable, visibility, creation/published timestamps, stable request key, asset status/hash/bytes/verified duration/type, retention and sanitized failure metadata.
- [x] Enforce patient/asset scope with composite keys or equivalent DB constraints; unique sender/request key prevents duplicate messages. Do not weaken existing call-scoped recording/transcription constraints. Preserve future source-kind/provider-reference extension without implementing telephone ingestion now.
- [x] Add a stable, paginated communication timeline using a deterministic `(timestamp, kind, id)` cursor. Merge calls and published messages without rewriting call records or inventing call participation; sender can separately reconcile their pending sends.
- [x] Define eligibility for existing call entries under current participant/binding rules explicitly; do not broaden every historical call's audience as a side effect of adding messages. Test late enrollment for patient-visible message history now; future telephone-history linking follows PAT-05.
- [x] Review scoped runtime grants, then test clean install, v4 upgrade/data preservation and failure recovery in `phoneapp_test`. Record snapshot and checksum evidence before development migration.

### 3. Implement private media storage and upload lifecycle

- [x] Isolate file operations behind the server Messages boundary and exercise the same implementation with a dedicated temporary root in tests. Selected first development backend: project-owned filesystem storage outside the repository and all nginx web roots, such as `/var/lib/phoneapp/media`, with owner-only directories/files and explicit capacity/backup policy. This avoids requiring a new paid storage service for synthetic POC data. A dedicated private S3 adapter is a later option; do not assume bucket/IAM permissions exist.
- [x] Define small authenticated JSON endpoints to create/reconcile a send, complete/publish it, and fetch timeline/media metadata. Use a dedicated bounded binary upload route rather than increasing every JSON API limit or embedding base64 media in JSON. Endpoint names are proposed until implementation.
- [x] Create an authorized upload intent with a stable client request UUID. Stream into a server-chosen temporary object; never accept client filesystem paths, remote media URLs or arbitrary object keys. Check authenticated ownership, byte limits and expiry before and during upload; reject unsupported streams and incomplete data.
- [x] Verify actual container/audio streams, duration and content hash. Normalize supported native M4A/AAC and browser WebM/Opus or MP4 inputs to a tested audio-only playback format (proposed AAC in M4A). Strip extraneous metadata; reject video, empty/invalid/oversized/overlong clips. Client duration/MIME is advisory.
- [x] Run parsing/transcoding off the request/event loop with one bounded worker initially, a restricted local-file protocol/input allowlist, argument-array invocation (no shell), time/resource/output limits and no remote fetches. Keep processing separate from signaling so it cannot starve active calls.
- [x] Atomically finalize the asset before marking the message Available. Persist worker leases/retry state; restart/crash between file write and DB publication must reconcile idempotently. Delete abandoned temporary objects and unreferenced output after a grace period, preserving in-flight work.
- [x] Provide authenticated, seekable playback (`Range`, correct MIME/length, private/no-store cache headers). Use native authenticated download to app-private temporary files if the player cannot attach the existing authorization securely; use browser authenticated fetch/Blob playback. Never put long-lived session tokens in media URLs or expose storage paths in API responses/logs.
- [x] Keep existing 4 KiB JSON limits. Scope nginx upload/time limits only to the new media route and project hostname. Authenticate before accepting media and bound server/nginx temporary buffering, disk, request rate, per-user bytes and total worker backlog.
- [x] Implement retention/orphan cleanup with retryable object deletion and a retained unavailable/expired metadata entry. Asset bytes and DB metadata have separate recovery needs; a DB-only backup is insufficient for restoring playable messages.

### 4. Build native and browser compose/playback

- [x] Add native recording/playback through the pinned compatible Expo module and browser adapters using supported MIME detection. No autoplay of received audio. Permission denial provides recovery; reject unavailable browser capture cleanly.
- [x] Present record/stop, duration, preview, re-record/discard and explicit Send. No upload before Send. Stop capture on navigation/background/logout, incoming call or interruption; preserve a playable draft only if finalization succeeded. Never silently resume capture.
- [ ] Give live calling priority over message recording/playback. Stop/release the message audio owner before CallKit/Telecom/WebRTC activation; block starting a message during a call. Verify headset removal, earpiece/speaker behavior and audio-session cleanup on both platforms.
- [x] Preserve the existing native JSON credential broker and issue short-lived, session/message/operation-bound media grants. Native file transfers use those grants outside its queue; late completion rechecks session/binding revocation. This ADR 0008 decision replaces the originally proposed native binary methods.
- [x] Use cancellable bounded transfers and sender request keys to reconcile lost responses. A retry of identical content returns the same message; changed content requires a new key or is rejected as conflict. Disable double Send while preserving retry after an ambiguous result.
- [x] Expose Saving/Processing/Available/Failed honestly. Keep the draft after recoverable failure while the compose session remains alive; allow retry/discard. App termination/browser reload may discard an unsent local draft in this first version; show that limitation. After successful publication the server copy survives app close/reload. Durable offline/background upload queues are deferred.
- [x] Clear draft/media caches, Blob URLs and patient-specific state on logout/account switch; reject stale response adoption. Local native draft files get bounded cleanup on startup as well as logout.
- [x] Add combined call/message history and reply navigation to native and browser UIs. Existing old binaries keep their call workflow; native message capability is gated and prompts update where needed.

### 5. Verify, deploy and hand off

- [x] Run meaningful tests below; preserve existing account/media/TURN and native calling behavior. DB suites run sequentially on the established disposable target.
- [x] After test success, snapshot the development schema and relevant private config, apply the additive migration/grants, provision only project storage, and verify feature-disabled behavior before enabling `ENABLE_AUDIO_MESSAGES` (proposed name).
- [x] Verify source archives exclude all recordings, temporary media, DB credentials and server configuration. Rebuild native preview binaries with bundled JS because of the new native dependency/bridge; record exact IDs/outcomes and signed-call capability regression. Use existing authorized EAS workflow; record any real credential failure precisely.
- [x] Roll out project browser/backend changes between calls; avoid interrupting active owner calls. Test with synthetic recordings only. Keep background call acceptance from 0011 visible rather than marking it complete from message tests.
- [ ] Complete owner-operated iPhone/Android/browser acceptance, attach sanitized evidence, and update tools/database/state/roadmap/work log. Mark complete only after the stated cross-platform outcome is established.

## Data and configuration

Migration `0005_audio_messages.sql` is applied to `phoneapp` development and `phoneapp_test` after preservation/recovery checks and scoped runtime grants. Pre-migration snapshot and before-config/nginx/service backups are private audio-messages artifacts. No destructive down migration is provided.

Selected synthetic defaults: 180-second clips, 10 MiB input, 24h incomplete expiry, 7-day published audio, 100 sends/user/day, 50 MiB accepted input/user/day, 1 GiB store with 1 GiB free-space floor, two concurrent uploads and one converter. Store only the normalized playback asset after processing; preserve expired metadata. Configured names are `ENABLE_AUDIO_MESSAGES`, `MEDIA_STORAGE_ROOT`, optional `FFMPEG_PATH` and `FFPROBE_PATH`; other limits live in `server/messages.ts`, not the originally proposed MEDIA_* environment overrides. No storage provider credential was added.

Private root `/var/lib/phoneapp/media` is owner-only and explicitly writable within the existing read-only service sandbox. Host encryption and production retention/backup design remain separate. Scope all nginx/body/time changes to this project's media route and provision the directory before restarting the service. See [tools](../TOOLS.md).

The API owns access; nginx must not expose a static alias into the media root. Dev/test directories must be distinct. Test cleanup must verify a dedicated temporary root before removing files. Do not store recordings in Git, EAS archives, public `artifacts/public`, normal application logs or browser persistent storage. Reuse the existing native account keys; do not rotate the native push encryption key for this feature.

## Acceptance and verification

Automated/development outcomes below are recorded in the [evidence report](../testing/2026-11-18-audio-messages.md). Physical results are kept separate. `test:audio-messages` includes the browser UI; no separate browser-message script was needed.

| Requirement / scenario | Command or procedure | Expected | Actual / evidence |
| --- | --- | --- | --- |
| Planning artifacts | `python3 scripts/check_project.py`; `git diff --check` | References and whitespace valid | Pass at planning handoff; documentation/whitespace only |
| Schema and runtime isolation | `npm run test:db`, `npm run test:db:permissions` sequentially, with new migration fixtures | Clean/v4 upgrade preserve calls, credentials and existing media/transcript rows; grants scoped | Pass; see evidence |
| Message API/storage integration | `npm run test:audio-messages`, isolated MariaDB/temp storage and real media fixtures | Both directions, atomic publish, real decode/playback bytes, bounded work | Pass; see evidence |
| Retry/recovery | Concurrent Send, interrupted upload, lost response, duplicate completion, worker crash/restart and disk-full fixtures | One published message per key; no partial recipient asset; failure recoverable | Pass for implemented cases; see evidence |
| Media validation | Fake MIME, empty/truncated input, video payload, oversized/overlong recording, remote-reference file and decoder timeout fixtures | Reject safely; no remote fetch or unbounded work; no publication | Pass for implemented cases; see evidence |
| Access and visibility | Patient B/C, unassigned staff, revoked binding/device, guessed IDs, draft/failed assets, logout during upload/playback | No cross-patient/private-draft data; current authorization enforced; clients clear state | Pass for implemented cases; see evidence |
| Late enrollment | Provider sends to a synthetic unenrolled record; patient later redeems verified binding | Eligible pre-existing message visible under same patient/message IDs; unrelated patient denied | Pass for implemented cases; see evidence |
| Unified history | Interleaved call/message fixtures, equal timestamps, multiple pages and refresh | Stable order/no duplicate or missing cursor entries; calls retain original IDs/access | Pass for implemented cases; see evidence |
| Native/browser UI | `npm run test:audio-messages` (Chromium UI included); capture permission/retry/pause/seek cases | Actual browser-produced message retrievable/playable; honest states | Pass; see evidence |
| Existing regression | `npm run typecheck`, `npm test`, `npm run test:account-client`, `npm run test:native-calls`, `npm run test:accounts`, `npm run test:browser`; DB suites sequentially | Existing identity/calling/audio/video/history/relay tests pass | Pass; see evidence |
| Packaging and compilation | `npm run bundle:check`; inspect EAS archive; new physical `preview` builds | Both compile, bundled JS, call capability retained, no server/media files shipped | Pass; final previews FINISHED, package checks recorded |
| Delayed recipient playback | Browser Provider sends, closes page; native patient opens later, plays/seeks and replies; reverse with provider phone | Both directions audibly work after sender closes; no simultaneous connection needed | Owner device test pending |
| Cross-platform audio formats | Browser → iPhone/Android; iPhone → browser/Android; Android → browser/iPhone | Intelligible retained audio, correct duration and seek/play/pause | Owner device test pending |
| Audio ownership/interruption | Incoming native call during compose/preview/playback; background, lock, headset removal and account switch | Capture/player releases, call audio works, no silent recording restart or cross-account cache | Owner device test pending |
| Retention and deployment | Shortened test TTL, failed delete/retry, backup restore in isolated directory, feature off/on | Audio becomes unavailable honestly; no orphan growth; existing calls remain usable | Pass for implemented cases; see evidence |

## Risks and recovery

- Codec/container differences and native audio ownership are the main device risks. Validate them before building the entire UI; a successful JS export is not native audio acceptance.
- File decoding/upload/conversion can consume EC2 resources used by calls. Bound and isolate workers, reject capacity exhaustion early, and measure call regression during processing. Pause message ingestion if calling degrades.
- Publication races and lost responses can leak incomplete assets or duplicate messages. Use stable request keys, explicit states and leased jobs; preserve committed metadata through retries.
- Local POC storage shares an EC2 failure domain; confirm space, permissions, encryption characteristics and combined DB/media backup/recovery. Do not describe the POC store as a production archival solution.
- A playing/downloaded file cannot be retroactively erased from a recipient's memory. Recheck authorization for new transfers, abort/clear client playback on observed revocation, and avoid promising immediate revocation of already-downloaded bytes.
- Disable the new feature flag/worker and hide compose/playback if recovery is needed; keep calling and historical metadata. Preserve migration history and files pending reconciliation. Fix forward or restore a rehearsed project-scoped backup; never drop populated message tables to roll back code.

## Handoff

Implemented source/backend/browser and development migration/storage are available. Eight message integration scenarios and five client tests pass alongside calling regressions; public media smoke passes after the scoped service write-path fix. Owner confirms iPhone recording/sending on the first message preview. Final preview IDs/status and the private Provider enrollment file are recorded in [current state](../PROJECT_STATE.md). Native physical playback/reply/cross-platform/interruption acceptance remains open; do not mark this plan complete from compilation or an accepted upload.

Next action: record owner results for native/browser playback/reply, no automatic recording restart, call priority, background/headset/logout/expiry and outstanding 0011 cases. No repeat Apple authentication is needed without a concrete new signing failure. Preserve development data and disable the message flag on current schema-compatible code if recovery is needed.

Primary references reviewed for planning: [Expo 57 audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/) for native recording/playback/configuration; [W3C MediaStream Recording draft](https://www.w3.org/TR/mediastream-recording/) for browser recording/format negotiation; [FFmpeg documentation](https://ffmpeg.org/ffmpeg.html) for conversion design. These references support platform feasibility, not verified compatibility of an installed feature. See [S3 public-access controls](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html) if a later implementation selects that storage backend.
