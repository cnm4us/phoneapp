# 0003 Adaptive call quality and audio-first controls

Status: ready for implementation; implementation not started. Updated: 2026-11-17 UTC. Requirements: COM-07, COM-08, COM-09 in [the PRD](../PRD.md).

## Outcome and scope

Provide native iOS/Android and browser participants with very high video ceilings, simple controls for reducing quality, automatic adaptation below their selected ceilings, and an explicit two-way audio-only mode. Protect intelligible, low-latency speech throughout. Full-screen viewing works at every resolution; lower-resolution video looks softer when enlarged.

This plan covers foreground, two-person calls using the existing infrastructure. It does not add recording, clinical data, background calling, telephone/SMS integration, or database persistence. Creating this document does not change live settings or submit EAS builds. The original [M1 physical-device matrix](0001-webrtc-poc.md) remains open.

## Current evidence

First-round native and browser calling is deployed. The owner reports successful use; device/network details and measured quality were not captured. Native capture requests 640x480 at 24 fps; browser capture requests approximately 640x480. Neither client implements these presets, sender bitrate limits, coordinated receive limits, an application audio-first controller, or coordinated audio-only mode. Current camera toggles are local controls.

Relevant implementation: [native session](../../src/call/session.ts), [native UI](../../App.tsx), [shared helpers](../../src/call/core.ts), [browser call](../../web/call.ts), [browser UI](../../web/main.ts), [protocol](../../shared/protocol.ts), and [server](../../server/index.ts). Current signaling accepts one initial offer/answer; later renegotiation needs an explicit protocol extension.

Installed `react-native-webrtc` 155.0.1 exposes sender `maxBitrate`, `maxFramerate`, `scaleResolutionDownBy`, `active`, and `degradationPreference`. These APIs still need device verification. Its video track `getCapabilities()` is unimplemented, and its encoding wrapper does not expose browser priority properties. Use `getSettings()`, safe constraint attempts, and actual RTP statistics to establish support. A resolved native `replaceTrack()` promise alone is insufficient evidence: this version catches native errors internally.

Current [TURN template](../../deploy/turnserver.conf.example) sets `max-bps=1000000` and `bps-capacity=12000000`: 8 Mbps per allocation and 96 Mbps aggregate in each direction, respectively. These are configuration limits, not measured EC2 capacity. Inspect the project's effective configuration before implementation; never print its secrets.

## Quality controls and initial ceilings

These are proposed engineering starting values, to be tuned through testing. Mbps means decimal megabits per second. Video bitrate ceilings exclude audio and transport overhead. They are limits, not reserved bandwidth or promised output. WebRTC congestion control continues adapting below them.

| Selection | Maximum video dimensions, landscape | Maximum frame rate | Video bitrate ceiling | Intended behavior |
| --- | --- | --- | --- | --- |
| Auto — default | 1920x1080 | 30 fps | 6 Mbps | Start around 720p/24; adapt upward only with measured headroom. |
| Ultra — opt-in, experimental | 3840x2160 | 60 fps | 30 Mbps | Highest ceiling, subject to capture, codec, thermal, receiver, and relay support. |
| High | 1920x1080 | 60 fps | 8 Mbps | Favor smooth motion on capable devices/networks. |
| HD | 1280x720 | 30 fps | 3 Mbps | Moderate bandwidth with clear video. |
| Standard | 854x480 | 30 fps | 1.2 Mbps | Reduce pixels while preserving motion. |
| Data saver | 640x360 | 24 fps | 0.45 Mbps | Smaller, smoother video on constrained links. |
| Minimum | 426x240 | 15 fps | 0.2 Mbps | Lowest video rung before pausing video. |
| Audio only | No video RTP | Not applicable | 0 video | Continue audio and signaling; suppress video in both directions. |

Preserve the source aspect ratio and portrait orientation within the selected envelope; do not stretch frames to match these examples. Camera/codec limitations may make 4K/60 unavailable or produce less. Ultra remains unavailable where its prerequisites are unverified; show the supported fallback and reason.

