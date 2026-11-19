# 0014 Video messages in patient communication history

Status: implemented and deployed to development; both final previews/package checks pass; physical acceptance in progress. Updated: 2026-11-19 UTC (2026-11-18 America/Los_Angeles). Owner requested implementation after reviewing the plan. Work is isolated in `/home/ubuntu/phoneapp-stage14` on `feat/video-messages`.

## Outcome and scope

Providers and patients can leave short video messages with sound, preview/re-record them, send deliberately, and play/reply later through the same patient-linked communication history as audio messages and calls. Sender and recipient do not need to be online together. Keep the existing Audio message option and its behavior.

This extends [0012 audio messages](0012-audio-messages-shared-history.md) within M4. Requirements: COM-06, COM-12, PAT-01, PAT-05, TEAM-01–03, REP-04, TIME-05–06 and OPS-01–02 in the [PRD](../PRD.md). Preserve [0013 browser sessions](0013-persistent-browser-sign-in.md), [0011 native incoming calls](0011-native-background-incoming-calls.md), and the outstanding physical acceptance gates from those plans.

Included: native iPhone/Android and browser compose/playback; front/rear camera choice before recording; portrait/landscape handling; private thumbnail; duration, sender/role and availability states; bounded foreground upload with progress/retry; mixed audio/video history; authorization, processing, cleanup and recovery.

Deferred: video attachments from the photo library, editing/trimming, camera switching mid-recording, background recording/uploads, durable offline drafts, ordinary message push notifications, automatic no-answer voicemail, patient-initiated live calls, Twilio/PSTN/SMS, transcripts/summaries, organizations/staff administration and time billing. Regular telephone voicemail remains audio-only. No live call is recorded by this feature and clip/playback length never becomes approved staff time. Synthetic conversations only.

## Current evidence

Implementation decision: [ADR 0010](../decisions/0010-video-messages.md). Initial 120s synthetic 720p/30 conversion: 34.69s, 31,295,825-byte MP4, 5,543-byte JPEG, about 1ms maximum timer delay. Migration 0006 is applied in disposable test and development after preservation/recovery checks and a private metadata/media/config backup. Eight video scenarios (9 Node tests), nine message-controller cases, existing audio/account/native/browser-session regressions, unit tests, native JS exports/Doctor and public audio/video/session smokes pass. Both final preview compilation/package checks pass; physical acceptance remains open; see the [evidence report](../testing/2026-11-19-video-messages.md).

### Baseline inspection before implementation

- Canonical source was `feat/webrtc-poc`, baseline `073e1dc`. Audio record/send/play/reply works in the owner-confirmed iPhone ↔ desktop browser flow. Android and remaining native interruption/seek gates are still open. [0012 evidence](../testing/2026-11-18-audio-messages.md).
- `shared/messages.ts`, `src/messages/`, `web/messages.ts`, `web/message-audio.ts` and `server/messages.ts` implement audio-specific contracts/adapters. Migration 0005 has `audio_messages` and session-bound `message_media_grants`; stable patients/assignments and history already exist. The worker deliberately rejects video and publishes mono AAC/M4A. No camera recorder or video player package is installed.
- Current media grants expire after two minutes; upload is single-use and playback supports Range. Native downloads to a private file; browser uses fetch/Blob. Reuse that credential boundary from [ADR 0008](../decisions/0008-audio-messages.md), keeping binary transfers outside the serialized account/call-control queue.
- Current decoder limits (20 CPU seconds, 25-second wall timeout, 512 MiB address space, 10 MiB output) suit audio and cannot simply be assumed adequate for video. Processing leases are two minutes. Filesystem extension allowlists and fixed M4A MIME also require explicit changes.
- Read-only host inspection on 2026-11-19 UTC: 2 vCPUs, 7.6 GiB RAM, about 3.8 GiB available RAM, no swap, about 35 GiB free on the media filesystem. This is a snapshot, not a video capacity test; the server also supports live calls and other projects.
- SDK 57 camera/video documentation and the browser recording specification support the proposed approach below. Actual recordings, codecs, device playback and native interruption behavior require a prototype and physical evidence; no video implementation/test/build is claimed here.

