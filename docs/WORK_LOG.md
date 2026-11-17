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
