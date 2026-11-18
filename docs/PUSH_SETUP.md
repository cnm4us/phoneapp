# Apple and Android push setup

Updated: 2026-11-18. Account setup handoff for [plan 0011](plans/0011-native-background-incoming-calls.md); background calling is not implemented yet.

The owner performs account login and credential approval/download. The agent handles app configuration, server integration, native implementation, and builds within the authorized stage. Existing EAS signing works; push sender access is a separate prerequisite.

## Start with Firebase for Android

1. Open the [Firebase console](https://console.firebase.google.com/), then create a Phoneapp project or select an existing project dedicated to this app. Google Analytics is optional for this setup.
2. Add an Android app with this exact package name: `com.bawebtech.phoneapp.poc`. A nickname such as Phoneapp POC is fine.
3. Download `google-services.json`. The agent will handle SDK/Gradle integration; no local Android Studio installation is needed for this workflow.
4. Using VS Code Remote SSH, copy the downloaded file to `/home/ubuntu/phoneapp/artifacts/private/push/google-services.json` on EC2.
5. Tell the agent the Firebase project ID and that the file is available. The project ID is not a private key.

Client configuration received and parsed: project `phoneapp-9a5c4`, one matching Android client for `com.bawebtech.phoneapp.poc`, project number and mobile app ID present. This file does not authorize the EC2 server to send messages. A separate FCM server identity is still required.

### Remaining Android account step: server sending credential

For this EC2 proof of concept, use a dedicated service account:

1. Open [Google Cloud service accounts for Phoneapp](https://console.cloud.google.com/iam-admin/serviceaccounts?project=phoneapp-9a5c4), confirming selected project `phoneapp-9a5c4`.
2. Create a service account named `phoneapp-push-sender`, or reuse an existing account dedicated to this purpose.
3. In project access, grant **Firebase Cloud Messaging API Admin** (`roles/firebasecloudmessaging.admin`). Do not grant general project Owner/Editor for this sender.
4. Open that service account → Keys → Add key → Create new key → JSON. Save the download on EC2 as `/home/ubuntu/phoneapp/artifacts/private/push/fcm-service-account.json`.
5. Verify the [Firebase Cloud Messaging API](https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=phoneapp-9a5c4) is enabled in this project.

This private JSON belongs only on the backend; never bundle it in the mobile app. If Google account policy blocks key creation, report that condition rather than changing organization policy; workload identity is an alternative. The agent must validate the downloaded credential/project and authorization separately before claiming delivery works.

References: [FCM API sender role](https://docs.cloud.google.com/iam/docs/roles-permissions/firebasecloudmessaging), [Google service-account key download](https://docs.cloud.google.com/iam/docs/keys-create-delete).

References: [Firebase Android setup](https://firebase.google.com/docs/android/setup), [FCM server authorization](https://firebase.google.com/docs/cloud-messaging/send/v1-api).

## Apple: check for a reusable push key first

1. Sign in to [Apple Developer — Keys](https://developer.apple.com/account/resources/authkeys/list).
2. Check whether an existing key has Apple Push Notification service (APNs) enabled. Tell the agent whether one exists; key ID/team ID are metadata, but do not paste any private key into chat.
3. If an existing matching `.p8` file is already saved, place it in `/home/ubuntu/phoneapp/artifacts/private/push/`. If EAS manages it, verify whether it can be reused for this server's VoIP sender before creating another key.
4. If no usable key is available, the owner must create/download an APNs key with Account Holder or Admin access. Before creation, confirm environment and scope for Phoneapp's VoIP topic. Apple offers environment and Team Scoped/Topic Specific choices; verify these against the intended delivery configuration alongside native implementation.

Apple allows the private key download only once. Keep a secure owner backup. Do not revoke or replace keys used by other apps. App identifier: `com.bawebtech.phoneapp.poc`. The native stage must also enable/verify Push Notifications capability, entitlements, VoIP topic/environment, and matching provisioning. Signing alone does not establish these delivery checks.

Reference: [Apple private-key setup and download rules](https://developer.apple.com/help/account/keys/create-a-private-key/).

### EAS testing requires the matching APNs environment

Owner confirms the supplied Apple key is **Sandbox**; key type/topic scope is still unconfirmed. Both current EAS profiles use `distribution: internal`, which uses ad hoc signing for these iPhone installs. Ad hoc signing uses **Production APNs**, including an EAS development client; the profile name does not choose the push environment. Obtain/reuse a Production-authorized APNs key for this workflow. Owner subsequently reports revoking the earlier Sandbox key; do not use that file for sending. One Production-authorized key suffices for this workflow. A separate Sandbox key would only be needed if development-signed testing is added; no replacement Sandbox key is required now. Team Scoped supports all team topics if selected; a Topic Specific key must include the required Phoneapp VoIP topic.

Before sending, inspect the new signed binary's actual `aps-environment` and provisioning after push capability is added, and register its VoIP token under that environment. Existing foreground builds do not prove push entitlement/delivery. “Production APNs” here identifies Apple's push endpoint; testing remains internal with synthetic accounts and needs no App Store release.

References: [Expo internal distribution signing](https://docs.expo.dev/build/internal-distribution/), [Apple APNs environment/signing rules](https://developer.apple.com/library/archive/technotes/tn2265/_index.html), [Apple token-key scope/environment](https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns).

## Private handoff directory and actual status

`/home/ubuntu/phoneapp/artifacts/private/push/` exists with directory mode 700 and is excluded from both Git and EAS uploads. Keep downloaded credentials mode 600. The agent will set restrictive file permissions after handoff and configure backend-only references; never place sender credentials in public app variables. Android client configuration will need an explicit build packaging path during implementation because this staging directory is excluded from EAS.

Owner subsequently supplied `google-services.json` and `AuthKey_C3W3F7TQ6D.p8`; both are present and mode 600. Firebase structure/app matching passes. Apple key parses as EC P-256 and a local sign/verify round trip passes; this does not establish Apple APNs authorization, key scope/environment, revocation state, or VoIP delivery. Existing EAS signing metadata supplies the team ID, retained in private `credential-status.json`; no need to ask the owner for it again. Owner confirms Sandbox and subsequently reports revoking the earlier key; treat this supplied key as unusable. Matching Production key/access for EAS ad hoc installs remains pending.

Read-only EAS credential-menu inspection previously confirmed iOS signing/provisioning and a push-key management menu. Apple login was declined and no EAS keys were changed. No FCM server identity, provider send, native push registration, server wiring or new build has been configured or tested for this stage. Private status metadata records file locations and validation limits without copying private key contents.

Next independent development increment remains secure device-bound credential restoration and backend registration/delivery contracts. Credentials alone do not add background ringing; plan 0011 includes the native work and handset acceptance.