## User experience and initial limits

Provider selects an authorized patient; patient selects an assigned provider when more than one is available. Communication history offers **Audio message** and **Video message**. The composer shows the recipient, camera preview, camera choice, recording state, elapsed/remaining time and size limit. Ask for camera/microphone permission when needed; denial keeps audio messaging/calling reachable.

Choose camera before Record. Stop or reaching the duration/size limit ends capture, then show Preview, Re-record, Discard and Send. Preview is local; nothing uploads before Send. Display Sending progress, Processing, Available or an actionable failure. Available means stored and retrievable, not notified/read/watched. A recoverable upload failure retains the draft while this compose session is alive. Retry uses the same message/request identity and bytes. Account/patient/recipient/media-kind changes require an explicit draft decision and a new request identity; never silently retarget a draft.

A published video entry shows sender/role, date, duration, Video label and a private thumbnail. Tap Play explicitly, then allow pause/seek/replay/full-screen and audio or video reply. No autoplay of received video. Preserve aspect ratio in preview and playback; correct orientation and avoid stretching or accidental double mirroring. Start with one active recorder/player across both message types. Published history survives app close; unsent local drafts may be lost on termination/reload, and the composer says so.

Selected synthetic defaults, confirmed by the bounded conversion benchmark (physical capture compatibility remains a gate):

| Setting | Selected video default | Audio behavior |
| --- | --- | --- |
| Duration | 120 seconds maximum, verified by server | Existing 180 seconds |
| Resolution/frame rate | Request 720p capture; normalized output fits within 1280×720 or 720×1280, at most 30 fps, never upscale | Unchanged |
| Encoding/playback | MP4 with H.264 video, AAC sound and fast-start metadata; target about 2 Mbps video | Existing AAC/M4A |
| Bytes | 64 MiB input; 32 MiB normalized output; one small JPEG thumbnail, at most 256 KiB | Existing 10 MiB input |
| Lifetime | 7 days after publication; incomplete submissions expire after 24 hours | Existing policy |
| Per-sender limits | 100 messages/day shared across audio/video; 256 MiB/day accepted video input, reserved across concurrent uploads | Preserve existing 50 MiB/day audio-input budget |
| Host safeguards | Preserve 1 GiB total media cap and 1 GiB free-space floor; reserve input, output and temporary space before accepting work | Both kinds count toward the same storage cap |
| Concurrency | Keep two uploads and one converter total; four total queued/active video jobs | Audio remains supported; no unlimited video backlog |

The 64 MiB input allowance covers browser/native encoder variation; it is not a quality promise. Capture FPS/bitrate controls differ across platforms. Server-verified output defines playback limits, and client MIME/duration/quality selections are advisory. A full normalized clip near 2 Mbps is roughly 30 MB; initial full-download playback may wait on weak connections. Show download progress/cancel and retain audio-only as the smaller alternative. Streaming/adaptive playback is later work.

## Implementation steps

### 1. Prove capture, playback and server budget

