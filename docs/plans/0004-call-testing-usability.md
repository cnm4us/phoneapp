# 0004 Call testing usability and full-screen repair

Status: implemented/deployed; physical full-screen and sustained-call confirmation pending. Updated: 2026-11-17. Requirements: POC-01, COM-01, COM-07; follows [plan 0003](0003-adaptive-call-quality.md).

## Outcome and evidence

Owner reports native iPhone full screen turns black, requests simpler test invitations and longer calls. A server event matches a 411-second connected call ending when a participant connection closed, at room age 500 seconds versus its configured 1800-second expiry. Both call screens reportedly stayed visible; expiration was not the cause of that disconnect. Existing logs cannot distinguish transport closure from a client leave.

Native full screen currently creates a second remote RTCView inside a Modal while retaining the inline renderer. Replace that transition with one stable renderer whose existing container expands. Verify on the physical phone after JavaScript checks; do not claim the black-screen cause conclusively established by inspection.

## Implementation steps

- [x] Keep a single mounted native remote video renderer in one parent hierarchy for compact/full-screen layouts. Keep exit/mute/hangup reachable, support Android back, and reset presentation when a call ends. No camera/SDP/signaling changes on layout toggle.
- [x] Return an eight-digit test room code alongside the existing invitation. Resolve codes through a bounded POST endpoint, keeping them out of URL logs. Keep creator-key authentication, expiring two-peer rooms, old long-code compatibility, and bounded failed lookups. Do not introduce a public room directory or permanent test credential.
- [x] Default new rooms to four hours; bound configurable room TTL to eight hours. Keep TURN credentials aligned with room expiry. Show remaining room lifetime separately from connected time. Extend heartbeat tolerance to two missed responses and log bounded server-side close causes/codes without payloads.
- [x] Test short/legacy code parsing, resolution bounds/auth/expiry/cleanup, long-call expiry with a fake clock, and actual browser media using short codes. Run TypeScript, native JS exports, and documentation checks. Physical full-screen/repeat transitions and sustained native calls remain owner-operated.
- [x] Deploy compatible server/browser updates after checks; preserve live TURN/network settings. Update state/work log/tools and commit/push. No paid build, DB, or dependency change expected.

## Acceptance and recovery

| Scenario | Expected | Actual |
| --- | --- | --- |
| Phone full-screen toggle | Same video renderer/stream, usable exit, audio/session preserved | Pending physical confirmation |
| Short invitation | Same eight-digit code on both clients joins the private two-person room | Public short-code browser media tests pass |
| Legacy invitation | Existing long codes and old clients still work | Existing protocol/parser/server compatibility tests pass |
| Invalid/guessed codes | Bounded body/attempts, generic rejection, expired/closed rooms inaccessible | HTTP/security tests pass |
| Longer room | Four-hour default expiry and TURN credential lifetime; exact boundary validated without waiting hours | Fake-clock boundary and deployed room-lifetime tests pass |
| Unexpected disconnect | Logs distinguish explicit leave, rejection, heartbeat timeout, and connection closure | Unit tests pass; original 6:50 cause remains unconfirmed |

Restore the prior UI if renderer resizing fails; keep server support for legacy invitations. Short-code resolution is a testing convenience, not production patient authentication. No database/migration; codes and rooms remain in memory and are invalidated by restart. Full physical M1/quality gates remain open.

## Handoff

TypeScript, 38 unit/server tests, 13 public browser scenarios, both native JS exports, and nginx validation pass. See [evidence](../testing/2026-11-17-call-usability.md). The owner was asked to reload both clients, create a new short-code room, and check phone full-screen entry/exit without ending the call. That physical confirmation and sustained native call stability remain open. No new EAS build, DB, or TURN quota change.
