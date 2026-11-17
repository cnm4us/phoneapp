# Architecture direction

Status: M1 implementation exists; physical acceptance pending. See [decision 0002](decisions/0002-webrtc-implementation.md) for selected versions and deployment. Later product components remain proposals.

## First experiment

```text
iPhone native app ---- secure signaling service ---- Android native app
       |                                                   |
       +--------------- WebRTC audio/video ----------------+
                      direct or via TURN
```

- Expo 57.0.33 / React Native 0.86.3 + TypeScript, `expo-dev-client`, `react-native-webrtc` 155.0.1, and Expo config plugin 15.0.2. Native configuration includes scene support for current iOS builds.
- EAS builds native device clients. The EC2-hosted Expo/Metro server supplies development JavaScript; an Expo tunnel can make Metro reachable remotely.
- A minimal Node/TypeScript signaling service exchanges offers, answers, ICE candidates, session membership, and leave events. Limit sessions to two participants; use expiring invitations and validate message sizes/types.
- STUN assists connection discovery; authenticated TURN relays when needed. An Expo development tunnel does not provide signaling or relay media. The signaling endpoint needs its own secure public route; TURN needs appropriately reachable relay transports/ports.
- Keep short-lived room state in memory for M1, with expiry and cleanup. Restarting the service may end sessions; document that limit. No DB is needed for this experiment.
- Use actual peer connection state for the duration display. Server observations of signaling alone do not prove that media flowed.

The direct WebRTC implementation is a learning experiment; do not assume it is the final telephone/video provider architecture. The plugin's published matrix stops at SDK 56; its declared peer range permits 56 and later. SDK 57 was selected to avoid the SDK 56 Hermes regression. Dependency validation, prebuild, and JS bundles pass; native build/device verification is recorded separately.

## Implemented layout and service boundaries

- `App.tsx` and `src/call/`: native test screen and call lifecycle. SDP processing is serialized; early ICE is queued; connected time uses a monotonic clock; backgrounding ends this foreground-only experiment.
- `shared/protocol.ts`: wire types shared by app and server.
- `server/`: Node/TypeScript HTTP/WebSocket service, capability invitations, room bounds/expiry, heartbeat, validation, and coturn credential issuance. Room creation requires a private test access key entered by the creator; the invitation grants room access to the second participant.
- `deploy/`: project-specific nginx/systemd/coturn templates. nginx terminates HTTPS/WSS; signaling binds `127.0.0.1:8787`; coturn binds the EC2 private IP on 3478 and TLS 5349 with a bounded UDP relay range.
- `.env.server`: ignored, mode 600, with generated room-creation key and TURN master secret. Clients receive only time-limited TURN credentials after room authorization. No recording or conversation persistence.
- `scripts/`: configuration bootstrap, public signaling smoke test, and Linux coturn packet-exchange diagnostic.
- `web/`: responsive browser companion. It uses the same native signaling protocol and shared clock/invitation/ICE helpers. esbuild emits `web/dist`; server startup loads only HTML/JS/CSS from an explicit allowlist. nginx routes those paths through the existing HTTPS origin, with no CORS or new account/service required. Creator key is entered in memory; optional invitation fragments are removed from the address bar after loading.

The live development services follow this checkout. Before switching to a branch without server code or changing dependencies, stop the project services or prepare the replacement. This is a development deployment, not an immutable production release.

## Later product components

```text
Native staff apps / patient browser
             |
      Authenticated backend ---- persistent patient/activity database
             |                              |
   Provider callbacks/jobs           review and exports
             |
 Twilio Voice + Messaging / selected video and transcription services
```

- The backend owns patient/contact associations, authorized access, provider credentials, event normalization, activity review, and exports.
- Twilio Voice's native React Native SDK is the proposed telephone integration. Its signaling, tokens, call legs, and native incoming-call lifecycle differ from the direct M1 experiment. Use the SDK's own setup rather than assuming a raw WebRTC room can dial a phone number.
- Twilio Messaging provides service-number SMS; device-local personal SMS access is not part of the design.
- Persistent PostgreSQL is proposed. Database provider, migration/ORM tool, authentication, video provider, and job system remain undecided until their implementation plans.
- Store raw provider event identifiers separately from a normalized logical encounter so transfers/retries/multiple call legs do not inflate time. Enforce idempotency at persistent boundaries.
- Keep original observations, corrections, and review decisions distinguishable. Apply billing rules through a separately validated/versioned policy.

## Proposed domain concepts

| Concept | Purpose |
| --- | --- |
| Staff member / role | Authenticated actor and historical role attribution. |
| Patient | Stable internal ID and optional practice-facing identifier/name. |
| Contact / patient-contact relationship | Shared and multiple phone numbers, ownership, caregiver relationship, permissions. |
| Encounter / participant / call leg | One logical interaction and its actual endpoints/lifecycle. |
| Message / composition or reading session | Message contents/status separate from staff activity estimates. |
| Activity / observation / review / allocation | Measured work, corrections, approved seconds, and service attribution. |
| Consent / transcript / revision | Recording permission and attributed, correctable draft text. |
| Export run | Reproducible reporting parameters and generation metadata. |

This is a conceptual model, not an applied schema. Detailed migrations belong to M2 or the first persistence plan.

## Time and data boundaries

Persist event times in UTC and duration in integer seconds. Select a practice timezone explicitly before monthly reports; the developer's timezone and host timezone are not business configuration. Separate foreground reading estimates from confirmed work. Keep diagnostic collection minimal and secrets out of mobile/public variables and Git. Production controls are specified at a high level in the PRD and intentionally deferred from M1.
