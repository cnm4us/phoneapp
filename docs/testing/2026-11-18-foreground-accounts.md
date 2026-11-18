# Foreground account calls — 2026-11-18

Scope: [0009](../plans/0009-authenticated-foreground-calls.md); synthetic accounts, foreground WebRTC, MariaDB persistence. No native build/locked ringing/recording/transcription acceptance.

## Automated evidence

| Command / scenario | Result |
| --- | --- |
| `npm run typecheck` | Native/backend/browser/database and account tooling compile. |
| `npm run test:db` | Eight scenarios (9 Node tests including wrapper) pass; fresh install and v1→v2→v3 retain patients, calls and a transcript version. Checksum/concurrency/dirty-DDL recovery remains covered. |
| `npm run test:accounts` | Six scenarios (7 tests including wrapper) pass on isolated MariaDB: enrollment one-use/expiry/role spoof, assigned-directory and patient isolation, retry/competing answer ownership, distinct private media grants, durations, outcomes/timeouts/revocation/relationship loss, restart history, request-size/rate bounds, and real browser media. |
| Observed time | Two endpoints connect; 5.6 seconds accrued, 4.3-second interruption excluded, then 2.5 seconds accrued. Both histories show 8 aggregate seconds, with duplicate report/end retries ignored. Ringing/answer/restart without media remains 0 seconds. |
| Browser account flow | Independent Chromium contexts enroll Provider/Patient A, provider selects A → App Audio/Video, patient sees incoming prompt and answers; both reach Connected, remote video dimensions and inbound bytes increase; hangup leaves the same ended call ID in both histories with recording/transcript Off. |
| `npm test` | All 50 existing unit/server/routing cases pass after private-room signaling changes. |
| `npm run test:browser` | All 13 existing browser cases pass, including real synthetic media and forced TURN, camera-less join, quality/audio-only, cleanup/errors and responsive layout. |
| `npm run bundle:check` | iOS and Android JavaScript exports pass. No new native dependency/build submitted; not a device/compilation pass. |
| Development migration/grants | Additive 0003 applied after disposable verification; runtime permission case passes, latest schema/current UTC connection, 3 patients/4 users. |

The first account browser run exposed the supplied invitation's expiry metadata being spread into the strict signaling Join message. Fixed both native/browser adapters to explicitly send only room ID/token. Restart recovery initially mislabeled a ringing call Missed; it now preserves Failed for interrupted-server calls. Shutdown ordering was additionally verified with two real signaling sockets: mark active account calls Failed before terminating media sockets, retaining Failed history after restart. Full integration suite passes after these corrections. No applied migration was edited.

## Deployment evidence

Deployed verified implementation 16e1ff7 to canonical feature checkout, rebuilt web assets, enabled account feature, and added only the loaded Phoneapp nginx `/api/` proxy. `nginx -t` passed; reloaded nginx and restarted only project signaling. TURN and MariaDB remain active, with no configuration change. No active legacy rooms were found in the preceding four-hour lifecycle log before rollout. `smoke:accounts` passed through public HTTPS: synthetic enrollment/directory/incoming Answer/common Ended history, zero media seconds, own sessions logged out. Original `smoke` HTTPS/WSS room/offer/answer/hangup also passed. A smoke invoked immediately after the final service restart initially encountered nginx 502 before Node finished startup; the smoke now waits for public health before issuing enrollment grants, then passed. Metro port 8081 reports running. Generated owner handoff `artifacts/private/enrollment-1794963771095.txt` (600); code values never printed or committed. Original M1/physical speaker/earpiece/sustained/Ultra acceptance remains open.

## Limits and manual acceptance

Test accounts use one-time owner-issued enrollment codes and memory-only 12-hour sessions. Closing/reloading a client requires a fresh code. Tokens are stored as hashes on the backend and are never in public URLs/assets/log output. Owner handoff is a private mode-600 ignored file. No production identity/secure storage/clinical suitability claim.

Test identity/prototype APIs do not enable audio storage or transcription. Connection durations are server-timed intervals from authenticated client media-state reports, bounded by heartbeats; they are estimates rather than independently verified speech/work/billable seconds. Server restart terminates transient account calls with retained Failed history.

On actual iPhone and Android: reload existing development clients, enroll two different accounts, keep both screens foreground, call Patient A, answer/decline/cancel, verify two-way media and existing quality/output controls, then compare history IDs/outcomes/time. Test a second session's losing answer, background termination and no-answer status. These steps remain **not run on hardware**. Background/locked native ringing, audible ringtone/push delivery, recording/playback and transcripts are separate subsequent work.
