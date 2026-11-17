# Call testing usability verification

Date: 2026-11-17. Scope: [plan 0004](../plans/0004-call-testing-usability.md). Synthetic test calls only.

## Reports and diagnosis

Owner reports black video in native iPhone full screen; inline iPhone/browser video and restoration after manual audio-only work. The old layout retained the inline remote RTCView and opened a second renderer in a Modal. The repair retains one remote renderer and parent hierarchy, resizes its frame, and hides the settings scroll area. It does not change capture, SDP, camera intent, or the call/session on layout toggle. Device retest was requested; compilation does not prove the black screen is resolved.

The reported call ending around 6:50 matches a server connection closure approximately 411 seconds after both joined, at room age 500 seconds versus configured expiry 1800 seconds. Both call screens reportedly stayed visible. **This was not room expiry.** Old logs cannot identify the transport/client cause. New bounded close cause/code and initiator-role logging excludes arbitrary client reason strings. Two consecutive missed heartbeats are now tolerated instead of terminating on the first missed response. These changes do not prove the original cause or guarantee uninterrupted calls.

## Implemented

- Native `CallVideoStage` keeps one remote renderer and video parent for compact/full-screen layouts. Exit, mute, camera, switch camera, and hangup remain reachable; Android back exits expansion. Existing native modules/Metro are used.
- Random eight-digit room codes display as `1234 5678`. Both clients resolve them with `POST /rooms/resolve` before joining through the existing long capability. Legacy pasted invites/clients still work. Browser links strip fragments on initial load and same-page navigation; no automatic join or active-call replacement.
- Lookup validates an exact schema/256-byte body, uses no-store responses, bounds attempts (120 total/minute, stopping after 30 failed lookups), and rejects closed/expired rooms. Creator authentication and two-peer limits remain. Closed codes are not reused within their original lifetime. No public directory, permanent invitation, DB, or credential storage.
- New rooms default to four hours from creation, configurable using `ROOM_TTL_MINUTES` up to 480. TURN credentials match room expiry. Remaining room lifetime is shown separately from connected time. Departure, network loss, restart, or foreground restrictions can still end calls sooner.

## Verification

| Check | Result | Limits |
| --- | --- | --- |
| `npm run typecheck` | Pass | Native/shared/backend/browser/tests compile. |
| `npm test` | 38/38 pass | Short/legacy parsing, leading zeroes, lookup bounds/expiry/departure, fake-clock four-hour/TURN boundary, close logging, heartbeat grace, existing quality/security cases. |
| `npm run test:browser` | 13/13 pass | Real media now uses short codes; link test checks separators, fragment removal, partial-code rejection, room lifetime, and media. |
| `npm run bundle:check` | iOS/Android export pass; exit 0 | Native JS compilation; no new native binary or physical renderer proof. |
| nginx configuration | Pass | Only this hostname gains exact `/rooms/resolve` proxy route. |
| `npm run test:browser:live` | 13/13 pass | Tests deployed HTTPS resolver/nginx route, four-hour room lifetime, and actual media/quality behavior. |
| Phone full screen / sustained call | Owner retest pending | Four-hour boundaries simulated; no claim of a four-hour physical call. |

## Deployment and remaining work

Built browser assets, added the project-only nginx route, validated/reloaded nginx, and restarted `phoneapp-signaling` after recent logs showed no joined rooms. TURN, firewall, dependencies, DB, and native binaries unchanged. Existing rooms end on restart; refresh both clients and create a new code. No EAS build or paid service.

Keep [M1 physical acceptance](../plans/0001-webrtc-poc.md) and Ultra gates open. Capture models/OS/browser/network and actual full-screen/long-call results. Diagnose another early disconnect using the new close fields and client error, not an assumption of expiry.
