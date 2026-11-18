# Browser sign-in persistence — evidence

Date: 2026-11-18. [Plan 0013](../plans/0013-persistent-browser-sign-in.md), [ADR 0009](../decisions/0009-browser-sessions.md). Synthetic identities only.

| Check | Outcome | Scope |
| --- | --- | --- |
| TypeScript | Pass | Shared/native/browser/backend and scripts |
| HTTPS browser session suite | 4 scenarios / 5 Node tests pass | Secure/HttpOnly/Strict host cookie, JS invisibility, reload/new-tab/profile reopen, logout/server revocation, fixed expiry, malicious Origin/missing guard/wrong-account rejection, open legacy-tab adoption |
| Client cases | 7 pass | Five native restore/mute/race regressions plus browser cookie transport/offline logout/stale 401 |
| Existing accounts | 6 scenarios / 7 Node tests pass | Real Chromium WebRTC, authorization and durable history |
| Existing audio messages | 8 scenarios / 9 Node tests pass | Actual Chromium recording/playback and upload/revocation/storage/history contracts with cookie-auth browser UI |
| Existing native auth | 7 scenarios / 8 Node tests pass | Bearer/device/refresh/outbox compatibility |
| Existing unit cases | 58 pass | Calling/quality/routing/alert regression |
| Browser calls | 13 local and 13 public pass | Deployed HTTPS/WSS media including TURN |
| Public session smoke | Pass | Isolated Chromium Provider login, flags, reload/new tab, legacy-tab adoption and logout over actual HTTPS; no phone calls/messages |

Deployment: confirmed no active account calls and no signaling connections, fast-forwarded canonical source, rebuilt browser assets and restarted only the project signaling service. Public health is good. No DB migration, runtime grant, provider credential, nginx or native build change. The current tab can adopt its existing valid bearer session on a browser same-origin poll before reloading. Saved browser sign-in lasts a fixed 30 days and is shared by tabs in that browser profile; native sign-in/installed binaries retain their existing behavior.

The public smoke owns/revokes only its synthetic browser sessions, prints no cookies/codes and sends no calls/messages/notifications. Private logs are retained in ignored `artifacts/private/browser-sessions/`. An aggregate query after smoke cleanup showed one active remembered browser session; that is not proof of the owner's personal reload/UI result. Owner was instructed to foreground the current tab briefly before refreshing; direct owner confirmation remains pending.

Reload restores identity, not camera/microphone capture, an ongoing call or an unsent draft. Offline logout failure is reported while still visibly signed in. Cookie deletion alone removes the local credential; explicit online Sign out also revokes its server row. Existing physical audio-message and native lifecycle gates remain in their own reports.