- [x] Inspect current code/dependency constraints, DB ledger and calling/audio ownership. Create an isolated feature worktree so dependency installation/prebuild cannot alter the live service checkout.
- [ ] Prototype SDK 57 `expo-camera` capture and `expo-video` playback; verify SDK-compatible exact versions and lockfile, permissions and configuration. Existing `react-native-webrtc` live video does not itself provide the saved-message recorder. Pin packages without upgrading Expo/WebRTC incidentally.
- [x] Prototype browser `getUserMedia` plus `MediaRecorder.isTypeSupported` and actual recorder start/stop/error handling. Test supported WebM/VP8 or VP9/Opus and MP4/H.264/AAC inputs, accepting only the formats actually verified. Do not assume all browsers record the same format. Unsupported capture shows guidance and preserves existing audio features.
- [ ] Produce synthetic portrait/landscape samples from iPhone, Android and supported desktop browsers, including maximum-length capture. Record format, verified dimensions/FPS/duration/bytes, sound and orientation; keep samples private. Verify native source behavior for interruption and automatic resume.
- [x] Benchmark full-length conversion/thumbnail generation privately on EC2 with one low-priority worker. Set per-kind CPU/wall/memory/output limits, a lease longer than the bounded job (or safe lease renewal), maximum input dimensions/FPS/stream count, upload timeout and queue limit. Selected video bounds: 300-second wall/CPU bounds and 1 GiB address-space ceiling; retain audio's current tighter bounds. Reject costly unsupported inputs before decoding where possible and cap decoding as well as output.
- [x] Verify calling/signaling remains responsive during conversion and concurrent upload. Run isolated media/call tests without ringing owner devices; do not impair the host network. If the bounded worker cannot handle maximum clips without call regression, reduce video defaults or isolate processing before enabling video; record the decision and evidence.
- [x] Record an ADR for the confirmed media contract, compatibility, storage/processing budget and camera/audio ownership. Confirm the selected defaults in this plan before implementing the full feature.

### 2. Extend schema and API without losing audio history

- [x] Add the next unused migration (expected `0006_video_messages.sql`; recheck ledger). Expand existing `audio_messages` in place, preserving IDs/FKs and its legacy SQL name: `media_kind` default audio; verified output MIME/bytes; nullable video width/height/FPS and thumbnail key/bytes. Preserve audio values and hashes; do not rename/drop tables or rewrite 0005. Add appropriate constraints and a thumbnail grant operation to `message_media_grants`.
- [x] Separate upload-requested media kind from probed media, bind it to idempotency, and reject mismatches. Video requires both a real video stream and sound; silent/camera-only captures fail clearly rather than masquerading as audio/video messages. Use explicit API capability/versioning and kind-specific limits/status, without exposing private keys/paths.
- [x] New clients render mixed history with an explicit discriminated media contract. Legacy clients continue to receive calls/audio through their existing history contract; filter unsupported video server-side before pagination, and deny video playback grants through the legacy audio-only contract. New clients use an explicit version/capability for mixed history and video grants. Prove legacy audio playback/send and stable cursors; do not send an old audio player a video asset or duplicate a video as an audio message.
- [x] Reuse current patient/recipient/session/device checks for create, list, upload start/completion, publish, playback and thumbnails. Sender-only unpublished drafts remain private; current authorized care team and patient bindings can view published communications, including eligible pre-enrollment history. Calls retain their existing audience.
- [x] Add server-advertised video capability and a separate `ENABLE_VIDEO_MESSAGES` flag (proposed, default false), subordinate to the existing messages feature. Older installed binaries remain usable for calls/audio and can install the update for video. No new patient enrollment or push credential is expected.

### 3. Implement bounded video storage, transfer and processing

- [x] Add video upload limits to the project media route only; keep JSON at 4 KiB and enforce audio's 10 MiB cap in the application. Authenticate before streaming; enforce kind-specific byte/time limits regardless of Content-Length, quotas, concurrent reservations and bounded backlog. Avoid unbounded in-memory buffering; count temporary/native downloaded files toward local cleanup budgets.
- [x] Preserve single-use operation/session-bound grants. The two-minute grant/upload deadlines need explicit handling for larger files: reject or reauthorize an expired start, bound an accepted transfer, and recheck current authorization at completion. A failed/ambiguous transfer obtains a fresh grant and retries the same file/message; this first version retries the whole file, not resumable chunks.
- [x] Probe actual media using fixed local-only codec/container/protocol allowlists. Reject malformed, truncated, overlong/oversized, extreme-dimension/FPS, missing-stream and remote-reference inputs. Handle browser captures whose input duration metadata is absent by bounding decode and verifying the complete normalized result; do not silently truncate an overlong clip and publish it as valid.
- [x] Normalize to the verified H.264/AAC MP4 profile with bounded dimensions/FPS, upright orientation, aspect ratio and synchronization; strip extraneous metadata. Generate one bounded JPEG poster. Confirm the installed encoder supports the chosen output profile. Extend the private file-key allowlist safely; no client-selected path or shell interpolation.
- [x] Extend the leased worker and sweeper to cover input, output, poster and partials. Finalize both published assets before atomic DB publication; recover crash/restart/retry without duplicate messages or orphan leaks. Failed poster generation uses an explicit recorded fallback/retry policy, never a publicly accessible raw frame.
- [x] Keep the private media root/permissions and existing service protections. Serve video and poster only through the authorized media-grant path with correct MIME/length, no-store headers and correct Range semantics (including invalid ranges). Expired metadata stays visible while all associated asset bytes are removed with retryable cleanup.
- [x] Extend aggregate status by media kind/error without identifiers, paths or content. Rehearse combined DB/files backup and restore including existing audio, new videos/posters, expiry and pending jobs.

