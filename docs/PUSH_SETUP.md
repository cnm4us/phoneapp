# Apple and Android push setup

Updated: 2026-11-18. Account setup handoff for [plan 0011](plans/0011-native-background-incoming-calls.md); background calling is not implemented yet.

The owner performs account login and credential approval/download. The agent handles app configuration, server integration, native implementation, and builds within the authorized stage. Existing EAS signing works; push sender access is a separate prerequisite.

## Start with Firebase for Android

1. Open the [Firebase console](https://console.firebase.google.com/), then create a Phoneapp project or select an existing project dedicated to this app. Google Analytics is optional for this setup.
2. Add an Android app with this exact package name: `com.bawebtech.phoneapp.poc`. A nickname such as Phoneapp POC is fine.
3. Download `google-services.json`. The agent will handle SDK/Gradle integration; no local Android Studio installation is needed for this workflow.
4. Using VS Code Remote SSH, copy the downloaded file to `/home/ubuntu/phoneapp/artifacts/private/push/google-services.json` on EC2.
5. Tell the agent the Firebase project ID and that the file is available. The project ID is not a private key.

This file configures the Android client; it does not authorize the EC2 server to send messages. A separate, appropriately scoped FCM server identity is still required. Once the project is selected, configure that identity through the owner's Google Cloud account, using workload identity or a dedicated service account. If a private service-account JSON key is used, keep it only on the backend in the private directory below, never in a mobile build. Verify sender permissions before delivery testing.

References: [Firebase Android setup](https://firebase.google.com/docs/android/setup), [FCM server authorization](https://firebase.google.com/docs/cloud-messaging/send/v1-api).

## Apple: check for a reusable push key first

1. Sign in to [Apple Developer — Keys](https://developer.apple.com/account/resources/authkeys/list).
2. Check whether an existing key has Apple Push Notification service (APNs) enabled. Tell the agent whether one exists; key ID/team ID are metadata, but do not paste any private key into chat.
3. If an existing matching `.p8` file is already saved, place it in `/home/ubuntu/phoneapp/artifacts/private/push/`. If EAS manages it, verify whether it can be reused for this server's VoIP sender before creating another key.
4. If no usable key is available, the owner must create/download an APNs key with Account Holder or Admin access. Before creation, confirm environment and scope for Phoneapp's VoIP topic. Apple offers environment and Team Scoped/Topic Specific choices; verify these against the intended delivery configuration alongside native implementation.

Apple allows the private key download only once. Keep a secure owner backup. Do not revoke or replace keys used by other apps. App identifier: `com.bawebtech.phoneapp.poc`. The native stage must also enable/verify Push Notifications capability, entitlements, VoIP topic/environment, and matching provisioning. Signing alone does not establish these delivery checks.

Reference: [Apple private-key setup and download rules](https://developer.apple.com/help/account/keys/create-a-private-key/).

## Private handoff directory and actual status

`/home/ubuntu/phoneapp/artifacts/private/push/` exists with directory mode 700 and is excluded from both Git and EAS uploads. Keep downloaded credentials mode 600. The agent will set restrictive file permissions after handoff and configure backend-only references; never place sender credentials in public app variables. Android client configuration will need an explicit build packaging path during implementation because this staging directory is excluded from EAS.

Read-only EAS credential-menu inspection confirmed existing iOS signing/provisioning and a push-key management menu. Apple login was declined; no key was selected, generated, downloaded, or modified. A reusable APNs sender key is still unverified. No Firebase project, client configuration, server identity, provider send, native push registration, or new build has been configured or tested for this stage.

Next independent development increment remains secure device-bound credential restoration and backend registration/delivery contracts. Credentials alone do not add background ringing; plan 0011 includes the native work and handset acceptance.
