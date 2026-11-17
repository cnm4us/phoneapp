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