### 4. Build native/browser compose, playback and call handoff

- [x] Generalize message contracts/controller/adapters with media-specific capture/playback while preserving audio tests. Add native camera composer/player and browser video composer/player, thumbnail fetching and mixed history. Implement duration/size stops, visible recording indicator, progress/cancel, retry/discard and truthful processing/failure/expiry states.
- [x] Continue authenticated native download to app-private files and browser fetch/Blob playback, including posters. Disable persistent video-library caching, public export/photo-library saving, background playback and picture-in-picture for this slice. Avoid downloading every clip when loading history; posters are authorized and loaded lazily. Clear/revoke temporary files/Blob URLs on discard, expiry, logout, account change and bounded startup cleanup.
- [x] Camera selection is before recording; changing camera requires stopping/re-recording. Browser playback uses explicit actions. Physical portrait/landscape, front-camera mirroring, full-screen exit and return-to-history checks on each phone remain in the matrix below.
- [x] Give calls priority over message camera/microphone/player ownership. Stop and release capture/playback on incoming call, call join, background/lock, interruption, logout, account switch or navigation. Preserve a draft only when finalized safely; never send or resume automatically. Inspect whether existing native early-call hooks need to stop the new modules before JS wakes; extend them if necessary. The existing Expo Audio patch does not automatically cover camera/video modules.
- [ ] Test iOS CallKit and Android Telecom audio-session/focus handoff, private/speaker/headset routing and subsequent live video capture. A blocked native start must not prevent Answer/End; stale asynchronous record/download completion must not attach media to a new account/patient.

### 5. Verify, roll out and record actual acceptance

- [x] Implement the automated cases below; run existing call/audio/browser-session/native/auth/DB regressions. Run DB suites sequentially under the existing disposable-target lock. Add actual video test/status commands to tools only when implemented.
- [x] Rehearse clean install and 0005-to-new-schema upgrade, preserving audio hashes/IDs, calls and device/browser sessions. Verify migration recovery and runtime grants in `phoneapp_test`; snapshot development metadata/files/config before applying the reviewed additive migration to `phoneapp`.
- [x] Check native autolinking, Expo Doctor, both JS exports and EAS source exclusion of keys/DB/media. Build bundled-JS iOS/Android previews with the existing authorized EAS workflow; inspect retained Production APNs entitlement and Android calling handlers. Reuse valid signing credentials; compilation and physical behavior are distinct gates.
- [x] Publish only Phoneapp backend/browser/nginx/service changes between calls, with video initially off. Verify old audio clients and saved browser login, then enable for synthetic testing after worker limits/prototype gates pass. Run a private synthetic public upload/process/poster/playback smoke without unsolicited calls/pushes to owner devices.
- [ ] Owner installs new previews over existing apps and completes the physical matrix. Record build/model/OS/browser, network, clip duration/size/orientation, result and sanitized evidence. Update this plan, an evidence report, PRD/roadmap/state/work log/tools/database/ADR with actual outcomes. Do not close unresolved 0011/0012 gates from a successful video build.