Before joining and during a call, expose a **Quality** selector and a separate **Audio only** action. Initially link outgoing and incoming quality limits so Data saver helps both upload and download. Advanced controls allow separate send/receive preferences, resolution ceilings from 240p through 2160p, frame-rate ceilings of 15/24/30/60, and video bitrate limits within 0.15–30 Mbps. Clamp combinations to supported envelopes. Keep advanced controls out of the primary call flow.

Show the selected ceiling separately from measured sent/received dimensions, fps, and bitrate. Label adaptations such as “Reduced to protect audio,” “Limited by other participant,” and “Device limit.” Show pending or unsupported remote requests honestly. A remote request can reduce a limit; it cannot raise the local ceiling or activate a camera. Full screen changes the display layout independently of capture resolution.

## Policy and media behavior

### Limits in both directions

For each outgoing stream, calculate the component-wise minimum of the local sending ceiling, the peer's receiving ceiling, verified device/codec capabilities, the current audio-first budget, and any applicable relay limit. The peer performs the same calculation for the opposite direction. Reconcile updates deterministically; missing capabilities are unknown, not permission to choose the maximum.

Keep user preference, currently applied settings, and measured output as separate state. Manual presets are upper bounds; the controller can go lower. Do not impose a positive minimum video bitrate that competes with audio. A receiver experiencing trouble requests a lower incoming budget instead of merely reducing its own camera resolution.

Apply limits using fresh sender parameters and serialized updates. Prefer sender bitrate, scaling, and frame-rate controls; request `maintain-framerate` degradation where supported. Adjust capture constraints to the active envelope to avoid capturing 4K continuously while sending 360p. Preserve the audio track, connection, and call timer through quality changes. Verify results through sender parameters and RTP stats; failed/unsupported changes fall back without ending usable audio.

### Audio-first controller

WebRTC's own congestion control remains enabled. Application policy reduces video promptly when audio suffers and restores it slowly. Browser priority controls may help where supported; native behavior must use exposed APIs. Packet priority cannot guarantee treatment by Wi-Fi, routers, carriers, or the public internet.

Poll stats about once per second and evaluate a rolling five-second window. Derive rates from timestamp/counter deltas; handle counter resets, stale reports, and negative loss corrections. Distinguish inbound audio from remote feedback about outbound audio. Where available, use audio packet loss, concealment ratio, jitter-buffer delay, RTT, available outgoing bitrate, and video CPU/bandwidth limitation indicators. Missing stats, muted microphones, and silence are not evidence of packet loss. Never record audio to measure quality.

Initial controller thresholds below are hypotheses for controlled testing, not validated clinical or network guarantees:

| Condition | Proposed response |
| --- | --- |
| Audio loss above 3%, concealment above 5%, or jitter-buffer delay above roughly 120 ms, sustained across three evaluations with corroborating evidence | Reduce video bitrate and resolution one rung; preserve useful motion where possible. Coordinate the affected remote sending direction when needed. |
| Audio loss above 8% or concealment above 10% for about three seconds | Pause video promptly; retain audio. Confirm actual video suppression. |
| CPU limitation or growing delay | Reduce capture/encode work; RTT alone does not establish congestion. Compare with baseline and other indicators. |
| About 20 seconds of stable audio, loss below 1%, and adequate headroom | Recover one rung at a time, no faster than every ten seconds, below all user/device/peer limits. |
| Missing or unreliable measurements | Keep conservative limits, offer audio-only, and do not automatically escalate to Ultra. |

When an outgoing capacity estimate exists, initially leave 20–30% headroom and a conservative allowance of about 128 kbps for audio and overhead before assigning a video budget. This is a budgeting heuristic, not a network reservation or a claim that every audio codec needs that rate. Tune against actual transport measurements. Avoid long buffering that turns conversation into delayed speech. Network failure can still interrupt audio.

### Explicit audio-only and camera consent

Either participant may request two-way audio-only; video stays off while either participant retains that request. Clearing one request cannot override the other. Track local camera intent separately from the call-wide mode.

