# 0002 WebRTC implementation and development hosting

Date: 2026-11-16. Status: implemented; native/device validation remains pending.

## Context

The owner supplied `phoneapp.bawebtech.com` pointing to this EC2 instance. The existing Expo account is authenticated as `mbcollins2`. The host has nginx, certbot, sudo access, and an AWS role that lacks EC2 administration permissions.

## Decisions

- Use a single root native app with `server/` and `shared/` modules in the same pinned npm project. Keep persistence out of M1.
- Use Expo 57.0.33, React Native 0.86.3, WebRTC 155.0.1, config plugin 15.0.2, and TypeScript 6.0.3. SDK 56 was initially investigated from the plugin's matrix, but Expo Doctor identified a Hermes regression. SDK 57 resolves it. The plugin declares Expo >=56; validation/prebuild/bundling pass with 57, while the native build and real-device result remain separate evidence.
- Enable iOS scene support through `expo-build-properties`. Generate native folders through Expo; keep generated `ios/` and `android/` out of Git/EAS upload so cloud builds regenerate them.
- Use WebSocket signaling with server-assigned initiator, short-lived capability invitations, a two-person limit, payload validation, and bounded room/socket state. Room creation needs a private test access key; room membership grants scoped TURN credentials.
- Host dedicated HTTPS/WSS routes via nginx and a project-specific systemd signaling unit. Configure coturn with HMAC REST credentials, UDP/TCP 3478, TLS 5349, a bounded relay range, quotas, and private/multicast peer exclusions.
- Keep the app foreground-only. Backgrounding ends capture/session; permission prompts that make iOS temporarily inactive do not end it.
- Use Node's test runner through `tsx`, TypeScript checks, Expo Doctor, native config generation, JS bundle export, public signaling smoke checks, and Linux relay diagnostics. Physical phones still determine M1 acceptance.

## Consequences

This is a development deployment that follows the working checkout, not an immutable production release. Native dependency/config changes need another EAS build; UI/logic changes can load through Metro. Android native build and public signaling/relay samples pass. The owner approved pay-as-you-go for the iPhone build after the account overage notice; iOS signing/native and both real-device tests remain pending. No production readiness or HIPAA claim follows from this setup.

## Inputs

- [Expo SDK 57 release notes](https://expo.dev/changelog/sdk-57)
- [WebRTC config plugin](https://github.com/expo/config-plugins/blob/main/packages/react-native-webrtc/README.md)
- [Native WebRTC project](https://github.com/react-native-webrtc/react-native-webrtc)
- [Coturn configuration documentation](https://github.com/coturn/coturn/blob/master/README.turnserver)
