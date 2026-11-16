# 0001 Two-device WebRTC proof of concept

Status: ready for implementation; not started. Updated: 2026-11-16. Milestone: M1. Requirements: POC-01 through POC-07 in [the PRD](../PRD.md).

## Outcome and boundaries

Install native development builds of one Expo/React Native app on the owner's iPhone and his wife's Android. Join the same temporary room and demonstrate two-way foreground audio/video, audio-only mode, controls, and teardown across networks.

Use synthetic labels/conversations. No patient database, Twilio phone number, SMS, recording/transcription, HIPAA implementation, billing rules, or production deployment in this plan. Background incoming calls belong to M3. A minimal expiring room invitation is still needed to avoid an unrestricted public signaling service.

## Starting evidence

- Repository has documentation and a documentation checker only; no runtime code exists.
- Node/npm/Python/Git are present. EAS session/project setup is unverified.
- Both physical devices exist but have no recorded models/OS or project build installed.
- No secure signaling endpoint, TURN credentials, or DB exists.
- Expo development builds and compatible `react-native-webrtc` config plugin are the proposed approach. Verify current upstream versions before installing.

## Implementation steps

- [ ] Create a feature branch and verify current upstream Expo/React Native/WebRTC/plugin compatibility. Record exact versions and runtime requirements.
- [ ] Scaffold a TypeScript Expo app with `expo-dev-client`, native microphone/camera permission descriptions, compatible WebRTC dependencies/plugin, and a committed lockfile. Choose a simple repository layout and document it.
- [ ] Configure EAS development profiles for installable iPhone and Android device builds. Document public configuration, app identifiers, account linking, signing/device registration, and missing owner actions. Do not place signing credentials in Git.
- [ ] Implement a minimal Node/TypeScript signaling service: health endpoint, expiring room invitations, two-peer limit, validated messages, offer/answer/ICE relay, bounded state, disconnect/expiry cleanup, and useful redacted logs. No persistent DB.
- [ ] Add automated session/protocol tests for joining, third-peer rejection, expired/invalid invitations, malformed/oversized messages, offer/answer/ICE routing, departure, and repeated sessions. Verify sender/room authorization rather than trusting client-provided peer IDs.
- [ ] Implement room join, local preview, remote view, audio-only option, microphone/camera controls, camera switch, hangup, clear connection/error states, and experimental connected-duration display. Queue remote ICE until the remote description is ready; clean up tracks/listeners/peer objects on every exit path.
- [ ] Configure a secure public signaling route and authenticated TURN. Record actual endpoints/ports/health/start-stop procedures in TOOLS.md; inspect project-specific network changes before applying. Keep provider master credentials server-side and document how clients obtain scoped access.
- [ ] Add concise connection diagnostics and a development-only forced-relay option. Capture selected candidate type/stats without sharing credentials or raw SDP.
- [ ] Run type/dependency/lint and signaling checks. Add browser harness tests only if useful for isolating media/signaling failures; do not substitute them for native tests.
- [ ] Create EAS builds and record build IDs/results. Owners install on the two phones; use Expo's development tunnel if needed for remote Metro access.
- [ ] Execute the physical-device matrix, record sanitized evidence, resolve failures, and repeat affected scenarios.
- [ ] Update active plan, state, work log, architecture decisions, tools, and device report. Mark M1 complete only when physical acceptance passes.

## External dependencies

EAS project/account linking and iPhone registration may require owner interaction. TURN/provider choice may need credentials or spending authorization. Device operation requires the owners. Continue independent scaffolding and tests while preparing exact setup steps; do not block code work on avoidable questions.

## Verification matrix

The thresholds below are experiment acceptance targets, not guarantees for every network or a production SLA.

| Scenario | Expected outcome | Actual / evidence |
| --- | --- | --- |
| iPhone/Android install and launch | Both custom builds launch and load the project | Not run |
| Same Wi-Fi audio-only, each side initiating | Two-way intelligible audio for at least 2 minutes | Not run |
| Same Wi-Fi video | Two-way audio/video for at least 2 minutes; mute/camera toggle/switch work | Not run |
| iPhone Wi-Fi / Android cellular | Audio/video connects within 30 seconds after both join and remains usable for 2 minutes | Not run |
| iPhone cellular / Android Wi-Fi | Same cross-network behavior | Not run |
| Forced relay | Two-way media; selected candidate pair confirms TURN relay rather than direct path | Not run |
| Hangup from either end | Both leave active-call state; capture resources stop; no stale timer | Not run |
| Repeat session | Three successive calls complete without restarting either app | Not run |
| Invalid/expired invite and third peer | Clear rejection; existing session remains intact | Not run |
| Camera/microphone denied | Clear explanation and settings/retry path; no indefinite joining state | Not run |
| Peer exits or network disappears | Clear disconnected/error state; bounded cleanup; a fresh session works after restoration | Not run |
| Timing | Only connected segments count; displayed elapsed duration agrees within 2 seconds with a manually observed 60-second interval | Not run |

## Data and configuration

Database migrations: none. Room state is temporary and expires. Add component-specific `.env.example` files when configuration names are chosen, documenting app-public signaling configuration and backend-only credentials separately. An Expo/Metro tunnel is not a TURN server or a signaling endpoint.

## Recovery and operational limits

Stop project-specific processes, close sessions, and revoke/expire test credentials if the test service misbehaves. Preserve useful sanitized diagnostics before restarting. Do not modify unrelated host services. Native dependency changes require a new development build. The POC is foreground-only; service restarts may terminate temporary sessions.

## Handoff

Next action: select/pin compatible versions and scaffold app plus signaling service. No app code, EAS builds, or media tests have been performed. Record device evidence using [the report template](../testing/DEVICE_REPORT_TEMPLATE.md).