Stop outgoing video encoding, ask the peer to do the same, and acknowledge application of the request. Verify that video RTP ceases after a bounded drain period; RTCP and connectivity checks may continue. A disabled track alone can still encode black frames and is insufficient proof. Release camera capture for manual audio-only where supported while retaining audio and the session.

Returning to video requires explicit local camera intent. A remote “request video” prompts the local user; it never turns on their camera. Automatic recovery from an application-imposed video pause can retain prior consent only while the call is foregrounded and neither participant has requested audio-only or manually disabled video. If reacquisition requires a user gesture, show a resume action.

Use sender controls or `replaceTrack()` inside the negotiated envelope where possible. Initial audio-only calls currently have a receive-only video transceiver; adding local video later may require a direction change and renegotiation. Serialize this through a designated offerer, preserve audio during negotiation, and retain the last usable configuration on failure. Do not recreate the connection merely to change quality.

## Signaling compatibility

Extend the authenticated two-person room protocol; retain existing authorization, expiry, payload bounds, and rate controls. Proposed event names are design placeholders until implementation:

- Add server protocol/features metadata to `joined`. New clients initially use the existing join shape because old servers reject unknown keys. Send capability/control messages only after advertised support, and forward new messages only when both peers support them. Test existing installed clients against the upgraded server.
- Add bounded media-policy requests and applied acknowledgments with request IDs and monotonically increasing revisions. Validate finite bitrate/dimension/fps values and enums; bind each update to its actual room member. Debounce rapid changes, ignore stale/duplicate revisions, and reconcile simultaneous restrictions by taking the more restrictive limits.
- Include independent audio-only requests, supported control capabilities, and explicit video-restoration requests. An acknowledgment reports what was applied, including fallback reasons. A missing acknowledgment after roughly five seconds remains pending/limited, never falsely “two-way audio-only confirmed.”
- Extend the server's single-offer state machine for serialized renegotiation. Keep the original initiator as designated offerer; the other peer requests negotiation. Track outstanding negotiation IDs, allow only one exchange, queue changes, and maintain correct ICE/description ordering. Test simultaneous changes and timeouts. Automatic ICE restart is outside this increment.
- With a legacy peer, retain local quality/camera controls and usable audio, but identify unsupported remote limits. Never claim a legacy peer stopped sending video without confirmation or actual supporting evidence.

## Implementation steps

Deliver these increments on the feature branch with tests and evidence at each gate. Proposed new modules/test files are not available yet.

- [ ] **1. Establish capabilities and baseline.** Inspect the installed native/browser APIs; capture sanitized baseline stats on the actual devices. Add shared policy/stat normalization modules under `src/call/` with separate platform adapters. Record codec/capture limitations and confirm whether existing development binaries suffice. Gate: unsupported APIs fall back safely, and actual output is distinguishable from requested settings.
- [ ] **2. Extend signaling compatibly.** Update `shared/protocol.ts` and server state/validation for capability negotiation, policy requests/acks, and serialized renegotiation. Gate: existing clients still connect; invalid, stale, cross-room, duplicate, and excessive updates are handled; simultaneous changes do not cause offer glare.
- [ ] **3. Add presets and directional limits.** Integrate policy into `src/call/session.ts` and `web/call.ts`; add controls and measured status in `App.tsx` and browser UI. Gate: changing quality before/during calls constrains the correct direction, preserves audio/timer, and respects remote/device caps. Keep Ultra gated until step 6.
- [ ] **4. Implement audio-only and consent.** Add confirmed two-way video suppression, camera release, permission-aware restoration, and initial-audio-only-to-video negotiation. Gate: both clients report the applied mode; video RTP stops; no remote action overrides local camera intent.
- [ ] **5. Implement audio-first adaptation.** Add deterministic controller state, conservative budgets, pause/recovery, and visible reasons. Gate: controlled degradation reduces video promptly, stable recovery avoids oscillation, and manual restrictions remain authoritative.
- [ ] **6. Validate relay capacity and high ceilings.** Measure direct/relay traffic, device encoding/decoding, CPU, thermal behavior, and aggregate allocation accounting. Prepare bounded project-only TURN changes and enable Ultra only for verified routes/capabilities. Gate: no relay quota silently drops high-quality media; document tested limits and unsupported combinations.
- [ ] **7. Verify, roll out, and hand off.** Run the matrix below, record native/browser results, deploy in compatibility order, and update state/tools/testing/decision records. Keep any untested hardware ceiling labeled experimental. Do not mark the original M1 device matrix complete without its own evidence.