## Data and configuration

Migration 0006 and the backend/browser feature are deployed to development. Development target remains `phoneapp`; tests use only `phoneapp_test` and a dedicated disposable media directory. Migration `0006_video_messages.sql` preserves existing IDs/audio and adds media kind/output/poster metadata plus the thumbnail grant operation. Existing scoped runtime grants already cover these two tables; the development permission suite passes. Keep existing SQL identifiers for compatibility; use generic media terminology in new application contracts. No new vendor account, storage credential, DB port, push provider or public media bucket is planned.

`ENABLE_VIDEO_MESSAGES` is implemented, default false and explicitly true in the synthetic development deployment; retain `ENABLE_AUDIO_MESSAGES`, `MEDIA_STORAGE_ROOT`, `FFMPEG_PATH` and `FFPROBE_PATH`. Record final per-kind limits in one server configuration source and advertise safe client limits; do not document unimplemented environment overrides as available commands. Proxy/body/deadline changes apply only to Phoneapp's media route. Input/output/poster/temporary reservations must respect the shared cap; do not silently increase it because host disk appears available.

Migration recovery follows [database workflow](../DATABASE.md). Current schema checks require a compatible application binary; a feature flag does not make a pre-migration binary schema-compatible. Back up metadata and media together; never drop shared history to disable video.

## Acceptance and verification

Automated/public results are recorded in the [evidence report](../testing/2026-11-19-video-messages.md). `npm run test:video-messages`, `npm run benchmark:video` and explicit public `npm run smoke:video-messages` are implemented; their private captures/logs are excluded from Git/EAS. Physical device and native compilation/package outcomes remain separate gates.

| Scenario | Command/procedure | Expected evidence | Actual |
| --- | --- | --- | --- |
| Complete asynchronous exchange | Real Chromium camera+mic recording through UI; provider sends, closes page; patient plays later and sends reply | Decoded moving video with sound, verified metadata/poster, one shared message ID; no simultaneous presence needed | Pass in real Chromium with synthetic camera/sound, page close, later play/video reply |
| Cross-platform playback | iPhone ↔ browser, Android ↔ browser, iPhone ↔ Android; each side sends/plays in both roles using separate accounts | Audible synchronized sound, correct orientation/aspect, pause/seek/replay/full-screen, audio reply remains possible | Owner confirms two-way phone/browser video messages; Android/control/interruption matrix pending |
| Capture/limits | Permission denial, unavailable camera, tiny and full 120s clips, byte limit, unsupported MIME/codec, overlong/excessive-dimension input | Clear recovery or server rejection; limits enforced from actual media; audio option remains usable | Automated invalid/silent/size/duration/FPS/rotation cases pass; physical permission/capture checks pending |
| Failure/retry | Interrupted/slow upload, ambiguous response, expired grant, duplicate Send, concurrent quota reservation, worker restart/lease expiry, storage full, poster failure | Honest state, bounded resources, same retry identity, no partial publication/duplicates; safely finalized local draft retained where possible | Automated queue/lease/orphan/slow-upload/paired-asset recovery and client retry checks pass; hardware interruption pending |
| Access and identity | Other patient, revoked binding/session/device during transfer, expired asset, account/patient change during async completion | Video/poster/grant denied consistently; no draft/cache/late-response leakage | Automated patient/binding/grant checks and stale-account/draft clearing pass; native hardware checks pending |
| Calls and lifecycle | Incoming/outgoing live call during capture/preview/playback; background/lock, headset change, logout; subsequent call | Call takes camera/audio; no automatic capture/playback resume, stale media or stuck call controls; inspect native behavior on phones | Not run |
| Migration/legacy | `npm run test:db`, `npm run test:db:permissions`; extend fixtures for 0005 upgrade and old media contract | Preserved audio/call/auth data, old clients still call/send/play audio, new mixed pagination stable, scoped grants | Pass in clean/0005-preservation/recovery/permission and legacy media-contract tests |
| Resource/recovery | Maximum-length conversion plus isolated call/media traffic; combined metadata/assets restore; retention/orphan sweep | Document CPU/RAM/wall/disk peaks and selected budgets, no call regression, recoverable jobs, video/poster cleanup together | 120s conversion benchmark and 13 concurrent local call scenarios pass; paired output/poster restore and expiry pass |
| Existing automated regressions | `npm run typecheck`, `npm test`, `npm run test:account-client`, `npm run test:message-client`, `npm run test:audio-messages`, `npm run test:accounts`, `npm run test:native-calls`, `npm run test:browser-session`, `npm run test:browser` | Existing audio, sessions, authorization, calls/relay and history remain valid; DB suites sequential | All listed existing automated regressions pass; see evidence for exact counts |
| Packaging/deployment | `npm run doctor`, `npm run bundle:check`, package/archive checks, public browser checks and explicit synthetic video smoke after implementation | Bundled native previews retain calling capabilities; no private artifacts shipped; backend/site healthy; hardware acceptance separately recorded | Doctor/JS/prebuild/archive and public rollout checks pass; Final previews compile/package pass; native device matrix remains open |
| Plan consistency | `python3 scripts/check_project.py`, `git diff --check` | Valid documentation links/requirement references; whitespace clean | Pass; documentation/whitespace only |

