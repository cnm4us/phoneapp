# 0003 Adaptive call quality and audio-first controls

Status: proposed follow-up; implementation not started. Updated: 2026-11-16 (client date). Requirements: COM-07, COM-08, COM-09 in [the PRD](../PRD.md).

## Outcome and scope

Let users with capable networks/devices use higher video ceilings while allowing constrained users to choose smaller streams. Keep automatic adaptation active below user ceilings, prioritize conversation audio, and provide an explicit two-way audio-only action. Apply behavior to native and browser clients. This checkpoint records the agreed direction; it does not change live media behavior.

## Current evidence

First-round native and browser calling is implemented and deployed. The owner reports it works well; exact physical devices, network path, and quality metrics were not captured. Current capture requests approximately 640x480; the native app requests 24 fps. Quality presets, coordinated receive limits, an application audio-first policy, and coordinated audio-only mode do not exist yet. Current camera-off controls are local controls.

## Implementation steps

- [ ] Inspect current platform support for camera constraints, sender bitrate/scaling/frame-rate controls, and priority APIs; do not assume native wrappers expose every browser property.
- [ ] Choose bounded presets such as Auto, High quality, and Data saver. Document requested capture settings versus actual encoded/sent resolution; do not promise a particular resolution/frame rate on unsupported hardware.
- [ ] Add validated peer-control messages for incoming-quality requests and audio-only/video requests. Define conflicts, acknowledgments, stale messages, and compatibility behavior while preserving room authorization and limits.
- [ ] Implement both clients' controls and report actual bitrate, resolution, frame rate, packet loss, and connection state where measurable.
- [ ] Add an audio-first controller with measured triggers, conservative video budgets, video pause, and stable recovery. Prefer lowering pixel count to preserve motion when practical; protect low-latency audio over video quality. Do not rely solely on network packet-priority markings.
- [ ] Implement explicit audio-only mode and consent-aware video restoration. A peer request must never activate a camera without local user permission.
- [ ] Test preset changes during calls, both-direction constraints, supported/fallback APIs, controlled bandwidth/loss, audio-only transitions, recovery stability, and cleanup.
- [ ] Run native and browser acceptance, deploy verified changes, and update state/tools/evidence.

## Data and configuration

No patient database or migrations expected. Reuse current room/authentication/TURN infrastructure. New protocol messages require server validation and synchronized client behavior. Determine whether existing native builds expose the needed capabilities before scheduling any new EAS build; honor existing task-specific spending authorization.

## Acceptance and verification

| Scenario | Expected | Actual |
| --- | --- | --- |
| Quality changes | Requested ceilings apply during a call; measured values reported honestly | Not implemented |
| Constrained receiver | Remote sender respects a lower request without enabling local video | Not implemented |
| Congestion | Video reduces/pauses before sustained avoidable audio degradation; no absolute audio guarantee | Not implemented |
| Audio-only | Video is suppressed in both directions; audio/session continues | Not implemented |
| Restore video | Local camera consent retained; recovery avoids rapid oscillation | Not implemented |
| Unsupported controls | Clear fallback without crashing or dropping an otherwise usable audio call | Not implemented |

## Risks and recovery

Network capacity, Wi-Fi loss, device load, and API support vary. Avoid long audio buffering and abrupt repeated quality changes. Keep manual audio-only available when adaptation is insufficient. Test protocol compatibility and use a coordinated service/client rollout; retain a known-good implementation for rollback.

## Handoff

First-round code is saved on `feat/webrtc-poc` in [PR 1](https://github.com/cnm4us/phoneapp/pull/1). Continue the original M1 physical matrix and use this plan when beginning quality-control implementation. No changes in this plan are represented as already shipped.
