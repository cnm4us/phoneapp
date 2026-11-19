# Work log

Append concise dated entries for durable outcomes. The latest actionable handoff belongs in [current state](PROJECT_STATE.md); feature details and test evidence belong in their plans/reports.

## 2026-11-16 Documentation foundation

- Captured the full communications/time-tracking product requirements, phase boundaries, and acceptance criteria.
- Prepared the first two-device WebRTC plan, agent startup/handoff workflow, roadmap, architecture direction, decision record, database migration policy, tool inventory, and testing/report templates.
- Added a dependency-free documentation checker and a ready-to-enable GitHub Actions template. The CLI token lacks workflow scope; the connected integration also rejected workflow creation. Kept the template under `docs/templates/` so ordinary repository publication can proceed; no hosted check is claimed.
- Verified empty repository access and cloned it into `/home/ubuntu/phoneapp`. GitHub CLI is authenticated as the repository owner. Node/npm/Python/Git are available; Docker/psql and project-specific DB/native-device connections are not configured.
- Verification: `python3 scripts/check_project.py` passed locally: 17 required artifacts, 16 Markdown files, 34 unique requirements, local file links and references valid. Application builds, migrations, and device tests have not run. Hosted CI is not enabled.
- Next: implement plan 0001 on a feature branch; EAS/signaling/TURN setup and physical-device steps remain outstanding.

## 2026-11-16 WebRTC runtime foundation