## Data and configuration

No database, migrations, patient identifiers, new provider credentials, or recordings. Keep live policy in call memory initially. Store bounded defaults in versioned shared configuration; use a feature flag for experimental Ultra. Document any implemented flags/commands in [tools](../TOOLS.md) and the [runbook](../SETUP.md).

The current 8 Mbps TURN allocation ceiling cannot accommodate 30 Mbps video plus audio/overhead. A candidate experimental `max-bps=5000000` means 40 Mbps per allocation; it is a proposal, not a change applied by this plan. Verify sufficient retransmission/overhead headroom and confirm coturn's actual accounting before choosing it.

Size aggregate `bps-capacity` separately from verified EC2 throughput and desired test concurrency. Account for both participants, alternative UDP/TCP/TLS allocations during ICE gathering, and overlap during transitions. Do not assume unused allocations are free of quota accounting. Retain bounded per-user/total quotas, authentication, existing relay port restrictions, and project isolation. If safe capacity is insufficient, cap relay video lower and show that limit; a dedicated relay can be a later decision. Do not advertise the aggregate configuration limit as measured server capacity.

Measure relay bandwidth/cost during opt-in high-quality tests. Direct peer-to-peer media bypasses TURN bandwidth limits but remains constrained by endpoints and networks. Do not provision another server, change shared-host networking, or schedule a paid native rebuild merely to complete this plan. Assess existing binaries first; record any actual new external dependency before requesting owner action.

## Acceptance and verification

Existing commands: `npm run typecheck`, `npm test`, `npm run test:browser`, and `python3 scripts/check_project.py`. Add meaningful cases to the existing suites; new impairment tooling is proposed and must be documented after it works. Run public media checks only when the deployed version matches the intended test. Native dependency/configuration changes additionally require applicable Expo/build checks.

| Requirement / scenario | Procedure | Expected | Actual / evidence |
| --- | --- | --- | --- |
| COM-07: policy and stats correctness | Unit tests for cap intersections, asymmetric directions, unknown support, counter resets, stale samples, and controller timing | Deterministic decisions; no limit or consent overridden | Not implemented |
| Protocol safety and compatibility | Server tests with current/legacy peers, malformed controls, stale revisions, simultaneous policy changes, and repeated negotiation | Authorization/limits preserved; no glare; accurate acknowledgments/fallback | Not implemented |
| COM-07: all presets, including high ceilings | Browser media tests plus real camera/device runs; change settings before/during calls | Applied dimensions/fps remain within supported ceilings; actual RTP reported; audio/timer continue | Not implemented |
| COM-07: constrained receiver | Set a lower incoming limit on only one participant | Other participant lowers its sending stream; unrelated direction remains within its own policy | Not implemented |
| COM-08: congestion and recovery | Controlled bandwidth/loss steps with actual RTP; compare adaptation to fixed-high baseline | Video reduces/pauses; audio impairment improves where avoidable; recovery follows hysteresis | Not implemented |
| COM-09: two-way audio-only | Both initiation orders, simultaneous requests, video return, and initial audio-only to video | No video RTP after drain; audio packets continue; both requests must clear; camera intent respected | Not implemented |
| Unsupported APIs / failures | Reject constraints/parameters, omit stats, fail renegotiation, use legacy peer | Honest supported fallback; otherwise usable audio survives | Not implemented |
| Direct and forced relay | Inspect selected candidate pair and measured media under each route | Effective route limits respected; relay quotas do not silently disrupt audio | Not implemented |
| Real hardware / cleanup | iPhone–Android and native–browser; Safari/iPad where available; camera switch and 10–15 minute high-quality run | Record actual supported output, heat/battery observations, cleanup, and any limitations | Not run |

