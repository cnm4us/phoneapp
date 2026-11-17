# Adaptive call quality verification

Date: 2026-11-17 UTC. Scope: [plan 0003](../plans/0003-adaptive-call-quality.md), COM-07–09. Synthetic media only; no recording, patient data, database, or new EAS build.

## Delivered behavior

Native and browser clients share quality ceilings, interval statistics, and an audio-first controller. Auto starts around 720p/24 with a 1080p/30 ceiling. High offers a 1080p/60 ceiling; lower presets reach 240p/15. Advanced controls independently limit send/receive dimensions, frame rate, and video payload bitrate. Actual output and audio feedback are reported separately from selected limits. Full screen changes layout independently of resolution.

Either participant can require two-way audio-only. Video senders detach their tracks, manual mode releases capture, and the peer acknowledges applied policy. Returning from manual audio-only leaves cameras off until locally enabled. Both camera-less joins and simultaneous camera activation work in browser media tests. Renegotiation failures preserve the existing audio connection and show a limitation.

The 4K/60, 30 Mbps ceiling is implemented as experimental policy and remains **disabled** in this deployment. It requires server opt-in plus verified capture capability; the installed native track API cannot enumerate capabilities, so native 4K remains gated pending physical investigation. Do not enable the flag merely to expose the option. Live TURN configuration is unchanged; effective relayed video stays at or below 6 Mbps, leaving room below its 8 Mbps allocation quota. No EC2 WAN throughput/concurrency benchmark is claimed.

## Automated evidence

| Check | Result | Scope |
| --- | --- | --- |
| `npm run typecheck` | Pass | Native, server, browser, tests, and impairment harness compile. |
| `npm test` | 31/31 pass | Existing auth/security/core behavior; policy bounds, revisions, capabilities, serialized negotiation, stats resets/deltas, guard timing, consent, and native API fallback cases. |
| `npm run test:browser` | 12/12 pass | Actual synthetic RTP, independent incoming limits, camera restoration/simultaneous activation, two-way audio-only on ordinary/forced TURN paths, negotiation-failure survival, cleanup, and permission/autoplay recovery. |
| `npm run test:browser:live` | 12/12 pass after deployment | Same scenarios through public HTTPS/WSS and configured TURN; includes responsive widths and full-screen layout. |
| `npm run bundle:check` | iOS/Android exports pass; final command exit 0 | Native JavaScript compilation using existing pinned modules; not native compilation or physical-device acceptance. |
| `npm run test:quality-network` | Pass | Real UDP impairment, observed video suppression/recovery, audio counter continuity, and isolated shaping cleanup. |

## Controlled network procedure and observations

The Linux harness creates a disposable network namespace, veth pair, and isolated authenticated coturn/signaling instances. Chromium runs inside the namespace and both clients force TURN. Only the veth pair receives netem rules; no primary-interface shaping, NAT, public firewall, live TURN restart, or unrelated-project changes. A private Unix-socket bridge keeps automation outside the shaped link. Temporary processes/interfaces/configuration are removed afterward. Synthetic room/TURN credentials never enter reports.

Sequence: 40 Mbps / 10 ms per traversal for 25 seconds; 500 kbps / 60 ms / 2% loss for 25 seconds; 150 kbps / 100 ms / 5% loss for 20 seconds; restored 40 Mbps / 10 ms / no imposed loss for 45 seconds. Both clients share the shaped link; rates are not independent per-person allowances, and traversal delay is not measured end-to-end latency.

Latest observed healthy video reached 1280x720 near the synthetic source's 20 fps. Constraining the link caused initial audio loss/concealment and video pause within roughly five seconds. After drain, video counters stopped while audio counters continued. Recovery resumed approximately 160p video around 25 seconds, then 360p at 40 seconds and 480p at 45 seconds. The final qdisc report recorded 191 dropped packets. Detailed output stays in ignored `artifacts/private/quality-network.json`.

This establishes packet continuity and controller behavior, not perceptual speech quality or guaranteed low latency. The extreme profile still impaired audio. A receive jitter buffer remained elevated after loss stopped, gradually decreasing during recovery. Listening, end-to-end delay, and device/network tuning remain necessary.

## Corrections established by tests

- Startup estimates around 300 kbps are insufficient evidence to pause healthy video: that creates a probing deadlock. Apply estimate-based budgets when audio needs help and retain WebRTC probing below bounded ceilings otherwise.
- A paused stream can probe at the minimum rung after sustained clean audio even if a capacity estimate is absent. Brief RTCP gaps do not erase recovery progress; genuinely stale feedback cannot establish recovery.
- Elevated jitter-buffer delay requires loss/concealment corroboration; stable route latency alone must not permanently latch video off.
- A camera-less answerer adopts the offered video transceiver instead of precreating an unmatched sender. This fixes simultaneous camera activation after both join without cameras.
- Native `replaceTrack()` can silently catch errors. Check its resulting track and report unconfirmed suppression on failure. Optional native parameter omission uses its null sentinel; failed mandatory controls stop video instead of silently sending uncapped.
- The impairment harness retries Chromium's transient namespace startup `ERR_NETWORK_CHANGED` and waits for initialized UI before joining. It creates invitations through the test server; creator UI is independently tested by the browser suite.

## Deployment and remaining acceptance

Deployed the compatible signaling server and rebuilt browser assets to the existing project service/hostname. Recent logs showed no joined rooms before restart. Public health and all 12 public browser tests passed. TURN service, security groups, native dependencies, and native build artifacts were unchanged. Metro was already running for development-client reloads.

Still open: actual iPhone/Android and native–Safari/iPad transitions; real speech and end-to-end delay under impairment; sustained heat/battery behavior; hardware/codec-specific 1080p/60 and 4K support; stronger relay throughput/concurrency/cost evidence before raising quotas. The original [M1 matrix](../plans/0001-webrtc-poc.md) remains open. Plan 0003 is not fully accepted until applicable gates have evidence.
