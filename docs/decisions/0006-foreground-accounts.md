# 0006 Synthetic enrollment and foreground account calls

Status: accepted for the authorized synthetic development iteration, 2026-11-18. Implements [0009](../plans/0009-authenticated-foreground-calls.md) within staged [0007](../plans/0007-provider-patient-calls-transcripts.md).

## Identity and app organization

Use one shared native app with backend-assigned care-team/patient screens, plus the browser companion. Separate installable variants are still optional later. The existing foreground call stack, quality and audio-output controls are shared; this iteration adds no native library or paid build.

For synthetic accounts, the owner runs `npm run accounts:enroll` through the trusted EC2 terminal. It generates high-entropy, one-use, 24-hour codes for the fixed synthetic Provider/Patient A/B/C identities and writes a new ignored mode-600 file. An HTTPS redemption transaction locks/consumes a code and issues a random 12-hour session credential. Only SHA-256 code/session hashes are stored in DB; expired/revoked credentials are rejected. Role comes from the DB, never a submitted role or patient ID. Redemption sets a clearly named synthetic issuer/subject; an external identity provider is not selected or simulated.

Tokens stay in app/browser memory, avoiding plaintext local storage. Reload/closing the app loses the local session and needs a new code; generate additional codes as needed. Logout revokes the current session. This temporary prototype identity flow does not establish production enrollment/identity verification, MFA, recovery, secure token persistence or staff administration. Selecting a production identity provider remains separate. Use synthetic accounts only; an issued unused code can activate its synthetic account, so revoke outstanding grants as part of future account administration.

## Durable calls and media

Every account API checks active sessions and current patient/care-team bindings. Calls/history are limited to participants with current patient access. Calls are initiated by assigned staff and addressed to the single enrolled patient self account. UI shows App Audio/Video as the only active option; patient must enroll first. Caregiver/provider expansion is future scope.

MariaDB transactions serialize duplicate starts, answer/cancel/decline/end transitions and first-session answer ownership. Incoming display polls every two seconds while the app/page is open; no APNs/FCM/native ringing is claimed. Ringing lasts 60 seconds, accepted setup 45 seconds, active calls at most four hours; background/permission/network failure ends or times out honestly. Individual caller/answering sessions own media; another enrolled device cannot join/end the answered call. Cancellation/end/timeout closes transient media access.

Private media rooms have no short public test code. Each session receives a distinct scoped capability only from its authorized call endpoint; signaling rechecks the bound active session/relationship/call before join, prevents duplicate participant slots, and relays media through the existing WebRTC path. Legacy POC room invitations remain separate. Capabilities are credentials: keep them out of URLs/logs. Authorization is rechecked by the five-second call sweep so revoked sessions/relationships close active rooms.

The existing single signaling process owns transient rooms. Shutdown/restart ends interrupted account calls as Failed and retains the durable call log; it does not pretend to resume WebRTC. Multiple-instance coordination is future scope. Additive migration 0003 keeps identity/call/transcript history intact; no startup DDL or destructive development migration.

## Time evidence and limits

Authenticated endpoints report media Connected/Disconnected and heartbeat every eight seconds. The server sums UTC intervals only while both endpoints report connected, with 20-second freshness bounds, preserving idempotent raw call events. Aggregate milliseconds before exposing integer seconds; never add two participants' durations together. Missing reports/setup/ringing do not become approved/billable time. These are endpoint-reported connection estimates, not independent proof of audible speech, clinical work or reimbursement. Full activity review/export/billing stays separate.

Recording/transcription remains Off. The schema can hold references, but no consent UX, audio capture, bucket, playback, transcription worker or provider is enabled. Native background/locked incoming calls and actual handset acceptance remain explicit later gates.

## References

[Node cryptographic random bytes](https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptorandombytessize-callback), [MariaDB transactional FOR UPDATE](https://mariadb.com/docs/server/reference/sql-statements/data-manipulation/selecting-data/for-update), [React Native fetch networking](https://reactnative.dev/docs/network).