For impairment tests, use an isolated network namespace/veth setup or dedicated test host that shapes the actual WebRTC transport. Never attach `tc`/netem to this shared EC2 host's primary interface. HTTP/DevTools throttling alone does not prove UDP media was constrained. Establish the shaping tool and verify the imposed rates before trusting results.

Suggested profiles: at least 40 Mbps each direction for high-ceiling experiments; asymmetric 1 Mbps upload / 10 Mbps download; approximately 0.5 Mbps constrained; approximately 0.15 Mbps for audio-focused testing; and a strong-to-weak-to-recovered transition with 2–5% loss and 100–300 ms RTT. More severe impairment should demonstrate graceful video suppression and an honest poor-connection state, not a guaranteed successful conversation. Test both direct and relay paths.

Use active synthetic audio and moving video so silence suppression/static images do not mask failures. Observe video RTP separately from RTCP/keepalives. Measure steady-state rates over meaningful windows with documented tolerances for transients and transport overhead; sender payload ceilings are not exact total wire-rate caps. Verify audio playback and delay as well as packet counters. Fake 640x480 cameras do not establish physical 4K/60 support.

Record device models/OS, native build/runtime, codec, selected route, requested/applied/measured quality, network profile, transition timing, and sanitized outcomes using the [device report template](../testing/DEVICE_REPORT_TEMPLATE.md). Follow [evidence handling](../TESTING.md); no raw SDP, credentials, conversation recordings, or private device data in Git.

## Risks and recovery

4K/60 may be unavailable or unsuitable on particular cameras/codecs; sustained high settings can increase heat, battery use, and data cost. Capture switching, encoding-envelope limits, and native parameter behavior require physical evidence. Audio priority cannot overcome disconnection or insufficient capacity. Manual audio-only remains available throughout.

Roll out the backward-compatible server first, then clients and nonexperimental controls, then enable higher ceilings after capacity/device gates pass. Build browser assets before restarting signaling; a restart ends current rooms, so account for active development calls and use fresh invitations. TURN changes affect active relayed calls and need a deliberate test window.

Retain the previous assets/configuration and keep server support for both client generations during rollback. Disable the experimental ceiling/controller first when isolating a fault; preserve a usable manual low-quality/audio path. Reverting the server to a version that rejects already-deployed client messages is not a safe first rollback step. Record effective configuration and recovery in the runbook when implementation occurs.

## Handoff

Planning is complete; every implementation/acceptance checkbox remains open. First-round code is saved on `feat/webrtc-poc` in [PR 1](https://github.com/cnm4us/phoneapp/pull/1). Next implementation action: step 1, API/capability verification and shared policy/stat foundations. Existing native development builds may suffice for JavaScript-only controls; no new build or deployment was performed for this plan. Original M1 physical acceptance can proceed independently when both phones are available.

## Technical references

- [W3C WebRTC](https://www.w3.org/TR/webrtc/): sender parameters, capture/negotiation behavior, and API limits.
- [W3C WebRTC statistics](https://www.w3.org/TR/webrtc-stats/): definitions and units for the proposed measurements.
- [W3C WebRTC priority extension](https://www.w3.org/TR/webrtc-priority/): optional priority controls; inspect actual platform support.
- [RFC 8836](https://www.rfc-editor.org/rfc/rfc8836.html): congestion-control requirements for interactive real-time media.
- [coturn configuration reference](https://github.com/coturn/coturn/blob/master/examples/etc/turnserver.conf): byte-per-second relay limits and allocation controls; verify behavior against the installed version.
- [react-native-webrtc source](https://github.com/react-native-webrtc/react-native-webrtc): inspect the installed 155.0.1 source as the runtime-specific API reference rather than assuming current upstream behavior.
