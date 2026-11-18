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
| Final physical preview packages | Pass | Both FINISHED from 2e7cfce; bundled JS/native classes; iPhone profile and actual signed Production APNs entitlement/app/team match |
| Public legacy/account smoke | Pass | Existing HTTPS/WSS and foreground accounts remain available |

Migration 0004 and reviewed grants were applied in development after isolated checks and a private scoped snapshot. Backend native feature flag and credential file references are installed; no credentials are committed. Existing live checkout was advanced between calls after confirming zero active calls/connections. Private logs and snapshot are retained in `artifacts/private/native-calls/` (also staged under `/home/ubuntu/phoneapp-stage11`).

## Native compilation and signing

iOS simulator builds `2bcd1edc-ac2c-4af5-840f-0c5e5ca2e613` and `e3541171-2e9e-4256-9367-839eeff9ab14` compiled earlier source. Latest native source, including CallKit mute, compiled in simulator build `c8f80317-7933-4d00-87aa-998fcc6da915`. Simulator artifacts cannot be installed on the owner's iPhone or prove APNs delivery.

Initial device iOS build `cea655cf-4e12-4157-b2ea-14091803aa93` failed because the previous Ad Hoc profile lacks Push Notifications/aps-environment. Existing Apple cookie was checked and is expired; no password was supplied/read. Owner subsequently completed EAS credential configuration. Earlier physical preview e449609b compiled; it is superseded by final build below. Apple credential dependency is resolved.

Android build `b899c8e0` failed module version metadata; `decf7909` failed an allowBackup merge conflict; `4b8b981b` exposed the missing React bridge compile dependency. All are corrected. `c44419ab-b918-43c7-bdfa-92a9db7a4257` compiled successfully. Superseded `9023363b` was canceled. Earlier preview b153aa67 finished; it is superseded by final build below. Actual installation/device behavior is still untested.

## Handset gates still open

Install preview, enroll while foreground and grant microphone/notification permissions; verify incoming registration status. Provider browser → enrolled patient: foreground, another app visible, locked, and reboot → first unlock → no manual app launch. Confirm ring, Answer, audio both ways, camera consent, speaker/earpiece/headset and system/app mute, end/shared history. Repeat caller cancellation, another device answers, no answer, offline/late delivery, revocation/logout and network loss. Run with Metro unavailable. Record actual device models/OS/build/network and results; neither compiled binaries nor provider receipts complete this matrix.

Android Settings Force stop, manufacturer policies and pre-first-unlock are separate documented limits. iOS VoIP force-quit behavior is not inferred from generic APNs notification rules. No recording, transcription, clinical usage, or billing accuracy has been tested.

Final artifacts from native source `2e7cfce`: [Android 89e57322 APK](https://expo.dev/artifacts/eas/AmHOAAa-W1k50K9_n9jriTIJDPUK6mj1Rstg7Uv57k0.apk) and [physical iPhone 1e392d16 install](https://expo.dev/accounts/mbcollins2/projects/phoneapp/builds/1e392d16-039b-484b-9a7a-020fee6b20e9) are both FINISHED. These include the latest unanswered timeout handling, outgoing call direction, Android SIP account scheme and insistent incoming notification corrections. Both packages inspected with `scripts/check-native-packages.py`; iOS embedded profile and actual Mach-O signature entitlements are Production APNs, correct app/team, ad hoc physical build with one enrolled device and bundled JS. Android bundled JS, native classes and required manifest permissions pass. The script does not validate Apple trust chain or device runtime behavior. Private final metadata/check outputs and downloaded packages are in `artifacts/private/native-calls/`; QR images regenerated. No handset installation/receipt/media acceptance has been inferred.
