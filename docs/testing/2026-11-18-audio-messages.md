# Audio messages and shared patient history — evidence

Date: 2026-11-18. [Plan 0012](../plans/0012-audio-messages-shared-history.md), [ADR 0008](../decisions/0008-audio-messages.md). Synthetic data only. Owner confirms native iPhone recording/sending; remaining playback/reply/interruption and Android acceptance is open.

## Automated checks

| Check | Result | Scope |
| --- | --- | --- |
| TypeScript / Expo Doctor | Pass; Doctor 21/21 | App/backend/browser/DB and SDK dependency compatibility |
| Existing unit suite | 58 pass | Calling, policy, audio routing and foreground alert regression |
| Message client | 5 pass | Loaded-history refresh, late-account response, interrupted start, duplicate/lost-response retry key and live-call blocking |
| Message integration | 8 scenarios, 9 Node tests including wrapper | Real MariaDB and media decode; late enrollment, access/revocation/grant replay, invalid/long input, storage limit, reply/pagination, crash lease/orphan recovery, network-reference refusal, scoped metadata/file restore and expiry |
| Browser message UI | Pass within integration suite | Real Chromium MediaRecorder -> preview -> send; provider closes page before patient enrolls/plays/replies |
| Database | 8 scenarios, 9 Node tests | Clean/v4 upgrade preserves call/transcript/native refresh credential fixtures, recovery and integrity |
| Runtime grants | Pass in development | Reviewed message/grant writes; runtime has no DELETE/DDL/history mutation |
| Existing native/auth suite | 7 scenarios, 8 Node tests | Device/refresh/outbox/ownership regression; fake provider delivery |
| Existing account integration | 6 scenarios, 7 Node tests | Real Chromium two-way WebRTC and durable history |
| Existing browser calls | 13 local and 13 public pass | Includes TURN and live public HTTPS/WSS |
| Native JS export | Both pass | Metro bundles compile; not hardware proof |
| Native generation / source archive | Pass | Call background modes preserved; patch/client config included; server/env/keys/media excluded |
| Public media smoke | Pass | One synthetic tone Provider -> Patient C, processing/history and authenticated 32-byte Range playback through nginx; no call or notification |

`npm run test:audio-messages` owns the disposable DB suite lock and clears only its two message tables in `phoneapp_test` before its fixtures. It uses private temporary files and removes them afterward. `npm run smoke:audio-messages` explicitly creates a real synthetic development history entry and leaves its audio subject to the seven-day POC expiry; use only intentionally. Neither command supplies billing evidence or physical audio perception.

## Development rollout

Migration 0005 and reviewed runtime grants were applied after isolated tests and a private scoped pre-migration snapshot. Local private media root `/var/lib/phoneapp/media` is owned by ubuntu, mode 700; outputs are mode 600. Existing service retains `ProtectSystem=strict`, `ProtectHome=read-only`, `NoNewPrivileges=true` and a 0077 umask, with only the media root added to `ReadWritePaths`.

Initial public upload exposed the service's read-only filesystem; the scoped allowlist and failure-state handling fixed it. The subsequent public upload/processing/history/seek smoke passes. Only the Phoneapp hostname gained a separate media upload route/limits; general API bodies remain 4 KiB. Before rollouts, active account calls and signaling connections were checked as zero. Service is healthy; public browser calling suite passes. Private snapshot/config/nginx/service/build metadata and logs are under ignored `artifacts/private/audio-messages/` (retained from stage12).

Native sign-in and call delivery keys are preserved. Feature rollback is `ENABLE_AUDIO_MESSAGES=false` with the current schema-compatible source and a project-service restart between calls. Do not roll back to code expecting only four migrations or drop message/history tables. Combined DB/media restoration was rehearsed with an isolated synthetic fixture; development snapshot restoration was not performed. Host volume encryption and production disaster recovery are not established by filesystem permissions.

## Native builds and physical gates

Final previews from app source `a531f02`: [Android 8f1f8545](https://expo.dev/accounts/mbcollins2/projects/phoneapp/builds/8f1f8545-4d05-49b6-aef7-664af3ebb28a) and [iPhone 6f97fb13](https://expo.dev/accounts/mbcollins2/projects/phoneapp/builds/6f97fb13-92ed-4b1c-8e7c-3b3de16e2f09) are both FINISHED. Native calling/media handlers and bundled JS are inspected in both packages. Actual iPhone profile/signature entitlement metadata is Production APNs with the correct physical app identity, and its native message audio-stop selector is present. Android DEX contains ExpoAudio and the native call-audio action; private receiver/method names are optimized away, so receiver behavior is established only by source/compile evidence until device testing. This is package/compilation evidence, not a complete device matrix or Apple trust-chain validation. Both QR images point to final installations; no Metro is required.

Earlier source `816521e` compiled as iPhone 9242ea52 and Android 73df71c4. Owner's successful iPhone recording/sending feedback is on that earlier preview. Final app code adds a loaded-history refresh fix with its fifth client regression case; native audio code is unchanged. Backend additionally refuses ambiguous in-progress retries and rechecks revoked sessions at upload completion. Tests exercise a real partially streamed upload followed by logout, then verify no publication. Final public media smoke and all 13 public browser calling checks pass after rollout.

Install latest preview over existing apps; native enrollment should persist. Refresh browser; it needs a fresh Provider code because browser auth remains memory-only. Latest private Provider code: `artifacts/private/enrollment-1795038082921.txt` (one-use, 24h, 600; issued on request). Initial four-account file was enrollment-1795037510560.txt; its Provider code should not be assumed unused. Existing enrolled phones do not need fresh codes unless signed out. Owner installed iPhone preview 9242ea52 and confirms recording and sending work. Preview/playback/seek, reply and incoming-call interruption are not separately established by that response. A fresh Provider-only code was issued in `artifacts/private/enrollment-1795038082921.txt` on request; owner subsequently confirms patient -> provider playback; the reverse direction/reply remains pending.

Outstanding hardware matrix: browser -> iPhone and Android playback/seek; iPhone/Android record/reply -> browser and each other; sender closed/recipient opens later; permissions, microphone release on background, native incoming call during record/play, speaker/headset and no auto-resume; expiry/unavailable feedback; logout and account switch. Record device model/OS/build/network and results. Existing 0011 Android/locked/reboot acceptance remains separately open. No video messages, transcription, live-call recording or telephone integration is implemented by this increment.

## Owner feedback — patient to provider playback

2026-11-18: owner confirms the provider can play the audio message left by the patient. In the ongoing test this is the iPhone patient -> desktop provider flow; the latest feedback does not restate exact build/OS/browser versions. Record positive owner-operated playback evidence in that direction. Provider -> patient playback/reply, seek/pause, delayed/reopened recipient state, incoming-call interruption and Android remain unconfirmed. No app/server/DB changes or additional device calls were initiated for this feedback.
