# Browser companion verification

Date: 2026-11-16 (client date). Plan: [0002](../plans/0002-browser-companion.md), supporting [M1](../plans/0001-webrtc-poc.md). Live page: <https://phoneapp.bawebtech.com>.

## Implemented and deployed

Browser creation/joining/sharing works with the existing native protocol. Calls support audio/video, mute/camera toggles, hangup, connected-time display, playback recovery, forced relay, and redacted connection statistics. The page is served through an explicit three-file allowlist with CSP, no-store, no-referrer, and camera/microphone policy headers. Neither the browser key nor invitations are saved in application browser storage; shared link fragments are removed after loading.

The companion is hosted on the existing EC2/nginx service, by the established project destination. No separate hosted Site, EAS build, database, or new credential was created for this change.

## Automated evidence

| Check | Result | Scope |
| --- | --- | --- |
| TypeScript | Pass | Native/server/browser/browser-test source checked. |
| Node tests | 16/16 pass | Existing protocol/core cases plus exact static routes, response types/headers, HEAD, and denial of private/source file requests. |
| Chromium media tests | 7/7 pass on public HTTPS deployment | Actual synthetic camera/microphone streams, SDP/ICE, RTP reception, remote video dimensions/playback, and inbound byte growth. |
| Video / repeat call / controls | Pass | Both peers receive video; mute/camera change actual track flags; captured tracks end on hangup; peer leaves; another call succeeds. |
| Forced TURN | Pass | Both selected candidate pairs report relay candidates and media reception increases over the public deployed path. |
| Audio-only initiator | Pass | Receives the other peer's video, sends no video track, camera control disabled. |
| Invalid key / room | Pass | Useful errors; capture released and join available again. |
| Playback policy recovery | Pass | Injected autoplay rejection exposes button; clicking resumes actual remote video. This is not a Safari hardware test. |
| Permission denial / link handling | Pass | Recovery message and usable form; invitation fragment cleared from address. |
| Layout | Pass | No horizontal overflow at 1440, 768, and 390 pixel widths; desktop/mobile screenshots reviewed. Chromium viewport changes do not emulate Safari's media engine. |
| Public HTTP and UI | Pass | HTTPS 200, correct types/headers, page opened in browser and DOM/secure context inspected. |

Playwright 1.65.1 uses Chromium 159 with fake media-device flags. Test names/results are visible through `npm run test:browser:live`. Private screenshots and test output are ignored; no public screenshot contains a room invitation or test key. Browser build uses esbuild 0.28.2 and does not bundle server credentials.

## Manual acceptance remaining

The owner reports the native iPhone app is installed and its screen is visible; EAS iOS build `0e5beca1-cdcd-4d69-9c85-90f26667e21d` is finished. A real browser-to-iPhone call has not yet been observed. Safari on the iPad and real microphones/cameras need owner validation. The original iPhone/Android, cross-network, permission, teardown, and timing matrix remains open. No HIPAA, recording, billing, or production-readiness result is implied.
