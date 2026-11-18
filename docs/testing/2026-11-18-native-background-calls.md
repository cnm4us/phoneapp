# Native background incoming calls — implementation evidence

Date: 2026-11-18 UTC. [Plan 0011](../plans/0011-native-background-incoming-calls.md). Synthetic data only. Native handset acceptance is **pending**.

## Automated and development evidence

| Check | Result | Scope |
| --- | --- | --- |
| TypeScript | Pass | App, backend, browser, DB and new client tests |
| Existing unit/server suite | 58 pass | Foreground/media/control regression; no handset inference |
| Account client restoration/mute races | 5 pass | Cold restore of owned answer, revocation, late response after logout, queued system mute and account change |
| Native API/device/delivery suite | 7 scenarios pass, 8 Node tests including wrapper | AES tamper/wrong key, concurrent refresh/idempotency/replay revocation, invalid proof/expiry, same-device media ownership, another-device denial, encrypted registration/outbox/cancel/expiry/token invalidation, HTTP contracts and honest media time |
| Existing account integration | 6 scenarios pass, 7 Node tests | Real isolated MariaDB and Chromium two-way WebRTC/shared history |
| Database | 8 scenarios pass, 9 Node tests | Clean install, upgrade preserving existing call/transcript data, migration locks/history and dirty-DDL recovery |
| Development grants | Pass | No runtime DDL/DELETE/history mutation; scoped new-table writes |
| Browser | 13 local and 13 public cases pass | Includes real synthetic media and TURN relay; no native OS inference |
| JS exports | Both platforms pass | Bundling, not native execution |
| Native prebuild/autolinking | Pass | Both local modules and iOS early AppDelegate subscriber discovered |
| EAS archive inspection | Pass | Firebase client config/native sources included, sender keys/service-account JSON/env files excluded |
| FCM real API | Validate-only HTTP 200 | Authentication, API and request authorization accepted; no phone push delivered |
| Public deployed native API | Pass | Synthetic native enrollment/refresh/device identity/logout; smoke device revoked, no push/media |
| Public legacy/account smoke | Pass | Existing HTTPS/WSS and foreground accounts remain available |

Migration 0004 and reviewed grants were applied in development after isolated checks and a private scoped snapshot. Backend native feature flag and credential file references are installed; no credentials are committed. Existing live checkout was advanced between calls after confirming zero active calls/connections. Private logs and snapshot are retained in `artifacts/private/native-calls/` (also staged under `/home/ubuntu/phoneapp-stage11`).

## Native compilation and signing

iOS simulator builds `2bcd1edc-ac2c-4af5-840f-0c5e5ca2e613` and `e3541171-2e9e-4256-9367-839eeff9ab14` compiled earlier source. Latest native source, including CallKit mute, compiled in simulator build `c8f80317-7933-4d00-87aa-998fcc6da915`. Simulator artifacts cannot be installed on the owner's iPhone or prove APNs delivery.

Initial device iOS build `cea655cf-4e12-4157-b2ea-14091803aa93` failed because the previous Ad Hoc profile lacks Push Notifications/aps-environment. Existing Apple cookie was checked and is expired; no password was supplied/read. Owner subsequently completed EAS credential configuration. Physical preview `e449609b-04bf-4384-9ad4-39bd069e3320` is now submitted; final signing/entitlement/compilation still being checked.

Android build `b899c8e0` failed module version metadata; `decf7909` failed an allowBackup merge conflict; `4b8b981b` exposed the missing React bridge compile dependency. All are corrected. `c44419ab-b918-43c7-bdfa-92a9db7a4257` compiled successfully. Superseded `9023363b` was canceled. Final preview `b153aa67-5838-4252-94be-f966afaec5b9` includes the final account/mute-state fix; EAS reports FINISHED and its APK installation endpoint returns HTTP 200. Actual installation/device behavior is still untested.

## Handset gates still open

Install preview, enroll while foreground and grant microphone/notification permissions; verify incoming registration status. Provider browser → enrolled patient: foreground, another app visible, locked, and reboot → first unlock → no manual app launch. Confirm ring, Answer, audio both ways, camera consent, speaker/earpiece/headset and system/app mute, end/shared history. Repeat caller cancellation, another device answers, no answer, offline/late delivery, revocation/logout and network loss. Run with Metro unavailable. Record actual device models/OS/build/network and results; neither compiled binaries nor provider receipts complete this matrix.

Android Settings Force stop, manufacturer policies and pre-first-unlock are separate documented limits. iOS VoIP force-quit behavior is not inferred from generic APNs notification rules. No recording, transcription, clinical usage, or billing accuracy has been tested.