## Risks and recovery

Video increases upload delay, disk usage and decode/encode load on a shared 2-vCPU host. Concurrency/queue/space reservations and bounded jobs are required before enabling it; a favorable internet speed test does not establish encoding or Wi-Fi reliability. Native camera and OS calling may contend even when JS appears idle, so physical interruption tests are a release gate. Short-lived grants and current relationship checks remain necessary for posters as well as full videos. Already-downloaded media cannot be remotely recalled; clients must clear their own temporary copies when revocation is observed.

Disable new video creation/upload using the feature flag to recover while retaining audio/calls/history and schema-compatible source. Define paused/failed video job handling explicitly on disable; do not abandon leased jobs or erase available assets. Where safe, upgraded clients may still play already-published retained videos; if a media defect requires blocking playback, show temporarily unavailable and preserve records. Repair forward or restore a matching metadata/files backup for actual corruption. No destructive rollback to 0005 or global service/network changes.

## Handoff

Backend/browser implementation and development migration/rollout are complete, with automated and public synthetic checks passing. Final native previews from source `ad7846a` are FINISHED and package-checked: Android `fc647cfd-bd6a-488d-a4bf-d407abf7aa8d`, iOS `e78902fd-28a6-4816-85ff-db11ddb7749b`. Earlier video previews compile/package-check successfully and are superseded by the final JS cancellation fix. QR/install links are refreshed. Owner confirms phone patient recording/preview/send, provider desktop receipt and video reply playback on the phone; complete remaining Android and physical camera/audio/control/interruption acceptance. No new credential or external service was needed. Backend-only fix 3f3879e now accepts/strips iPhone mebx metadata; both previously failed saved uploads were recovered and verified in public Provider history. No further native build is required for this fix. Keep current install links and prior physical gates in [project state](../PROJECT_STATE.md).

## Primary references

Consulted 2026-11-19 UTC; recheck compatible package releases at implementation rather than using a newer SDK's default documentation.

- [Expo SDK 57 camera](https://docs.expo.dev/versions/v57.0.0/sdk/camera/): native recording to local cache, permissions, quality/bitrate options, duration/size bounds and camera-switch behavior. These API capabilities do not prove fixed FPS or cross-device behavior.
- [Expo SDK 57 video](https://docs.expo.dev/versions/v57.0.0/sdk/video/): native video playback and optional caching/background/PiP configuration; verify defaults and explicitly disable unwanted persistence/resume.
- [W3C MediaStream Recording working draft](https://www.w3.org/TR/mediastream-recording/): browser recording/type detection; negotiate supported types and handle recording failures rather than assuming uniform codecs.
