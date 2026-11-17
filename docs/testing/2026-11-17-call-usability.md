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
| Phone full screen / sustained call | Owner confirms Full screen and Fill screen work; sustained-call check open | Four-hour boundaries simulated; no claim of a four-hour physical call. |

## Deployment and remaining work

Built browser assets, added the project-only nginx route, validated/reloaded nginx, and restarted `phoneapp-signaling` after recent logs showed no joined rooms. TURN, firewall, dependencies, DB, and native binaries unchanged. Existing rooms end on restart; refresh both clients and create a new code. No EAS build or paid service.

Keep [M1 physical acceptance](../plans/0001-webrtc-poc.md) and Ultra gates open. Capture models/OS/browser/network and actual full-screen/long-call results. Diagnose another early disconnect using the new close fields and client error, not an assumption of expiry.

## Portrait height and image fit follow-up

Owner confirmed the black-screen problem no longer occurs and described video filling the phone width but only the top third. Inspection found the settings ScrollView retained its built-in explicit `flexGrow: 1` despite the height/flex-zero/opacity hidden style. Yoga gives explicit flexGrow precedence over the flex shorthand. Hiding the settings with `display: none` removes it from layout without moving or remounting the remote renderer.

A one-off C++ check compiled the installed React Native Yoga sources and reproduced the old layout, then applied the new hidden style. With a sample 150-pixel control area, video height changed 230 → 610 for a 390×760 viewport, 45 → 240 for 760×390, and 330 → 810 for 768×960. Hidden settings consumed zero height after the change. These are layout-engine checks, not measurements from the owner's phone. The temporary check lives in ignored `artifacts/private/fullscreen-yoga-check.cpp`.

Added a full-screen Fill screen toggle using cover (crops edges), with Show whole video returning to contain. Inline view retains contain. The video frame clips overflow so cropped content does not cover controls. Display fit changes no capture, bitrate, signaling, or consent. TypeScript and both native JS exports pass; owner subsequently confirmed Full screen and Fill screen both work. No media/backend changes, paid build, or service restart.

For sustained tests, avoid native source edits during the call: React Native [Fast Refresh](https://reactnative.dev/docs/0.86/fast-refresh) reruns effects, and this app's screen cleanup ends its call. Reload before a fresh verification call. This is a development-lifecycle consideration, not an established explanation for the earlier 6:50 disconnect.

## Owner quality comparison

On 2026-11-17 the owner reported:

| Selected ceilings | Observation |
| --- | --- |
| Full screen / Fill screen | Both work on the iPhone. |
| HD 720p/30 on desktop and phone | Works well on both. |
| High 1080p/60 on desktop and phone | Looks good on the phone; desktop large remote video from the iPhone is choppy. Desktop self-camera preview remains smooth. |

These are owner observations, not measured resolution/fps/bitrate. Device models, OS/browser versions, codec, network, route, audio quality at High, and test duration were not supplied. The affected direction is iPhone → desktop; source encoding/upload, network delivery, receiving decode/render workload, and competing browser work remain possible. The self-preview observation alone does not distinguish them.

Requested comparison: keep High selected and lower only the iPhone outgoing frame-rate ceiling to 30 fps while retaining 1080p. Result pending. Obtain phone Actual sent / desktop Actual received measurements to compare the two ends. No code, defaults, service, or build changes were made in response to this report, preserving the active test session. HD is the currently observed smooth selection; sustained-call and original M1/Ultra acceptance remain open.
