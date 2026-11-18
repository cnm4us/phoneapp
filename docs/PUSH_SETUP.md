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

Owner separately confirmed that project ID. The ID identifies the project; FCM HTTP v1 send requests also need an OAuth access token from an authorized identity. A service-account JSON file is the selected simple EC2 setup, not a universal Firebase requirement: configured Application Default Credentials or AWS-to-Google Workload Identity Federation could supply authentication instead. Inspection found no Google credential environment names, Google sender settings in `.env.server`, conventional local gcloud ADC/login store, or service-account/external-account credential JSON in private push staging. No Google authorization was established by that read-only inspection.

### Remaining Android account step: server sending credential

The existing Firebase-created `firebase-adminsdk-…` service account can be used for this proof of concept. The owner-reported **Firebase Admin SDK Administrator Service Agent** role includes `cloudmessaging.messages.create`; a second service account is not required. This account has broader Firebase access than a sender-only account. Its existence and roles are owner-reported; actual server authorization remains untested.

To use it, open Firebase → Phoneapp → Project settings → Service accounts → Firebase Admin SDK → **Generate new private key**, then confirm **Generate key**. Save the downloaded JSON as `/home/ubuntu/phoneapp/artifacts/private/push/fcm-service-account.json`. The personal Google account listed in IAM is the human project owner, not the server service account.

If viewing Google Cloud **IAM permissions** (owner screenshot), key management is on a different page: click **Service Accounts** in the left sidebar, or open [Phoneapp service accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=phoneapp-9a5c4). Click the `firebase-adminsdk-fbsvc@phoneapp-9a5c4.iam.gserviceaccount.com` email → **Keys** → **Add key** → **Create new key** → **JSON** → **Create**. This downloads the same kind of server credential; use the private EC2 destination above. Google Cloud labels differ from Firebase's Generate new private key button.

A separate sender-only service account is an optional narrower-access alternative:

1. Open [Google Cloud service accounts for Phoneapp](https://console.cloud.google.com/iam-admin/serviceaccounts?project=phoneapp-9a5c4), confirming selected project `phoneapp-9a5c4`.
2. Create a service account named `phoneapp-push-sender`, or reuse an existing account dedicated to this purpose.
3. In project access, grant **Firebase Cloud Messaging API Admin** (`roles/firebasecloudmessaging.admin`). Do not grant general project Owner/Editor for this sender.
4. Open that service account → Keys → Add key → Create new key → JSON. Save the download on EC2 as `/home/ubuntu/phoneapp/artifacts/private/push/fcm-service-account.json`.
5. Verify the [Firebase Cloud Messaging API](https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=phoneapp-9a5c4) is enabled in this project.

This private JSON belongs only on the backend; never bundle it in the mobile app. If Google account policy blocks key creation, report that condition rather than changing organization policy; workload identity is an alternative. The agent must validate the downloaded credential/project and authorization separately before claiming delivery works.

References: [FCM roles including the Admin SDK send permission](https://docs.cloud.google.com/iam/docs/roles-permissions/firebasecloudmessaging), [Google service-account key download](https://docs.cloud.google.com/iam/docs/keys-create-delete).

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

## Current private handoff status

All three supplied files are present in `/home/ubuntu/phoneapp/artifacts/private/push/` (directory 700, files 600):

| Purpose | Actual filename | Verified |
| --- | --- | --- |
| Android client config | `google-services.json` | Project `phoneapp-9a5c4`, Android `com.bawebtech.phoneapp.poc`, required client metadata |
| Production APNs sender key | `AuthKey_WS664U36TD.p8` | Local EC P-256 parsing/signature; Production environment is owner-reported |
| Firebase server credential | `phoneapp-9a5c4-515f1c967b53.json` | Service-account/project/email/token endpoint, RSA signature, real Google OAuth exchange with Firebase Messaging scope (HTTP 200) |

Keep the original Firebase download filename; the proposed `fcm-service-account.json` name in setup instructions is optional. No additional credential download is currently requested. The OAuth token was neither displayed nor saved. A subsequent real FCM validate-only request returned HTTP 200, verifying API authorization without sending a handset notification. Actual device delivery remains untested. Apple scope/topic, key authorization, app capability and signed push entitlement remain to verify during integration.

Earlier Sandbox `AuthKey_C3W3F7TQ6D.p8` is owner-reported revoked; do not use it. Private `credential-status.json` selects current key/file metadata and preserves that revoked history. Existing EAS signing supplies team metadata; key/team ownership remains to verify against APNs.

The staging directory is excluded from Git and EAS uploads. Never ship sender credentials to a phone. Android client config needs an explicit build packaging path during implementation because the staging directory is excluded from EAS. Sender file references and the native feature flag are now configured in the development service. Native code/build work is under 0011; no real device push or handset test has been performed. The public native API smoke used an ephemeral synthetic device and revoked it afterward.

Plan 0011 implements restoration/contracts and native integration; current gates are final preview checks, the Push-capable physical iPhone signing profile and real device acceptance. Credential receipt alone does not add background ringing.

## Physical iPhone signing handoff

The earlier ad hoc profile lacks Push Notifications/aps-environment. From the latest source checkout run `eas credentials:configure-build --platform ios --profile preview`, authenticate Apple and allow Phoneapp capability/profile update. Existing Apple cookie was checked and is expired; no password was entered by the agent. Keep passwords/2FA in the EAS terminal prompts, not chat. The agent can then submit and verify the physical preview build.

Owner subsequently confirmed the EAS Apple credential step is done. Physical iPhone preview e449609b is submitted. Continue with that build result rather than requesting the same authentication again; actual signed push entitlement and delivery remain to verify.
