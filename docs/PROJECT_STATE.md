# Current project state

Updated: 2026-11-17 UTC. M0 complete. **M1 in progress: runtime foundation implemented; native/device acceptance pending.** Branch: `feat/webrtc-poc`.

Review: [draft PR 1](https://github.com/cnm4us/phoneapp/pull/1). Native foundation commit: `4874959`; browser implementation and follow-up documentation are on the same branch at newer commits. Do not switch the live checkout to `main`, which does not yet include the runtime code.

## Implemented

- Native audio/video app: expiring rooms, join/share, mute/camera/switch/hangup, connection state, experimental connected time, and redacted connection diagnostics.
- Node/WebSocket signaling: authenticated room creation, two-peer limit, payload validation, expiry/cleanup, scoped TURN credentials.
- Live HTTPS/WSS at `https://phoneapp.bawebtech.com`, dedicated nginx site and `phoneapp-signaling.service`.
- Authenticated coturn (`phoneapp-turn.service`) with UDP/TCP/TLS, quotas, bounded relay ports, certificate and renewal hook.
- EAS project [@mbcollins2/phoneapp](https://expo.dev/accounts/mbcollins2/projects/phoneapp), ID `942392a3-1d9c-4d2c-91b0-0ad939e4e1fd`; both development profiles and app identifiers configured.
- Pinned dependencies, automated server/core/browser tests, local check/smoke/relay tooling, and [setup/runbook](SETUP.md).
- Quality iteration: shared policy/stats/controller, native/browser presets and advanced directional caps, audio-only/consent, serialized renegotiation, full screen, and quality/feedback UI. Browser/server deployed; physical native acceptance pending.
- Browser companion deployed at `https://phoneapp.bawebtech.com`: invitation creation/copy/share link, audio/video, mute/camera/leave, connected time, playback recovery, and optional connection details. Compatible feature negotiation added; no new phone build submitted.

No patient database, recording, transcription, SMS, or billing implementation. Hosted CI is not enabled because available GitHub credentials cannot write workflow files; the template remains available.

## Active plan and next action

Current testing-usability iteration: [0004](plans/0004-call-testing-usability.md), implemented/deployed. Owner confirms the stable full-screen renderer works, but initially the picture occupied only the top third. Fixed a hidden ScrollView still consuming height and added Fill screen / Show whole video. Revised full-height/crop presentation confirmation is pending. New invitations are eight-digit codes, with rate-limited POST resolution and legacy compatibility. Rooms default to four hours from creation; clients show remaining room lifetime separately from connected time. Two missed heartbeats are tolerated and close cause/code are logged without client payloads. [Verification](testing/2026-11-17-call-usability.md): 38 unit/server cases, 13 public browser scenarios, both native JS exports, nginx config all pass. Only the project hostname gained `/rooms/resolve`; no TURN/DB/dependency/build change.

Active plan: [0001 WebRTC proof of concept](plans/0001-webrtc-poc.md). Keep it open until both physical phones pass its matrix.

Supporting plan: [0002 browser companion](plans/0002-browser-companion.md), implemented/deployed with automated acceptance. Next action: capture the device/network details of the owner's reported successful use and complete the remaining native/Safari and original iPhone/Android matrix when devices are available. Both native builds succeeded. Public signaling, TURN, and browser media tests pass.

Owner subsequently reported the first round is working well. Detailed device/network scenarios and measurements have not been logged, so the formal matrix remains open.

Current quality plan: [0003](plans/0003-adaptive-call-quality.md), implemented with physical acceptance and Ultra capacity gates open. Shared native/browser controls include Auto/High (up to 1080p/60), lower presets through 240p, advanced send/receive caps, measured media/audio feedback, audio-first pause/recovery, two-way audio-only, consent-aware camera restoration, and full screen. Signaling negotiates compatible controls and serializes camera renegotiation. Browser/server changes are deployed; no native dependency/build or live TURN quota changes. Experimental 4K/60 at 30 Mbps remains gated off, including native capability investigation. See [verification](testing/2026-11-17-adaptive-quality.md) and [decision](decisions/0003-adaptive-quality.md).

Latest device report: owner confirmed video works between the iPhone app and browser after leaving coordinated audio-only mode and enabling cameras locally. The initial missing-video report showed “Audio only confirmed both directions”; changing the selected mode resolved it without runtime changes. This is owner-reported restoration evidence, not a completed device/network/quality matrix; phone model/OS and browser/network details remain unrecorded.

Exact next action: owner reloads the Expo app, creates a fresh test call, and verifies the full-height video frame/controls at the bottom plus Fill screen / Show whole video. Basic full-screen rendering is owner-confirmed; revised geometry and sustained-call acceptance remain open. The reported 6:50 call ended from a participant connection closure before its original 30-minute room expiry; both screens reportedly stayed visible, and the original transport/client cause is unresolved. Use new close diagnostics if it recurs. Record device/browser/network details and sustained-call outcome; keep full M1 and Ultra gates open.

## Decisions and constraints

- One native iOS/Android codebase; EAS cloud builds; Windows/VS Code with an EC2 checkout.
- Physical test devices: owner's iPhone and wife's Android. Models/OS versions and device access are not yet recorded.
- First experiment: foreground two-person WebRTC audio/video using synthetic data, with separate-network and forced TURN tests. Versions/hosting are recorded in [decision 0002](decisions/0002-webrtc-implementation.md).
- HIPAA implementation is deferred. No recording/transcription or real patient work in M1.
- Agent manages future database changes via migrations. PostgreSQL is proposed for persistent product data; no DB/provider/ORM is selected or provisioned.
- [Decision 0001](decisions/0001-project-direction.md) records established user direction.

## External setup still needed for M1

- Owner confirmed inbound TURN rules were added. Public UDP/TCP/TLS relay samples each received 10/10 packets. The EC2 role still cannot inspect/manage security groups; no AWS rules were changed by the agent.
- [Android build 2cf8e5a8](https://expo.dev/accounts/mbcollins2/projects/phoneapp/builds/2cf8e5a8-cb84-44f6-8189-a1faf3e31a9c) and [iOS build 0e5beca1](https://expo.dev/accounts/mbcollins2/projects/phoneapp/builds/0e5beca1-cdcd-4d69-9c85-90f26667e21d) finished successfully. Owner reports the native iPhone screen is loaded. Keep the current encryption declaration scoped to this standard-crypto POC; reassess before public distribution/new cryptographic features. iPad native provisioning is not required for browser access, and Safari/native calling remains a physical-device check.
- Owners install builds and perform physical-device tests. This EC2 session cannot currently control either phone.

Development services follow this checkout; stop or account for them before changing branches/dependencies. Build the allowlisted browser assets with `npm run build:web` before restarting signaling, which loads them into memory. Private `.env.server` and `/etc/phoneapp/turnserver.conf` contain generated secrets and are excluded from Git/EAS uploads. Metro was started on port 8081 with a tunnel; recheck it for native development clients. The browser page uses the public site directly and does not need Metro.

## Verification

- Server inspection: 2 vCPUs, 7.6 GiB RAM, approximately 38 GB free disk at project initialization.
- Git, GitHub CLI authentication, Node 22.21.1, npm 10.9.4, and Python 3 were observed. Docker and `psql` were not found on PATH. Recheck capabilities before depending on them.
- `npm run typecheck`: app/server/browser/browser-test checks pass. `npm test`: 38/38 pass (including asset security/routing). Prior native Expo Doctor: 21/21 pass; no native dependency changes for the companion.
- Native configuration generated for both platforms; permissions and iOS scene manifest inspected. iOS/Android JS bundles exported successfully; native compilation is separate.
- Public HTTPS/WSS room/offer/answer/hangup smoke: passed, with no media exchanged.
- Local and public authenticated TURN UDP/TCP/TLS samples: 10/10 packets received in successful samples. Earlier TLS diagnostics exposed sample loss/parallel-user quota collisions; slower uniquely named probes and bounded quota headroom resolved the diagnostic failures.
- Browser tests: 7/7 on the public HTTPS deployment in Chromium, including actual synthetic audio/video, repeat calls, controls/cleanup, forced relay candidate/media verification, audio-only/video mix, permission/room errors, playback fallback, fragment cleanup, and responsive widths. See [browser report](testing/2026-11-16-browser-companion.md). iPad viewport tests are not Safari/iPad hardware tests.
- Physical acceptance: owner reports successful initial use; the device pair, network conditions, and structured matrix results have not been captured. M1 is not complete. Prior foundation evidence: [verification report](testing/2026-11-16-poc-foundation.md).
- Quality verification: 31 unit/server/adapter tests and 12 public browser media scenarios pass; both native JS exports pass. Isolated real-UDP shaping passed strong → constrained/loss → severe → recovery with audio counters continuing and gradual video return. See the linked quality report for limits. No new cloud build, WAN capacity claim, perceptual-audio result, or physical-device pass.
- Documentation and whitespace checks pass; implementation, test evidence, tools, and handoff are updated.

## Resume prompt

“Read AGENTS.md, docs/PROJECT_STATE.md, docs/TOOLS.md, plan 0004 and its verification. Eight-digit test codes and four-hour rooms are deployed; native full screen uses one stable renderer. Owner confirms full-screen rendering; the revised full-height/Fill presentation and sustained-call checks remain pending. The earlier 6:50 ending was not expiry. Keep M1/Ultra gates open and inspect new close diagnostics if calls end early.”