- Implemented native Expo audio/video experiment and Node/WebSocket signaling, with 15 protocol/helper tests, pinned dependencies, Expo checks, and both platform JS bundles.
- Owner supplied `phoneapp.bawebtech.com`. Added only this project's nginx site, issued TLS certificate, and enabled dedicated signaling/TURN services. Local relay transports/public signaling tested; public TURN still needs firewall confirmation.
- Linked EAS project `@mbcollins2/phoneapp`; Android native build finished successfully. Its overage notice prompted an owner question; owner approved pay-as-you-go for iPhone. iOS noninteractive setup stopped before upload for missing signing credentials; owner was asked to complete the Apple/device flow in the EC2 terminal. All physical acceptance remains outstanding.
- Prepared runbook, environment examples, secret bootstrap, deployment templates, smoke/relay checks, and [verification report](testing/2026-11-16-poc-foundation.md). No patient database or recording added.
- Owner confirmed firewall rules; public TURN UDP/TCP/TLS packet samples now pass. Fixed iOS's dynamic-config encryption stop and directed the owner to resume the interactive signing/device flow.
- Next: finish iOS native build and both physical-phone tests. Plan 0001 remains open.
- Published implementation commit `4874959` on `feat/webrtc-poc` and opened [draft PR 1](https://github.com/cnm4us/phoneapp/pull/1). Final local checks: TypeScript, 15 tests, 21 Expo Doctor checks, both bundles, public signaling smoke, and documentation validation passed. Generated private credentials were checked absent from staged files. No physical-device result is claimed.

## 2026-11-16 Browser companion

- Owner requested a browser participant for solo testing while the Android phone is unavailable. Added the responsive browser UI to the existing hostname, reusing native signaling/credentials and shared call helpers. No new EAS build, provider, DB, or secret needed.
- Added explicit asset serving and headers; private repository files remain inaccessible. Added esbuild/Playwright tooling and actual synthetic-media tests, including forced relay, mixed audio/video, repeat calls, controls/cleanup, permission/room errors, autoplay recovery, invitation fragments, and responsive widths.
- Deployed on existing nginx/signaling service; public HTTPS returns the page and all seven browser scenarios passed. Native/core/asset tests: 16/16. Real Safari/iPad and browser-to-native calls remain manual acceptance.
- Verified iOS native build `0e5beca1` finished successfully; owner reports the app UI is loaded. Updated setup/state/tools with this evidence. M1 remains open for real calls and the original two-phone matrix.

## 2026-11-16 First-round checkpoint

- Confirmed native and browser implementation is already committed/pushed on `feat/webrtc-poc` through `1906d38`, in draft PR 1. The user requested a first-round commit/push checkpoint; no main-branch merge was requested.
- Owner reports the first round is working well. Formal device/network acceptance remains undocumented; retain that distinction from automated results.
- Recorded agreed quality ceilings, audio-first behavior, coordinated receive constraints, and explicit two-way audio-only mode as COM-07 through COM-09 and [proposed plan 0003](plans/0003-adaptive-call-quality.md). These are follow-up requirements; no runtime behavior changed for this checkpoint.

## 2026-11-17 UTC High-ceiling quality implementation plan

- Expanded [plan 0003](plans/0003-adaptive-call-quality.md) into seven implementation stages with preset ceilings from opt-in experimental 4K/60 fps at 30 Mbps down to 240p and two-way audio-only. Added advanced send/receive controls, capability fallbacks, measured-quality UI, audio-first triggers/recovery, camera-consent rules, and protocol compatibility/renegotiation requirements.
- Inspected installed native sender APIs and TURN template limits. Recorded the current 8 Mbps per-allocation relay ceiling and a capacity-verification gate before enabling Ultra; proposed configuration is clearly distinguished from live settings.
- Defined unit/protocol/browser/physical tests and isolated transport impairment testing. Updated PRD, roadmap, and continuation state. No runtime, database, infrastructure, deployment, or paid build changes.
- Verification: `python3 scripts/check_project.py` and `git diff --check` passed. Implementation and device/media acceptance for this plan have not started; next development action is plan 0003 step 1.

## 2026-11-17 UTC Adaptive quality implementation

- Implemented native/browser presets and advanced directional caps, measured video/audio feedback, audio-first degradation/recovery, explicit two-way audio-only, local camera consent, and full screen. Shared runtime adapters preserve audio through unsupported controls and video negotiation failures.
- Added compatible capability negotiation, validated revisioned policies/acks, and designated-offerer renegotiation. Fixed startup-capacity probing deadlock, paused-stream recovery, delay corroboration, native parameter fallbacks, and camera-less answerer transceiver duplication through tests.
- Verified TypeScript, 31 unit/server/adapter tests, both native JS exports, and 12 public browser scenarios. Added and ran real UDP bandwidth/loss/recovery tooling using isolated TURN and a disposable namespace/veth; video paused and gradually recovered while audio counters continued. Listening/physical-device evidence remains separate.
- Deployed only this project's rebuilt browser assets/signaling service after confirming no recently joined rooms. Public health/media checks passed. No DB, new native build, AWS/firewall, or live TURN quota changes. Metro remains available for existing development-client reloads.
- Experimental 4K/60 remains gated off pending native capability/codec/thermal and relay-capacity verification. Updated plan, PRD, decision, test report, tools, runbook, and continuation state. Next: owner-operated native/Safari quality/consent and original M1 matrix.

## 2026-11-17 Audio without video diagnosis

- Owner reports iPhone app ↔ browser audio without video. Follow-up status is “Audio only confirmed both directions,” explaining video suppression through the selected manual mode. Instructed leaving audio-only on both participants, then enabling cameras locally. Owner subsequently confirmed “Yes, video works now.” This establishes owner-reported iPhone/browser restoration; detailed hardware/network and the full physical matrix remain open.
- No runtime/configuration changes. Initial native-bridge investigation did not establish the cause of this report; a tentative test was discarded after the mode was identified. Keep physical acceptance open.

## 2026-11-17 Testing usability and full-screen repair

- Owner reported black iPhone full screen, requested simpler invites/longer calls, and described an end at 6:50 while both screens stayed visible. Server evidence matches a closure 411 seconds after joining, room age 500 seconds, before its 1800-second expiry. Original close cause remains unknown.
- Replaced native Modal/duplicate remote renderer with one video stage resized in place; kept exit/mute/camera/switch/hangup and Android back. Added eight-digit random codes with bounded POST resolution, legacy support, and closed-code tombstones; new rooms default to four hours with separate lifetime display and aligned TURN credentials.
- Added two-miss heartbeat grace and sanitized close cause/code diagnostics. Verified TypeScript, 38 unit/server cases, 13 local/public browser media scenarios, both native JS exports, and nginx syntax. Deployed project-only route plus signaling/browser; no other project, live TURN, DB, dependency, or EAS build changes.
- Physical iPhone fullscreen/sustained-call retest requested and pending. Updated plan 0004, verification, tools, runbook, and next-thread state; four-hour expiry is simulated/validated, not a claimed four-hour physical call.

## 2026-11-17 Portrait full-screen height and image fit

- Owner confirms full-screen calling now renders video, but it occupies only the top third in portrait. Found the hidden settings ScrollView still inherited explicit flexGrow, competing with the video stage. Removed it from layout with display:none while preserving the renderer.
- Added optional Fill screen / Show whole video; fill crops edges, inline stays contain. Verified allocation using the installed Yoga C++ engine at phone portrait/landscape and tablet sizes, plus TypeScript and both native JS exports. No media/backend changes or paid build.
- Owner retest of full-height/Fill requested; model/OS and sustained-call matrix remain open. Recorded Fast Refresh's effect-cleanup caveat for sustained development tests without attributing the earlier disconnect to it.

## 2026-11-17 Owner Full/Fill and HD/High comparison

- Owner confirms Full screen and Fill screen work. HD 720p/30 selected on phone/desktop works well on both. High 1080p/60 looks good on phone but the desktop's large iPhone video is choppy; desktop self-camera preview remains smooth. Selected ceilings do not prove actual encoded output.
- Recorded affected iPhone → desktop direction without attributing encoding/network/receiving cause. Requested lowering only phone outgoing FPS to 30 while retaining 1080p, plus available Actual sent/received measurements. Result pending.
- Documentation/evidence checkpoint only; no source, configuration, service restart, EAS build, or active-call interruption. Full M1/sustained/Ultra gates remain open.

## 2026-11-17 Advanced selection indicators and outgoing FPS comparison

- Owner reported native advanced FPS buttons lacked an ON indicator. Added highlighted/checkmarked radio choices for resolution/FPS, checked accessibility state, and selected-value headings for each direction. Ceilings remain independently configurable and apply immediately.
- Owner confirms 30 fps now shows checked and the desktop remote picture seems better with the iPhone outgoing ceiling at 1080p/30. This is perceived improvement, not measured output or proof of an encoding/network/decoding cause.
- TypeScript and both native JS exports pass. Unit/server/adapter suite passes 39 cases, including outgoing 60→30 FPS application while incoming stays at 60 after guard warm-up. No media-policy/default/backend change, service restart, or EAS build. Updated quality evidence and continuation state; M1/sustained/Ultra gates remain open.

## 2026-11-17 Desktop frame-rate diagnostics

- Owner links desktop remote-picture choppiness/softness with decoded incoming FPS dropping to 0–5 or around 16; high rates appear sharp/smooth. Reported internet speed test remains 700/80 Mbps. Sender endpoint for the reported 30 fps reading and paired stream measurements are unconfirmed; no bottleneck established.
- Added browser-only read-only frame/packet/codec/processing diagnostics and a local copyable last-30-measurement history. No shared/native source, quality-policy, TURN quota, recording/upload, DB, or EAS build changes. Existing top-level received FPS is decoded FPS, not simply packets/frames arriving on the network; standard field semantics verified against the W3C WebRTC statistics specification.
- TypeScript, 43 unit/server/diagnostic tests, and 13 local browser cases pass. Owner finished the test call; sanitized logs confirmed no joined rooms before the project-only signaling restart to publish assets. All 13 public browser scenarios also pass after deployment. Next: collect diagnostics during a choppy interval and pair with phone Actual sent before choosing a performance correction. Physical/sustained/M1/Ultra acceptance remains open.

## 2026-11-17 Owner confirms low iPhone outgoing FPS

- Owner now reports phone Actual sent sometimes below 5 fps. Checked native stats mapping against source and W3C definitions: it measures outgoing encoded frames, not the desktop decoder. This supports an outgoing-stream slowdown; it does not establish device load versus congestion feedback or a control/statistics issue.
- Recorded the finding and next comparison: collect browser diagnostics with the phone's low Actual sent line, then vary only phone outgoing resolution from 1080p/30 to 720p/30. Paired evidence and comparison outcome remain pending. No runtime edit, active-call interruption, service restart, or new EAS build. Documentation and whitespace checks pass; app tests were not repeated for documentation-only updates.

## 2026-11-17 Phone Wi-Fi throughput finding

- Owner reports only 6–10 Mbps upload/download on the Wi-Fi-connected phone, despite the earlier much faster speed test. Asked whether this ran during the call; answer pending, so do not assume idle-link capacity. This strengthens a phone-side network hypothesis without proving it.
- Verified configured High video ceiling 8 Mbps (6 Mbps relay) and HD 3 Mbps; FPS-only reduction leaves bitrate cap unchanged. Revised next comparison to idle phone Wi-Fi/access-point proximity and HD on both participants, which lowers bitrate as well as resolution/FPS. No runtime changes or call interruption. Documentation/whitespace checks pass; application tests not repeated for evidence-only updates.

## 2026-11-17 Cellular comparison improves both video directions

- Owner identifies weak upstairs office Wi-Fi versus strong downstairs reception. With phone Wi-Fi disabled, cellular speed test is approximately 500 Mbps down / 30 Mbps up; owner then reports sharper, smoother, more stable video and FPS in both directions.
- Recorded stronger evidence implicating the Wi-Fi path without declaring a specific RF/router/transport cause or full device acceptance. Exact settings, codec/route/RTP metrics, device versions, and duration remain unrecorded. No runtime change, restart, new build, or additional application testing. Documentation/whitespace checks pass. Retain successful cellular observation; use HD on weak Wi-Fi and collect diagnostics for recurrence on a strong connection.

## 2026-11-17 Direct High 1080p/30 selection

- Changed shared High from 1080p/60 to 1080p/30 at the owner's request; HD stays 720p/30. Both directional preferences update together. Kept bitrate ceilings, advanced bounds, and gated Ultra separate from preset simplification.
- Prepared/checked an isolated checkout while the live call remained active. TypeScript, 43 unit/server/diagnostic tests, 13 local browser scenarios, and iOS/Android JS exports pass. After sanitized logs showed no active rooms, applied the reviewed patch, built browser assets, and restarted only project signaling. All 13 public browser scenarios also pass after deployment.
- Updated PRD, current plan, runbook, tools, evidence, and continuation state. No dependency/DB/TURN quota changes or paid build. Physical phone selection/behavior remains owner-operated; next action is reload both clients and select High.

## 2026-11-17 Owner accepts High/30 visual quality

- Owner reports the 1080p/30 selection is very sharp, including Fill screen. Recorded visual acceptance without equating preset labels with measured RTP output or completing the sustained/M1 matrix.
- No runtime, configuration, deployment, or build changes. Documentation and whitespace checks pass; app tests not repeated for evidence-only updates.

## 2026-11-17 Native call settings and available-screen video

- Implemented [plan 0005](plans/0005-native-call-settings.md): full-height native call video with overlaid mute/camera/hangup and an upper-right Phoneapp settings button. Quality/advanced caps, Fill/self preview/camera, clock/lifetime, and diagnostics move into an in-window panel; idle setup options live there while create/share/join stays on the home screen. Remote RTCView/parent remains mounted while settings opens; self preview is visually hidden beneath the panel without stopping capture.
- Inspected pinned Expo 57 native source and versioned official docs. Added a guarded iOS-only optional `DevMenuPreferences` call to hide Expo's floating Tools button; shake/three-finger preferences remain unchanged. Unsupported bridges fail without blocking the app; manual Expo Tools button toggle remains available. No dependency/configuration/paid-build change.
- Prepared in an isolated checkout while the owner could continue testing. Corrected removed RN StyleSheet API usage found by TypeScript; final TypeScript and both native JS exports pass. After sanitized logs showed no active rooms, applied the reviewed patch. Metro status is running. No backend/browser/TURN restart or media-policy change. Documentation/whitespace checks pass; prior unit/browser suites were not repeated as native UI proof.
- Next physical acceptance: reload app, verify gear/panel/Done/back, invitation/key flow, full-height/Fill, continued audio/video/clock through panel changes, and Expo button suppression/gesture access. No physical pass is claimed. Messaging, full M1, sustained-call and Ultra acceptance remain open.

## 2026-11-17 Android installation handoff

- Owner says the native UI is looking good and now has the wife's Android. Recorded general presentation feedback; detailed panel/gesture/media acceptance remains open.
- Rechecked Android build 2cf8e5a8 as FINISHED/INTERNAL/development and retrieved its APK download link. Queried the running Metro Android manifest for its current tunnel host and verified public /status returns packager-status:running. No rebuild/deployment or signing changes.
- Updated two-phone install/setup instructions for the current settings panel and eight-digit rooms. Android installation/call result remains pending. Documentation/whitespace checks pass; no runtime tests repeated for documentation-only changes.

## 2026-11-17 Native audio-output control prepared

- Owner reports Android setup is working well and asks for phone loudspeaker selection. Confirmed installed WebRTC binaries have no output selector. Implemented [plan 0006](plans/0006-native-audio-output.md): optional local Expo Swift/Kotlin routing, call-overlay Speaker and Settings Automatic/Speaker/Phone choices, OS-reported route separate from preference, and serial lifecycle/cleanup with session-tagged stale-event protection. Mute/media capture remain with WebRTC; no extra package, backend, DB, or TURN change.
- Prepared outside live checkout. Final TypeScript, 50 unit/server/routing tests and both native JS exports pass. Both native discovery resolves list the module; Expo prebuild passes; local EAS archive inspection includes native sources/config. Initial discovery-output parsing was corrected to use --json; a stale-event fixture assertion was corrected before the final all-pass run. No native compilation/listening/device route result is claimed.
- Original installed binaries remain callable through optional-module fallback but need rebuilt apps for routing. New builds may incur EAS charges; no new cloud build submitted. Applied after sanitized logs showed zero active rooms. Expo Doctor passes 21/21; live-checkout EAS archive matches native/config sources and excludes .env.server/server files (empty directories can remain). No backend restart. Next: obtain build authorization, build/install, and test routes/accessory changes/audio-only transitions/cleanup. Physical M1/sustained acceptance remains open.

## 2026-11-17 Private listening versus room speaker clarification

- Owner wants Phone earpiece/private listening and Speakerphone/sharing with the room, with each participant independently choosing output. Owner reports apparently highlighted Speaker and default checked Automatic with ineffective taps.
- Rechecked EAS build history: only original Android/iOS builds exist, neither with PhoneappAudio. No new build authorization received/submitted. Current controls cannot route on those binaries; default checkmark is misleading and remains a UI follow-up for the next safe update window.
- An active room was present; no runtime source change or restart interrupted it. Recorded terminology, old-binary limitation, and next build/UI/device steps. Documentation/whitespace checks pass; no application tests repeated for evidence-only updates.

## 2026-11-17 Both audio-routing builds authorized and submitted

- Owner explicitly approved updated Android and iPhone development builds. Submitted with EAS pay-as-you-go using existing remote signing credentials; no repeated authentication or device registration requested. Builds from commit 258902b: Android 879fa37b-1746-4a83-baa2-55d666a7a3df and iOS 06b7c87f-3ba0-4ec6-8e6e-268555cf13d1. Native results pending.
- An existing room remains active; unavailable-state UI clarification is being checked separately so tests can continue. Next: monitor native compilation, address any errors, apply UI clarification between calls, and supply verified installation links.

- iOS 06b7c87f finished successfully, including PhoneappAudio native compilation/linking. Android local module compiled; remaining Android app build is in progress. Owner confirmed hanging up, so applied the separately checked UI clarity patch through Metro. Missing native support no longer displays a default checked output or inert Speaker button; Audio setup explains availability. Phone/private and Speakerphone/room labels are explicit, and native route confirmation is required for their checkmarks. Physical audio tests remain pending.

- Both approved builds finished successfully: Android 879fa37b (Gradle BUILD SUCCESSFUL) and iOS 06b7c87f (PhoneappAudio packaged/linked). No native compilation retry was needed. Updated install links/runbook to the new APK and iOS EAS page. Final UI clarification TypeScript/native JS exports pass; it is served through Metro and does not require another native build. Original installed binaries remain usable but need these updates for routing. Physical installation/listening/route/accessory/cleanup acceptance remains pending; next action is install both, join a fresh room, and test Phone earpiece/private versus Speakerphone/room.

## 2026-11-17 Android APK QR handoff

- Owner could not open the Android update link from chat and requested a printed URL/QR. Rechecked current APK with redirects: HTTP 200. Generated 600px QR PNG in ignored artifacts/public/android-install-qr.png using isolated npx qrcode@1.5.4 and visually inspected it. Payload is only the public APK URL for build 879fa37b; no credential/room data.
- No dependency, app, server, build, or migration change. Documentation/whitespace checks pass. Printed direct URL and clickable QR provided; actual Android update installation/routing outcome remains owner-operated and pending.

## 2026-11-17 Shared labeled transcription discussion

- Owner reports Android QR handoff is working and requests discussion of sending both call directions to transcription and sharing a Speaker 1/Speaker 2 copy with both callers. Explained proposed separate-track/channel attribution, timestamps, common transcript distribution/export, and uncertainty when multiple people share one endpoint. Existing PRD TX-01–04 covers consent, labels, corrections, and lifecycle.
- Reviewed current call architecture and primary Deepgram/LiveKit documentation: streaming multichannel transcription and participant-tagged transcript delivery are supported building blocks. No provider/architecture chosen, plan implementation started, audio recorded/uploaded, service provisioned, DB migration, native change, or build. Live versus post-call preference remains a discussion question. Documentation/whitespace checks pass.

## 2026-11-17 Provider/patient workflow and post-call transcript scope

- Owner selected post-call transcripts, shared call logs, and later LLM summarization (deferred). Requested next-stage provider list Patient A/B/C, patient contact/call choices with only App Audio/Video initially, native ring/answer on the enrolled patient's app, and history/transcript on both sides. Asked about separate apps and unique-ID/push routing.
- Added PAT-04, TEAM-02, COM-10, TX-05, REP-03 and [proposed plan 0007](plans/0007-provider-patient-calls-transcripts.md); updated roadmap/state. Recommended shared calling code and authenticated role-specific screens first, with optional separate build variants later. Identity/device token binding, server-side patient authorization, durable lifecycle, native push/call integration, consent-aware media capture, and processing jobs are separate requirements, not existing capabilities.
- Checked primary Apple PushKit/CallKit, Android Telecom/call-style, FCM, and Expo variant docs. Native locked/background ringing is a substantial change from the foreground-only app; push delivery is conditional and does not transport call audio or prove ringing. Retention/audio playback and provider/stack/package choices remain unresolved. No runtime changes, DB migrations, providers, recording/upload, credentials, new builds, or spend. Documentation checks pass; implementation/acceptance has not started.

## 2026-11-17 Audio playback and existing EC2 database access

- Owner requested replayable saved audio; added TX-06 and updated the proposed next-stage plan. Retention/deletion and exact capture-toggle policy remain open. No recording/playback runtime implemented.
- Read-only host inspection found MariaDB 10.6.22 active on loopback 3306, mysql/mariadb/sqlite clients, and no PostgreSQL/Docker/Podman tools. Verified local administrator access with sudo/mariadb Unix socket, querying only version/admin identity and count of Phoneapp-named schemas (zero). No project DB env keys/configuration exist; no other application tables/records were read or changed.
- Updated DB/tool/state artifacts to distinguish existing host DB access from a provisioned Phoneapp DB. Dedicated project database and restricted runtime/migration users, plus private audio-file storage, remain proposed. No schemas/users/migrations/services/builds/spend changed. Documentation/whitespace checks pass.

## 2026-11-17 Isolated Phoneapp database foundation

- Owner explicitly authorized creating/evolving the Phoneapp schema and requested PRD/roadmap/state/implementation-plan updates. Created and completed [0008](plans/0008-database-foundation.md), the bounded persistence prerequisite of staged plan 0007. Selected existing local MariaDB 10.6.22 with official connector 3.5.5 in decision 0005, replacing tentative PostgreSQL for synthetic development.
- Provisioned only `phoneapp` and disposable `phoneapp_test`, dedicated localhost runtime/migration/test identities, private generated `.env.database` (600), and explicit table write grants. No other application's schema/records, root credentials, host DB configuration or services changed.
- Added two SQL migrations (16 domain tables plus checksum ledger), serialized runner with dirty-state/drift protection, target-guarded CLI/provision/grant tooling, and disabled synthetic Provider/Patient A/B/C seeds. Patient/account/device identity, shared contacts, logical calls/events, consent/media/transcript metadata and immutable raw activity/review boundaries are represented. Existing calling does not use the DB yet; no login subjects, real tokens, recording, push, object storage, workers or paid services enabled.
- Eight live DB scenarios pass (9 Node tests including wrapper), including clean install, data-preserving upgrade, idempotency, domain constraints and real partial-DDL failure with disposable recovery. Development runtime permission case passes; development migration/status/seed/check current, UTC, 3 patients/4 users. Initial FK assertions collided on duplicate synthetic keys; corrected test inputs, not applied migrations. TypeScript including database code and all 50 existing tests pass. Updated database/tools/testing/architecture/PRD/roadmap/plans/state and evidence; docs/whitespace checks pass.
- Next: bound identity/enrollment, authenticated assigned directory and durable foreground call/history integration under 0007. Packaging, identity provider, consent/retention, media capture/storage, incoming native integration and STT provider remain open; physical native/M1 acceptance unchanged. No call-service restart or new native build.

## 2026-11-18 Synthetic accounts and foreground call/history implementation

- Owner said proceed after database foundation. Created bounded plan 0009 and decision 0006; implemented in an isolated worktree to preserve live calling during preparation. Shared native/browser role views use owner-issued one-time synthetic enrollment, opaque hashed 12-hour sessions in client memory, assigned directory, App Audio/Video, foreground incoming answer/decline, private participant/session media grants and common durable history. Recording/transcription stays Off; no paid identity service or native dependency/build.
- Added immutable migration 0003 for enrollment/session hashes and foreground runtime/presence, transactionally serialized call lifecycle/answer ownership and backend-timed aggregate intervals with heartbeat bounds. Applied on test first, then development with scoped grants; no destructive development changes or other project infrastructure touched.
- TypeScript, eight DB scenarios (clean/v1/v2/v3 data preservation and dirty-DDL recovery), six account scenarios including real two-way Chromium video/shared history, runtime grant case, 50 existing tests, 13 browser cases including TURN and both native JS exports pass. Corrected invitation expiry metadata accidentally entering strict Join messages and restart-failure outcome classification before passing complete integration suite.
- Rolled out implementation 16e1ff7 after zero recent active-room evidence: root fast-forward, rebuilt browser assets, enabled account flag, updated only loaded Phoneapp nginx `/api/`, validated/reloaded nginx and restarted project signaling. Public synthetic enrollment/directory/answer/history smoke and legacy HTTPS/WSS smoke pass; Metro running. Generated unused owner enrollment file artifacts/private/enrollment-1794963771095.txt (600). Corrected/retested shutdown ordering with two actual private-room sockets so restart retains Failed outcomes before socket teardown. Original hardware/M1/sustained/Ultra and native speaker/earpiece acceptance remain open; native background/locked incoming lifecycle and separately consent/media/storage/STT/production identity are future stages.

- Final restart readiness: immediate public smoke briefly received 502 before Node startup. Added a bounded public health wait before issuing smoke enrollment codes; rerun passed. No patient/session credential was printed and owner handoff codes were untouched.

## 2026-11-18 Owner foreground success and ringtone discussion

- Owner reports desktop provider → iPhone patient flow worked well, with Phoneapp settings open; incoming visual notice appeared without sound. Recorded this as partial owner-reported hardware evidence, without marking full native/device acceptance complete.
- Inspected installed dependencies and PhoneappAudio: current native module supports output routing only; no ringtone playback API/player is present. Reviewed primary Apple AVAudioPlayer/audio-session and Expo audio docs. Foreground ringtone plus optional vibration can operate independently of settings UI and stop on all terminal/answer paths; native addition requires an updated build. Locked/background ringing remains separate. Capability discussion only; no runtime changes, dependencies, DB writes, services, recordings, paid builds or spend. Documentation/whitespace checks pass.

## 2026-11-18 Foreground ringtone implementation and native build submission

- Owner accepted proposed foreground ringtone/vibration/preferences and updated native-build requirement, then explicitly said proceed. Prepared 0010 in isolated worktree; no live call/source/service interruption during implementation. Native module now includes original bundled two-note WAV, iOS ambient playback/restoration and Android ringtone usage/audio focus, optional vibration, device-local saved switches, native lease/background/destroy safeguards and stop before communication routing.
- Added serial optional JS alert adapter/owner, fresh-poll and foreground gating, stop-before-media, persisted controls and incoming modal above settings. Old installed binaries retain visual calling with update guidance. No new native dependency, DB/backend/provider, recording, push or background capability.
- TypeScript, 58 unit/server/routing/alert cases, six account/browser-media integration cases, both native JS exports, prebuild/discovery and EAS archive resource/secret checks pass. Packaging review restored module-level MODIFY_AUDIO_SETTINGS; generated app manifest already includes it and VIBRATE, preserving effective permissions for queued source.
- Submitted Android 352e0a90-4961-4615-b594-b4a73ca0f911 and iOS 43047d0d-f5aa-4f5c-a73d-71fcceaf8e5c from commit cb10b68 using existing EAS development signing/pay-as-you-go authorization; native compilation is in progress. Monitor outcomes, apply JS safely, and provide verified installation links. Physical ringtone/haptic/silent/headset/output acceptance remains open.

- iOS 43047d0d finished successfully; native module packaged/linked and incoming.wav resource bundle copied. After confirming zero active account calls, fast-forwarded verified source/JS to canonical checkout without restarting services. Generated fresh unused owner enrollment file artifacts/private/enrollment-1794987203459.txt (600). Android compilation and physical sound/haptic acceptance remain pending.

- Android 352e0a90 also finished; PhoneappAudio library/resource tasks succeeded and Gradle BUILD SUCCESSFUL in 6m 21s. Verified APK download HTTP 200, refreshed Android/iPhone install QR images, and retained private build metadata/logs under artifacts/private/ringtone. Both builds/install instructions and canonical state updated; physical handset sound/haptic/silent/headset/audio handoff acceptance remains open. No backend restart, schema migration or recording was needed.

## 2026-11-18 Foreground ringtone success and background-call discussion

- Owner reports updated foreground ringing works well; asks for discussion of background/locked/non-running delivery and ringtone control. Recorded positive reported foreground sound evidence without marking unreported haptic/silent/headset/device-matrix checks passed.
- Verified primary Apple PushKit/CallKit custom ringtone, Android Core-Telecom/call-style/channels and Firebase delivery prerequisites. Background/cold-start incoming calls are feasible native work under staged 0007; secure persisted identity/device enrollment and native wake/answer/cancel/audio lifecycle are prerequisites. Current session storage is memory-only. OS controls sound/silent/Focus and user channel/haptic settings; custom bundled tones and timeout are feasible within those limits.
- Distinguished Android Settings Force stop (reopen required) from iOS VoIP push exceptions to generic force-quit restrictions using Apple DTS. No live ringing when phone is powered off/offline; delayed invites must expire. Discussion only, no runtime/native/dependency/provider/service/DB/credential/build/spend change. Documentation/whitespace checks pass.

## 2026-11-18 Reboot versus force-stop clarification

- Owner asks whether a normal reboot permits incoming ringing without manually reopening Phoneapp, unlike explicit Force stop. Verified Android stopped-state persistence policy, FCM Direct Boot and Apple DTS first-unlock/VoIP caveats. Ordinary reboot after prior enrollment can support native incoming cold start; Android Force stop is not cleared by reboot. Initial design/acceptance baseline should include first phone unlock after boot, with pre-unlock operation tested/designed separately. iOS VoIP push relaunch remains an exception to generic force-quit rules.
- Recorded the future acceptance matrix and distinguished it from the currently implemented foreground-only app. Discussion only; no code, services, schemas, credentials, providers or builds changed. Documentation/whitespace checks pass.

## 2026-11-18 Ordinary incoming-call push notification discussion

- Owner asks if push can notify the user of an incoming app call while Phoneapp is not open. Verified Apple/Expo OS-displayed alert behavior for background/terminated apps. Proposed notification→tap→securely authenticated current-call check→join-if-active/missed-if-expired as a possible interim stage, with device registration, persisted secure login, permission and short-expiry prerequisites.
- Distinguished ordinary notification banner/optional alert sound from full native phone-call ringing; ordinary push does not bypass Android Settings Force stop, offline or disabled notification policies. No code/module/provider/DB/service/credential/build change or spend. Documentation/whitespace checks pass.

## 2026-11-18 Concrete next plan for background/native incoming calls

- Owner asks what comes next after successful foreground ringtone. Prepared [0011](plans/0011-native-background-incoming-calls.md): secure native-accessible resumable device enrollment, stable winning-device ownership through session refresh, authenticated APNs/FCM registration and delivery outbox, iPhone PushKit/CallKit then Android FCM/Telecom proof, native audio/liveness coordination and standalone preview-build acceptance without Metro.
- Reviewed actual code: memory-only 12-hour credential, session-owned media, background hangup and JS-only presence all need deliberate adaptation. Key-name-only configuration inspection found no local APNs/FCM/Firebase keys/client files; existing remote Apple/EAS key reuse and owner Firebase project remain unverified, not assumed nonexistent. No secrets printed.
- Updated PRD/roadmap/state/tools/database handoff and overall 0007. Plan separates first-unlock baseline, force-stop/Direct Boot limitations, cold-start action queues, no ghost rings, multidevice/auth isolation and audio ownership; mock/provider receipts cannot establish hardware ringing. No code, service, migration, provider/credential creation, EAS build or spend initiated. Documentation/whitespace checks pass. Next implementation increment is device identity/registration/contracts; resolve real sender setup alongside independent code.

## 2026-11-18 Push credential account setup handoff

- Owner asks what account work is needed. Added [push setup](PUSH_SETUP.md): exact Android package, Firebase client download/private EC2 location, separate FCM server identity, and Apple key inspection/reuse before conditional creation. Linked plan/state/tools.
- Read-only EAS menus confirmed iOS signing/provisioning and push-key management; declined optional Apple login, made no key selection/change, and exited. Reusable APNs key remains unverified. Prepared ignored private staging directory `artifacts/private/push/` (700); no credentials generated/downloaded or provider sends/builds/runtime/DB/service changes.
- Documentation/whitespace checks cover this handoff; hardware delivery remains unimplemented and untested. Next: owner selects Firebase project and supplies client config, checks Apple key availability; implementation can independently begin secure device restoration and backend contracts under 0011 when requested.

## 2026-11-18 Owner-supplied push files validated

- Received Firebase client JSON and Apple `.p8` in private push staging. Firebase project `phoneapp-9a5c4` has one matching Android client, project number and mobile app ID. Apple key parses as EC P-256 and local signature round trip passes; no provider authorization or delivery is inferred.
- Restricted both owner files to mode 600, retained directory mode 700, verified Git exclusion and existing EAS upload exclusion. Private `credential-status.json` retains metadata/paths and team ID from existing EAS signing output without copying key material. No runtime/server environment, service, DB, EAS build, or provider-send change.
- Updated setup guide/plan/state/tools with actual receipt and remaining dedicated FCM send identity/API check. Asked owner for Apple key environment/type/topics; pending reply. Documentation link/reference check and whitespace check pass. Next owner handoff is `fcm-service-account.json`; next independent implementation remains 0011 secure restoration/backend contracts.

## 2026-11-18 Sandbox key environment clarification

- Owner confirms supplied Apple key is Sandbox; recorded in private status metadata without changing key files. Scope/type remains unconfirmed. Checked EAS profiles: both internal distribution; Expo documents ad hoc signing and Apple documents Production APNs for ad hoc installs, including development clients.
- Updated guide/state/tools/0011: obtain or reuse Production-authorized APNs key for this EAS workflow, retain Sandbox key, verify actual new signed push entitlement/token environment before provider sends. Production endpoint does not require publishing the app. FCM server credential remains pending. No runtime/provider/build changes; documentation and whitespace checks pass.

## 2026-11-18 Revoked Sandbox key and required key count

- Owner reports revoking the earlier Sandbox key and asks how many keys are required. Recorded owner-reported revocation/unusable status in private metadata; retained file untouched. Current EAS ad hoc workflow needs only one Production-authorized key; a replacement Sandbox key is unnecessary.
- Updated guide/current state; no provider request, runtime change or build. Documentation and whitespace checks pass. Next remains Production key handoff and separate FCM sender JSON.

## 2026-11-18 Production APNs key received

- Owner supplied `AuthKey_WS664U36TD.p8` as Production. EC P-256 parse and local sign/verify pass; restricted file to mode 600. Updated ignored private status to current key metadata while preserving revoked Sandbox history. Never printed private key contents or made a provider request.
- No service-account JSON found in private push staging; remaining owner step is FCM sender credential. Updated guide/state/tools/0011; documentation and whitespace checks pass. No native/background runtime, server configuration, service, DB, or EAS build change.

## 2026-11-18 Firebase project ID versus sending authorization

- Owner confirms project `phoneapp-9a5c4` and asks whether ID alone suffices. Verified official FCM authorization docs: sender also requires an authorized identity/access token. JSON key is the selected EC2 POC method; ADC/workload federation are alternatives, not already configured capabilities.
- Read-only checks found no conventional gcloud ADC/login files, relevant environment names, Google sender settings in `.env.server`, or identity JSON in private push staging. No values printed or cloud/provider changes. Updated guide/state; documentation and whitespace checks pass. Dedicated FCM sender credential remains next owner account step.

## 2026-11-18 Existing Firebase Admin SDK service account accepted

- Owner reports Firebase-created Admin SDK service account with Administrator Service Agent/Token Creator roles and asks whether another is needed. Official IAM definition includes `cloudmessaging.messages.create`; existing account is usable for this POC, while a narrower dedicated sender remains optional. Prior separate-account instruction was a recommendation, not a requirement.
- Updated guide/state with Firebase Generate new private key download to private `fcm-service-account.json`. Account/roles remain owner-reported; actual sender authorization untested. No credentials generated or provider/runtime/build changes. Documentation and whitespace checks pass.

## 2026-11-18 Google Cloud IAM screenshot navigation

- Screenshot shows project IAM permissions rather than Firebase Admin SDK or the service-account Keys tab. Verified Google's current key-creation path and added direct Service Accounts link plus exact existing-account → Keys → Add key → Create new key → JSON steps.
- FCM credential handoff remains pending; no provider or runtime changes. Documentation and whitespace checks pass.

## 2026-11-18 Firebase server credential received and authenticated

- Owner supplied `artifacts/private/push/phoneapp-9a5c4-515f1c967b53.json`; retained actual filename, restricted to 600. Service-account type, project, expected Admin SDK email, token endpoint, RSA key and local signature checks pass. No private credential values displayed.
- Real Google OAuth JWT exchange requesting Firebase Messaging scope returned HTTP 200; access token neither saved nor displayed. Private status records actual credential path/authentication evidence. FCM API/send permission and device delivery remain untested; APNs authorization remains pending.
- Updated guide/state/tools/0011, including removal of obsolete current-state credential requests. All three supplied artifacts now present. Documentation and whitespace checks pass; no live runtime/service/DB/build change or push send. Next implementation remains secure device restoration/backend contracts then native delivery.

## 2026-11-18 Native background calling implementation in progress

- Owner authorized 0011. Implementing in isolated `/home/ubuntu/phoneapp-stage11` (`feat/native-background-calls`) to preserve live Metro/calls. Added revocable persistent native identity, stable device call ownership, encrypted APNs/FCM token registration and transactional outbox; native PushKit/CallKit, Firebase/Telecom, independent native RTP observations and selective foreground compatibility.
- Migration 0004 passed test clean/upgrade/recovery; private dev snapshot retained, additive migration/grants applied, runtime permissions pass. TypeScript, 58 unit cases, existing account/media integration, 7 new native scenarios (8 Node tests), all 13 browser scenarios including TURN, both JS exports and native prebuild/autolinking/archive exclusion checks pass. Latest native edits need renewed compile/export checks. FCM validate-only real request accepted HTTP 200; no device push sent.
- Native EAS builds submitted with bundled JS. iOS cea655cf requires refreshed Push-capable provisioning (owner Apple-login question pending). Android b899c8e0 failed missing library defaultConfig.versionName, corrected; decf7909 in progress. Native compilation/device behavior not yet accepted. Private build logs, config and backup are under isolated artifacts/private/native-calls; no running-service/Metro rollout yet.

## 2026-11-18 Native backend rollout and final preview handoff

- Confirmed zero active account calls and no signaling connections, advanced canonical source between calls and installed private native server configuration. Public existing/manual account smoke, native enrollment→refresh→logout/device-revocation smoke and FCM validate-only authorization pass. No handset push delivered by these checks. Fresh unused owner enrollment file is `artifacts/private/enrollment-1795028097001.txt` (600).
- Android native compilation passed c44419ab; final source 1b6160b compiled/finished as b153aa67, APK HTTP 200. Superseded queued 9023363b was canceled. iOS latest native CallKit/mute/RTP code compiled in simulator c8f80317; simulator is compile evidence only. Owner completed requested Apple credential/profile step; physical preview e449609b now submitted, no repeat authentication requested.
- Five pure account-client race/mute cases, seven native server scenarios, DB/grants, existing account integration, both final JS exports, 13 local/public browser cases and final archive private-file exclusion pass. Updated PRD/roadmap/decision 0007/evidence/tools/state. Remaining work: physical iPhone build verification then owner installation/no-Metro ringing/media/reboot/cancel/control matrix. Recording/clinical use remain excluded.

## 2026-11-18 Final native previews verified; physical acceptance handoff

- Owner's Apple credential/profile update resolved signing. Final native source 2e7cfce built successfully as Android 89e57322-abc9-4042-9071-892c466239d8 and physical iPhone 1e392d16-039b-484b-9a7a-020fee6b20e9. Earlier previews are superseded. Final fixes distinguish automatic unanswered timeout from user decline, reconcile native outgoing direction and configure Android SIP account/ringing behavior.
- Added reproducible private-package inspection helper; final APK/IPA pass bundled JS/native-handler checks. Both iOS embedded profile and actual Mach-O signature entitlements match Production APNs/app/team; one registered physical iPhone. This is not trust-chain or hardware acceptance. Final public browser suite again passes all 13 cases. Installation QR images regenerated.
- Updated current state/resume prompt/tools/push guide/roadmap/plan/evidence. Native source and documentation reconciled into canonical feat/webrtc-poc; isolated stage11 worktree retained for audit/owner terminal continuity. Private snapshots/config/build metadata retained; credentials remain excluded.
- Next: install final previews, use private enrollment file in current state, verify incoming registration, then owner-operated foreground/background/locked ring→Answer→two-way audio, controls/cancel/no-answer/reboot matrix without Metro. No actual handset push or ringing claimed.

## 2026-11-18 Owner iPhone ringing after swipe-away

- Owner reports iPhone calling works well and provider-call ringtone arrives after swiping Phoneapp up. Recorded physical owner feedback with gesture/device/audio/reboot details still unrecorded; did not mark the entire native lifecycle matrix complete.
- Verified Apple guidance: swiping an app card away quits it; VoIP pushes are a documented exception to the usual force-quit background-launch restriction. No app/server/DB changes, new builds or unsolicited device calls. Documentation/link and whitespace checks pass.

## 2026-11-18 Audio-message and shared-history implementation plan

- Owner requested the next implementation plan after agreeing on short two-way audio messages. Added 0012 covering native/browser compose and playback, permanent patient identity and late-enrollment history, private storage, binary credential transport, atomic publication/retries/processing, retention, migrations, audio-session handoff, deployment/recovery and observable acceptance.
- Updated PRD to 1.0 draft with PAT-05, COM-12–13 and REP-04, capturing app-first communication, recorded audio/video messages, future patient-to-provider/Twilio routing and history predating enrollment. Updated roadmap, parent plan, agent instructions, state/resume prompt and DB/tool inventory; corrected stale native-signing/table-count notes.
- Reviewed Expo 57/W3C/FFmpeg primary documentation; local read-only inspection confirms ffmpeg/ffprobe binaries (4.4.2), not codec/security acceptance. Proposed project-private filesystem POC storage avoids assuming new cloud permissions; implementation must verify limits, retention, isolation and backup. No DB/runtime/dependency/storage/EAS changes. `python3 scripts/check_project.py` passes (43 Markdown files, 48 unique PRD requirements); `git diff --check` passes. No runtime/device tests were run for this documentation-only change.

## 2026-11-18 Audio-message implementation started in isolation

- Owner authorized implementation of 0012. Working in `/home/ubuntu/phoneapp-stage12` on `feat/audio-messages` while canonical calling continues. Added migration 0005, independent message/asset/processing state, current-relationship access, stable combined history and short-lived media transfer grants; private file upload/validation/AAC conversion/playback/cleanup implemented.
- Native/browser compose, preview/send/reply/play/pause/seek UI and stale-account/upload cancellation protections implemented. SDK-compatible Expo Audio/FileSystem/Asset dependencies pinned. Version-guarded native patch disables automatic recording resume and releases message audio when native calling takes ownership; physical behavior remains to test.
- Isolated clean/upgrade DB checks, six audio-message scenarios (including real Chromium record/upload/play/reply), four client race cases, 58 existing unit cases, existing native/account integration and 13 browser cases pass. TypeScript and both native exports pass. Prebuild/archive/native compilation and deployment are next; no new dev migration/config/service change yet. ADR 0008 records implementation choices; no phone message acceptance claimed.

## 2026-11-18 Audio messages deployed; native previews and handoff

- Applied migration 0005 and reviewed runtime grants in development after isolated preservation/recovery tests and private pre-migration snapshot. Provisioned private media root and a single scoped service ReadWritePaths exception. Public nginx upload/processing/Patient C history/authenticated Range playback passes; call service healthy and all 13 public browser call cases pass after final rollout. Initial read-only service upload failure was corrected; historical failed synthetic smoke rows are retained honestly.
- Eight message integration scenarios (9 Node tests), five message-client cases, DB clean/v4 upgrade preserving native credentials/calls/transcripts, runtime permissions and existing unit/account/native/browser/JS-export checks pass. Real browser test closes sender page before recipient enrollment/play/reply. Additional fixtures verify in-progress send retry, logout during a partial stream, decoder network refusal, processing/orphan recovery, file-write failure and metadata/media restore. Added aggregate message status and an explicit no-push synthetic media smoke command.
- Final app source a531f02 compiled as iPhone 6f97fb13-92ed-4b1c-8e7c-3b3de16e2f09 and Android 8f1f8545-4d05-49b6-aef7-664af3ebb28a; earlier message builds are superseded. Final bundled-JS/calling entitlement/media-handler package checks and updated install QR are retained privately. Backend/source changes are reconciled into canonical feat/webrtc-poc; stage12 remains for audit.
- Owner installed earlier iPhone 9242ea52 and confirms recording and sending work; playback/reply/call-interruption/Android results remain unconfirmed. Issued fresh Provider-only private code file enrollment-1795038082921.txt on request, without changing phone sign-in or revoking other unused codes. Updated PRD/state/resume/plan/roadmap/tools/testing/database artifacts. Docs and whitespace checks pass; physical acceptance is still open, with no transcription/video/Twilio or message time-credit claim.

## 2026-11-18 Owner confirms patient-message playback by provider

- Owner confirms provider can play the patient's audio message. Recorded patient -> provider playback in the current iPhone/desktop workflow; no new build/OS/browser specifics inferred.
- Updated state, active plan and device evidence. Provider -> patient playback/reply and remaining seek/interruption/Android cases remain open. Documentation/whitespace checks pass; no runtime or schema changes and no additional calls/notifications.

## 2026-11-18 Owner confirms two-way audio messages; Patient A code reissued

- Owner confirms the provider reply plays on the iPhone. Basic patient -> provider and provider -> patient recorded-audio exchange is now owner-confirmed. Other controls/interruption/Android checks remain open; no build/OS details inferred.
- Added a fixed synthetic Patient A-only CLI enrollment option and issued the requested code into private enrollment-1795039888000.txt (600, one-use/24h). No other account/session/code revoked. Actual issuance and docs/whitespace checks pass; no native build, service restart or schema change needed.

## 2026-11-18 Persistent browser sign-in implementation

- Owner asked to keep browser sign-in across reloads. Implemented isolated plan 0013/ADR 0009: host-only Secure/HttpOnly/SameSite=Strict cookie, fixed 30-day revocable session, guarded restore/logout, stale-account protection and open-tab bearer adoption. Enrollment codes remain one-use; no token/code is stored in Web Storage. Native/CLI bearer contracts and current DB schema are retained.
- Real HTTPS Chromium/isolated MariaDB session suite passes four scenarios (5 Node tests), including reload/new-tab/profile restore, cookie flags/JS invisibility, signout/revocation, fixed expiry, hostile Origin/missing guard/wrong-account rejection and legacy adoption. Seven client tests, existing account/message/native/unit and 13 local browser call cases pass. No native build or migration needed. Deployment/public confirmation follows between calls.

## 2026-11-18 Saved browser sign-in deployed and publicly verified

- Verified zero active calls/connections before source rollout; canonical browser/backend updated and project service restarted. Public real HTTPS synthetic smoke passes saved login, reload/new tab, cookie flags, legacy-tab adoption and logout without sending calls/messages. All 13 public browser calling scenarios pass after rollout. Service health is good; one active remembered browser session remained after smoke cleanup, without inspecting owner credentials.
- Added reusable `test:browser-session` and no-call `smoke:browser-session`, updated state/resume/PRD TEAM-03/roadmap/tools/database/testing and plan/ADR 0009. Existing native builds/credentials and five-migration ledger are unchanged. Private logs retained under browser-sessions artifacts. Owner was instructed to foreground the existing tab briefly and reload; personal confirmation remains pending.
- Documentation and whitespace checks pass. No EAS submission, schema change or extra enrollment is required for a currently valid open tab; the saved cookie can be revoked by Sign out and expires after 30 fixed days.

## 2026-11-19 UTC (2026-11-18 America/Los_Angeles) Video-message implementation plan

- Owner requested an implementation plan following the video-message feasibility discussion. Created plan 0014 for two-way native/browser video-with-sound messages in existing patient history: camera choice, preview/re-record/send, private poster, progress/retry, later playback, proposed two-minute/720p/30 limits and existing audio preservation.
- Inspected current source/contracts/migration 0005 and primary SDK 57 camera/video/browser recording references. Read-only host snapshot shows 2 vCPUs, 7.6 GiB RAM (about 3.8 GiB available), no swap and about 35 GiB free media-filesystem space. This is not a capacity benchmark. Plan requires kind-specific decode budgets/leases, bounded queue/storage reservations, old audio-client compatibility, additive next migration and native call camera/audio handoff evidence.
- Updated PRD COM-12/M4, roadmap, agent/readme navigation, tools/database/testing proposals and state/resume handoff. No runtime changes, package installation, migration/DB writes, service restart, native build or video acceptance performed. Existing 0011/0012 physical gates stay open.
- Documentation link/requirement and whitespace checks pass; no application tests rerun for documentation-only changes. Next action after implementation is requested: isolated-worktree capture/player and maximum-clip processing prototype, followed by confirmed ADR/limits.

## 2026-11-19 Video-message implementation and development rollout

- Owner requested implementation of plan 0014. Isolated source in stage14/feat/video-messages; source commit 5257f58 adds native/browser video-with-sound record/preview/re-record/send/play, camera choice, progress/cancel/retry, mixed history/private posters, v2 compatibility and guarded native camera/player call hooks with forced source builds. Audio behavior and current patient/session boundaries are preserved.
- Seven video scenarios (8 Node tests), eight message-controller cases, TypeScript, existing 58 unit/server cases, audio/account/native/browser-session/client regressions and clean/0005 data-preserving migration/recovery pass. A concurrent DB-suite start was correctly refused by the existing lock; it was stopped and rerun sequentially to pass. Fixed test client numeric metadata and patient selection assumptions during development; final real Chromium capture/preview/send/page-close/later play/reply passes. New long-upload regression crosses the previous ten-second server deadline.
- A full 120s 720p/30 sample produces 31,295,825-byte MP4 and 5,543-byte JPEG. Conversion took 34.69s alone and 67.926s while all 13 local call scenarios passed; latter peak RSS 131,864 KiB and about 7ms max Node timer delay. Selected bounded per-kind processing/upload/queue/storage limits are in ADR 0010; physical/native and sustained capacity remain distinct.
- Backed up project metadata/media/server/nginx config privately, verified zero active calls/connections, stopped only Phoneapp signaling and fast-forwarded canonical source. Applied additive 0006; six migrations/24 domain tables current and runtime permissions pass. Expanded only project media-route proxy limits. Started video off and verified public audio, then enabled video between calls. Public video upload/conversion/shared history/Range/private poster, saved browser-session smoke and all 13 public call scenarios pass without ringing owner devices.
- Doctor 21/21, both native JS exports, prebuild/autolinking and source archive private-file exclusion pass. Paid bundled previews submitted with existing valid credentials: Android cf9cb8e5-f47f-4c11-9853-01f71ca098fc and iOS 0ccc496a-5c9b-408e-9e45-2692e6775c4e, compiling at this checkpoint. Finish native/package/QR checks and owner device handoff. Browser owner preview feedback requested; no hardware acceptance inferred. Prior physical gates and future Twilio/transcription/billing scope stay open.

## 2026-11-19 Final video-message cancellation guard and native previews

- Both initial video previews compiled and pass actual iPhone signed/profile APNs/bundled-JS/camera/video/calling and Android manifest/module/bundle package checks. Final review found a stale async capture/player continuation after account change; source ad7846a adds ownership checks across cleanup/preparation/player replacement, and tests cancellation during draft cleanup. Existing delayed-permission test now explicitly reaches the pending-permission state before interruption.
- TypeScript, nine controller cases, the seven real video scenarios (8 Node tests) and both native JS exports pass after the fix. Published the matching browser assets between calls and verified health/public asset digest. No additional schema, native module/patch, credential or infrastructure change.
- Submitted final bundled previews from ad7846a: Android fc647cfd-bd6a-488d-a4bf-d407abf7aa8d, iOS e78902fd-28a6-4816-85ff-db11ddb7749b. Earlier 0ccc496a/cf9cb8e5 are superseded. Owner was offered the earlier iPhone for basic testing while final previews compile; no owner video acceptance has been reported. Complete final package/QR checks and handoff before marking native delivery complete.

## 2026-11-19 Final native previews and recovered iPhone video messages

- Final app-source ad7846a previews iOS e78902fd-28a6-4816-85ff-db11ddb7749b and Android fc647cfd-bd6a-488d-a4bf-d407abf7aa8d both FINISHED and pass actual package checks. iPhone retains signed/profile Production APNs/calling identity, bundled JS and camera/video hooks; Android retains calling permissions/modules/bundle plus camera/video modules. Final install QR images regenerated. No physical cross-platform acceptance inferred from package inspection.
- Owner confirms phone patient UI recording, preview and send, but reported no new desktop message. Both uploads reached storage and failed exact-stream validation because iPhone adds an opaque mebx data track. Backend fix 3f3879e accepts only that known extra track and strips data/subtitles; output must contain exactly audio/video. A synthetic regression proves three-track input normalization and rejects a different extra tag. Expanded eight video scenarios (9 Node tests), TypeScript and audio integration pass.
- Verified zero calls/connections and published only the processor fix. Privately snapshotted recovery metadata and checked source hashes; requeued both saved unpublished videos under existing message IDs. Both are Available with audio/video streams/posters verified. A fresh temporary Provider session confirms actual public v2 history and authenticated Range access for both, then signs itself out. Existing owner sessions, native builds, schema and provider keys are unchanged; no re-recording/new build needed for this fix. Owner instructed to refresh desktop; actual receiver viewing remains unreported. Private recovery details/logs are retained under video rollout artifacts.
- Updated plan/state/resume, tools/testing/ADR/PRD/roadmap/evidence. Documentation/whitespace checks pass. Remaining acceptance: desktop viewing, video replies/native playback/sound/orientation/seek/full-screen, Android and native call/background/headset/logout interruption, plus earlier physical gates.

## 2026-11-19 Owner confirms recovered video-message flow

- Owner confirms the reported missing desktop video-message issue now works after the metadata processing fix/recovery. Basic phone patient -> desktop provider video messaging is owner-confirmed, following the earlier phone record/preview/send result.
- Updated current state/resume, plan and evidence. No additional build/OS/browser or per-control results inferred. Provider -> patient/native receiver, Android and interruption/control matrices remain open. Documentation/whitespace checks pass; no runtime/schema/build/service changes for this confirmation.

## 2026-11-19 Owner confirms video reply and discusses history navigation

- Owner confirms provider desktop -> phone video reply works, following confirmed phone -> provider desktop exchange. Basic two-way phone/browser recorded video messaging is accepted; individual controls, exact device/build versions, Android and interruption matrices remain open. Updated state/resume, plan and evidence.
- Inspected the history UI for the owner's discussion question: account Call history predates messages and lists the signed-in user's recent calls across patients; Communication history combines calls/messages for a selected patient. A single patient timeline with Calls/Messages filters is a proposed simplification for discussion, not an approved implementation/UI change.
- Documentation/whitespace checks pass. No runtime/schema/build/service change.

## 2026-11-19 Unified communication workspace implementation plan

- Owner requested an implementation plan for one Communication log/detail with content format, recipient/status, retained media, transcription, concise AI clinical notes and staff comments. Created plan 0015 with seven staged releases: unified existing log/detail; staff workflow/receipts/comments; in-app text/threads; exact-original preservation and saved-message STT; source-linked reviewed AI notes; staff work/time links; dependency-gated live-call/Twilio/SMS integrations.
- Inspected current history UI/contracts and call-scoped transcript/activity schema. Plan preserves source-specific call access/IDs, distinguishes original recipient from mutable work owner and receipts from resolution, requires source/version/audience checks for all derived artifacts, and avoids reconstructing already-deleted original uploads. Vendor/model/retention/call-media choices remain explicit future stage decisions rather than blockers to the first workspace slice.
- Updated PRD to 1.4 with seven new requirements (COM-14–16, TX-07–08, REP-05–06), roadmap/architecture, agent/readme navigation and state/resume, plus database/tool/test planning notes. No source/runtime/DB/provider/build/deployment change. Documentation/link/requirement/whitespace checks pass; application/device/provider checks were not rerun for planning. Next action after implementation is requested is Stage A and its identity/access/backfill ADR in an isolated worktree; existing physical gates remain open.


## 2026-11-19 Unified communication workspace Stage A

- Owner requested implementation of plan 0015. Built Stage A in isolated stage15 / `feat/communication-workspace`: append-only patient-consistent registry, transactional source registration, additive reconciliation, authorized server-side overview/filters/cursor detail and one native/browser call/media history. Preserved source IDs, call participants, sender-only drafts, published media audience, enrollment/sessions and active-call controls outside filters. Receipts/call format/media origin/exact originals remain honestly unknown/off/unavailable; patient payloads omit future staff sections. Stages B–G remain planned.
- Added ADR 0011 and migration 0007. Test clean upgrade/recovery and new seven workspace scenarios (8 Node tests), five client race/media cleanup cases, existing audio/video/account/native/browser-session, 58 unit cases, 13 local call cases, TypeScript, Doctor 21 and both exports pass. Initial disabled-context response regression corrected before rollout. Archive includes required client/native patch files and excludes secrets/server/private artifacts.
- Between calls, took private DB/media/config snapshot, applied migration/grants and fast-forwarded canonical source to 663e036. Corrected root ownership of the completed media backup before proceeding. Exact twelve-table source/auth dump preservation and source timestamps pass; registry has 34 rows, reconcile inserts 0, runtime grants/current schema pass. Public feature-off session smoke passes; enabled workspace and verified all 34 legacy source IDs exactly once, saved reload/Range playback and all 13 public WebRTC cases. Workspace checks send no owner calls/messages/pushes.
- Submitted authorized bundled previews from `663e036`: iPhone `8fadedcf-dbf1-4a12-bc08-b1cf085befcf` and Android `0a34278e-c78a-4ac1-801e-d7c5db51e41a`. Native builds/package/device handoff still in progress at this checkpoint. Existing paid speech/model services, text, staff work/receipts/comments, original retention/transcripts/notes, live capture and Twilio were not added.

- Follow-up test commit `53a3968` selects the playable fixture by stable source ID (random equal-time drafts previously made the selector flaky), checks narrow 360px browser detail and verifies both-source/zero-source registry checks independently of uniqueness. All 8 workspace Node tests pass; no app/runtime behavior changed. iPhone 8fadedcf finished and actual IPA/push/calling/bundle checks pass; QR refreshed and owner offered install/test. Android still compiles. GitHub connector PR edit was 403; existing authenticated CLI updated the draft without changing review state.

- Both `663e036` native previews are now FINISHED and actual IPA/APK package checks pass; both JS bundles contain the workspace, signed/profile Production APNs and calling/media capabilities are retained, and both install QRs are refreshed. Android public APK and iPhone install links are in current state/evidence. No new signing/dependency/provider change. Owner iPhone history/playback test was requested and remains unreported; all physical gates stay open. Updated final state/resume/plan/PR evidence and pushed the feature branch without merging the draft.


## 2026-11-19 Owner iPhone history navigation and polling discussion

- Owner installed 8fadedcf as Patient A, confirms unified filters/source rows/detail opening, and reports bottom-of-list detail placement plus periodic vertical jumps/button flicker. Playback remains unconfirmed.
- Inspected source: workspace polls every four seconds, always sets loading true/false, inserts/removes a visible loading row, disables/re-enables filter controls and republishes unchanged metadata. Recommended overlay with upper-right Close and retained list position; silent change-only polling with a new-items indicator while reading/scrolled down. User requested thoughts on overlay versus inline expansion; recorded the proposal without implementing UI or submitting builds.
- Updated state/plan/evidence for continuity; documentation/link/whitespace checks only. No runtime/schema/service/provider changes.


## 2026-11-19 Owner proposes edge-to-edge history and email-like details

- Discussed removing history/detail outer gutters while retaining inner padding/safe areas, patient-first list rows with upper-right type icons, and a full-width overlay with fixed upper-right Close/Reply. Detail uses From/To/Date and video-surface play/pause, removing duplicated source/technical headings and bottom reply/close buttons. Prior quiet-polling correction remains part of the proposed usability work.
- Inspected current App padding, workspace/message containers and native video controls. Existing recorded audio/video capture can support message reply choices; live-call menu availability needs role/capability handling because patient-originated calls and a distinct app-audio action are not implemented. CC/Forward remains future directed communication with explicit audience and original attribution.
- Recorded the proposal in parent plan/current state. User requested thoughts; no UI/source/schema/service/build changes were made. Documentation/whitespace checks pass; phone acceptance/playback results remain as previously recorded.


## 2026-11-19 Audio/video scrubber added to proposed UI iteration

- Owner requests a scrubber for both media types. Added draggable seeking plus elapsed/total duration to the pending history/detail/player iteration, preserving play/pause state and existing media/call interruption behavior.
- Updated plan/current state; documentation/whitespace checks only. No player implementation or native build is claimed in this design follow-up.


## 2026-11-19 Future media/transcript/summary selector

- Owner specifies future Media/Transcript/Summary selection near the top of detail. Added to the pending UI scope: remove the bottom Transcript heading/status now; introduce the top selector with actual artifacts, defaulting to Media and preserving source/role access.
- Plan/state updated and documentation/whitespace checks pass. No UI/runtime/build changes are claimed in this scope discussion.


## 2026-11-19 Patient versus caregiver patient-selection discussion

- Owner questions redundant All patients/Patient A controls and suggests a caregiver supporting two elders. Recommended hiding the patient selector for one authorized patient, retaining identity and All/Calls/Messages; use a one-patient-at-a-time switcher for multiple authorized patient records, while staff retain an overview. Caregivers use their own identity; replies remain tied to the source patient.
- Verified current schema distinguishes self/caregiver patient bindings and backend enforces active authorized relationships. This does not claim caregiver onboarding or multi-patient UI acceptance. Added the proposal to plan/state; no runtime/build changes. Documentation/whitespace checks pass.


## 2026-11-19 Consolidated history usability implementation plan

- Owner adds a year/month/day popup for date filtering and requests a plan covering all UI discussion. Created 0016 as the focused Stage A follow-up before parent 0015 Stage B, consolidating edge-to-edge history/detail, compact patient-first rows/type icons, From/To/Reply, play/pause/scrubbers, removed technical/transcript placeholders, future Media/Transcript/Summary, patient/caregiver switching and quiet change-only refresh with retained list position.
- Date picker specifies From/To draft selection, direct year/month/day, Cancel/Done/Clear/Apply, leap/month validation and existing inclusive Pacific civil-date semantics. Implementation steps and acceptance cover stale access/races, new-item indicators, overlay focus/scroll/drafts, unsupported calling, actual media seeking/interruption, responsive/accessibility, safe browser rollout and both native previews/device gates. No migration or unverified native dependency selected.
- Replaced the parent's duplicate proposal checklist with the focused plan link; updated AGENTS/readme/state/resume/PRD/roadmap/tools/testing navigation. Plan is ready; implementation has not started. No source/runtime/schema/service/provider/EAS build changes. Only documentation/link/requirement and whitespace checks are run for planning.


## 2026-11-19 History usability implementation checkpoint

- Owner requested plan 0016 implementation. Built source in isolated stage16/feat/history-usability: native root/browser dialog overlays retaining list state, full-width patient-first records/icons, From/To/Reply with in-overlay recording, custom media controls/scrubbers, calendar overlays and quiet changed-content refresh. Unsupported live calls/artifact features remain unavailable. Native HTTP 403/404 codes are preserved to distinguish access loss from transient offline state. No schema/dependency/provider/credential change.
- Shared/controller tests 11, message tests 10, account-client tests 8 and expanded nine workspace scenarios/10 Node tests pass, including real browser audio/video seeks, recipient reply, calendar/scroll/two-poll stability and caregiver filtering. Existing audio/video/account/native/session/unit/browser regressions pass; Doctor 21 and both final exports pass. Private fixture screenshots inspected. Final source archive/public rollout and both native previews/package/owner acceptance remain next.

- Published browser source ae77c90 between zero active account calls/WebSockets with private prior-asset/source backup. Public authorized 34-source parity/reload/Range, saved browser login/logout and all 13 WebRTC cases pass; no owner rings/messages from workspace/session smokes. First native previews were canceled to include final draft retention: idle workspace remains mounted/hidden during live calls and posters use per-lifetime filenames. TypeScript, both exports and eleven message-client cases pass after the fix. Replacement previews/package checks remain in progress.
