# Adaptive call quality verification

Date: 2026-11-17 UTC. Scope: [plan 0003](../plans/0003-adaptive-call-quality.md), COM-07–09. Synthetic media only; no recording, patient data, database, or new EAS build.

## Delivered behavior

Native and browser clients share quality ceilings, interval statistics, and an audio-first controller. Auto starts around 720p/24 with a 1080p/30 ceiling. High now offers a 1080p/30 ceiling (originally 60 fps; changed at the owner's request); lower presets reach 240p/15. Advanced controls independently limit send/receive dimensions, frame rate, and video payload bitrate. Actual output and audio feedback are reported separately from selected limits. Full screen changes layout independently of resolution.

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

## Desktop frame-rate investigation

Owner reports the desktop picture from the iPhone becomes softer/choppy when Actual received falls to 0–5 or around 16 fps; high rates appear sharp/smooth. Phone's received desktop picture is usually better. Reported speed test remains about 700 Mbps down / 80 Mbps up. A reported 30 fps sent reading has not been attributed to a specific endpoint, so it is not proof of 30 fps iPhone output. Actual dimensions/Mbps, hardware/browser versions, codec, route, and loss/processing evidence remain unknown. Correlation narrows the affected direction but does not establish network, encoder, decoder, or renderer causation.

Added browser-only diagnostics under Connection details: complete received frames/s versus decoded frames/s, dropped frames/s, interval video packet loss, codec, average encode/decode milliseconds per frame, optional freeze/jitter/capture/encoder limitation fields in copied JSON. Calculations use timestamped counter deltas, not lifetime averages. The reader excludes repair streams and prefers active traffic over retained inactive SSRCs. Unknown/stale/reset counters are not shown as healthy zeroes. A local snapshot contains at most 30 measurements and no raw IDs, addresses, SDP, room credentials, or device labels. No telemetry upload or recording.

TypeScript passes; `npm test` passes 43 cases, including interval units, missing/stale/reset data, active-versus-retained SSRCs/repair data, and allowlisted output. All 13 local browser scenarios pass, including actual synthetic media plus rendered receive/decode diagnostics and a copyable snapshot without credentials. Native/shared media modules, policies, bitrate ceilings, TURN configuration, DB, and native builds are unchanged; native bundle exports were not repeated for browser-only changes.

Owner left the call; sanitized signaling history showed zero joined rooms before restarting only phoneapp signaling to publish rebuilt assets. All 13 public browser scenarios pass after deployment, including the new diagnostic UI/copy check and forced TURN. Next: refresh the desktop browser, create a new room (restart clears in-memory rooms), reproduce the choppy interval, and copy video diagnostics plus the phone's paired Actual sent line. These measurements guide a subsequent correction; no physical performance fix is claimed by this instrumentation increment.

Subsequent owner report: **phone Actual sent itself sometimes falls below 5 fps**. Source inspection confirms this UI uses outbound encoded-frame statistics (`framesPerSecond`, or interval `framesEncoded` if absent). This supports a slowdown in the outgoing pipeline; desktop decoding alone cannot explain low encoded-frame production on the phone. Capture/encoder/device load, control behavior, congestion feedback, and report selection are not distinguished by this observation. No paired snapshot, exact timing, or frame-rate trace has been supplied. Proposed comparison: first capture browser diagnostics and phone Actual sent during a dip; then change only phone outgoing resolution to 720p, retaining 30 fps and other limits, and observe whether dips persist for 1–2 minutes. This comparison is not yet performed. No runtime change, restart, new build, or physical pass is claimed.

New phone-specific network report: owner measures **6–10 Mbps in both directions over iPhone Wi-Fi**, versus the previously reported 700/80 Mbps test. Concurrent versus idle-call testing is unknown and has been queried; do not label this result idle Wi-Fi capacity. Limited/variable phone-side throughput is now a stronger candidate. Source confirms High permits 8 Mbps video (6 Mbps on relay), while HD permits 3 Mbps, excluding audio/transport overhead. A 30 fps override does not lower the configured bitrate cap. Revise the proposed test to idle phone speed measurement and access-point proximity comparison, then HD preset on both devices to bound both streams at 720p/30/3 Mbps. Unlike resolution-only adjustment, this reduces video bitrate ceilings too. No comparison result, packet/decode snapshot, or confirmed cause yet; runtime configuration unchanged.

Owner subsequently identifies weak Wi-Fi in the upstairs office and strong reception downstairs near the router. Disabling phone Wi-Fi yields a cellular speed test around **500 Mbps download / 30 Mbps upload**. Owner reports video and FPS in **both directions are sharper, smoother, and more stable on cellular**. This is useful owner-operated physical evidence implicating the Wi-Fi path in the earlier degradation. It is not a measured same-settings transport experiment: exact presets, codec, RTP dimensions/fps/bitrate, direct/relay route, device/OS versions, and duration are still unknown. Keep sustained-call, original M1, and Ultra gates open. No further runtime/deployment changes for this finding; collect diagnostics if dips recur on a strong connection.

## Direct 1080p/30 preset

Owner requested a simple 1080p/30 setting and considers 60 fps unnecessary for ordinary calls. Changed shared High label/ceiling from 1080p/60 to **High · 1080p/30**, setting both send/receive preferences. HD remains 720p/30. Bitrate remains 8 Mbps (6 Mbps relay) for High and 3 Mbps for HD. Separated non-Ultra advanced bounds from High's preset values so existing explicit frame-rate choices/fallback behavior remain supported. Ultra remains gated off.

Prepared in `/tmp/phoneapp-high30` with shared installed dependencies while the live room stayed active. TypeScript and all 43 unit/server/diagnostic cases pass. Updated behavioral adapter coverage confirms High sets both preferences to 1080p/30, the sender applies a 30 fps ceiling after guard warm-up, outgoing overrides preserve incoming preferences, and advanced 60 fps choices are not silently clamped. All 13 local browser scenarios pass, including selecting High by its new label and checking both displayed limits while media continues. iOS/Android JS exports both pass; these are not physical or native compilation tests.

Sanitized logs then showed zero active rooms; applied the reviewed patch to the live checkout, built browser assets, and restarted only phoneapp signaling. All 13 public browser scenarios pass after deployment. No dependency/provider/DB/TURN quota changes or new paid builds. Native acceptance: reload the development app and select High; owner confirmation pending. Preset and actual output remain distinct.
