# Architecture direction

Status: proposed implementation, with established user constraints in [decision 0001](decisions/0001-project-direction.md). No runtime components exist yet.

## First experiment

```text
iPhone native app ---- secure signaling service ---- Android native app
       |                                                   |
       +--------------- WebRTC audio/video ----------------+
                      direct or via TURN
```

- Expo/React Native + TypeScript, `expo-dev-client`, `react-native-webrtc`, and its compatible Expo config plugin.
- EAS builds native device clients. The EC2-hosted Expo/Metro server supplies development JavaScript; an Expo tunnel can make Metro reachable remotely.
- A minimal Node/TypeScript signaling service exchanges offers, answers, ICE candidates, session membership, and leave events. Limit sessions to two participants; use expiring invitations and validate message sizes/types.
- STUN assists connection discovery; authenticated TURN relays when needed. An Expo development tunnel does not provide signaling or relay media. The signaling endpoint needs its own secure public route; TURN needs appropriately reachable relay transports/ports.
- Keep short-lived room state in memory for M1, with expiry and cleanup. Restarting the service may end sessions; document that limit. No DB is needed for this experiment.
- Use actual peer connection state for the duration display. Server observations of signaling alone do not prove that media flowed.

Pin versions after verifying the current compatibility matrix. The direct WebRTC implementation is a learning experiment; do not assume it is the final telephone/video provider architecture.

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
