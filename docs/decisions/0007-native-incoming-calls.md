# 0007 Native device identity and incoming calls

Status: accepted for the synthetic development POC, 2026-11-18. Implements [0011](../plans/0011-native-background-incoming-calls.md); physical acceptance remains separate.

## Context and decision

Cold-start calling needs native identity and call handlers before React renders. Keep one provider/patient app with server-assigned roles and existing browser accounts. Native enrollment binds one installation to an account. iOS Keychain uses AfterFirstUnlockThisDeviceOnly and an installation marker; Android encrypts its no-backup file with a non-exportable Keystore AES key. A single native queue serializes refresh and authenticated HTTP requests, including system call actions. No biometric prompt is required to read an enrolled device after first unlock. Logout clears local sign-in and preserves an encrypted deferred revocation when offline; next restore/enrollment completes it first.

Native refresh enrollment has a fixed 90-day deadline. One-hour access sessions rotate refresh credentials; same-request retries can recover the encrypted response for 60 seconds. Different reuse of a spent refresh revokes that device and its sessions. Lost responses recovered beyond that window require re-enrollment. Browser enrollment remains memory-only and 12 hours. Native media ownership uses the authenticated device principal; browser ownership still uses the session. A refreshed device keeps the same room capability without permitting another device to answer or steal media.

Use the existing backend for APNs VoIP and FCM HTTP v1. Store provider tokens and refresh retry responses using versioned AES-256-GCM ciphertext with a private development master key. Migration 0004 is additive. Create a call's delivery records in the same transaction. Claim only active authorized devices for still-ringing calls, expire at 60 seconds, and disable rejected provider tokens. One VoIP delivery attempt avoids ambiguous retry rings; FCM permits bounded retries. Provider acceptance does not establish handset receipt.

Use early native PushKit registration and CallKit on iOS. Report incoming calls before JS/network work, then reconcile through authenticated native requests. On Android use the framework's self-managed Telecom ConnectionService, FirebaseMessagingService, call-style notifications and a phone-call foreground service. This is the explicit low-level Telecom option in 0011, rather than adding Core-Telecom for this increment. Use CallKit audio activation and Android Telecom output requests while native calls own audio; leave legacy routing available for manual rooms.

Native call control polls authenticated server state while the OS permits execution. A bounded iOS incoming background task ends stale rings if execution time expires. Answer/decline/end and competing-device state reconcile with the backend; an OS answer alone does not add connected seconds. Native WebRTC stats sample audio RTP progress every five seconds without JS timers. Transport counters provide a separate loss guard; quiet/muted media may pause measured seconds without inventing time. System CallKit mute updates native tracks and is reflected in the app. Camera is disabled on background and is not automatically restored.

## Consequences and review gates

Preview builds bundle JavaScript; no Metro is needed for cold-start testing. EAS internal iPhone signing is ad hoc and requires Production APNs plus a Push-capable provisioning profile. iOS simulator compilation cannot prove physical PushKit delivery or signing. Default system tones/notification-channel settings control incoming sound; legacy foreground ringtone toggles remain only for older binaries.

Server keys never enter Git or EAS. Only the public Android Firebase client configuration is staged into an explicit build path. Preserve the development encryption key when restoring DB state; do not regenerate it for existing encrypted registrations. Production key management, authentication, recording, transcription, clinical data and HIPAA readiness are outside this acceptance.

Revisit after real iPhone/Android results, OS/OEM permission behavior, native bridge/RTP evidence, background execution, lost-network and multi-device tests. Pinned SDK native method integration must be reviewed when upgrading WebRTC or React Native. Failure modes must end/reconcile calls honestly rather than promise delivery, force-stop bypass, or billing eligibility.
