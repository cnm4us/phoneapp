# 0001 Project direction and first experiment

Date: 2026-11-16. Status: accepted user direction; implementation choices identified below remain proposed.

## Context

The owner has built wrapped websites with Expo, works from Windows/VS Code with an EC2 checkout, has Expo/EAS and Apple Developer accounts, and wants a native iOS/Android care-management communications/time app. The first requested implementation milestone is a WebRTC proof of concept using his iPhone and his wife's Android. The current task creates the PRD and continuity foundation.

## Accepted direction

- Build a native mobile experience for both platforms, with shared React Native code and EAS cloud builds.
- Start with WebRTC media exchange on the two real devices before patient workflows and telephone/SMS integration.
- Defer HIPAA implementation and clinical use; use synthetic data for the experiment.
- Maintain versioned PRD, state, decisions, implementation plans, tooling/access documentation, and test evidence across threads.
- Agent owns routine database schema changes and migration work within authorized task/environment scope.

## Proposed implementation choices

- M1: `react-native-webrtc`, compatible Expo config plugin, minimal TypeScript signaling service, expiring two-person rooms, and authenticated TURN; foreground audio/video.
- Defer persistence until a feature needs it. PostgreSQL is a likely product database, with provider/driver/migration tool to be chosen in a later plan.
- Use Twilio Voice SDK for future service-number telephone calls; select browser/video and transcription integrations when planning those features.

## Consequences and revisit conditions

Custom development builds are required; Expo Go is insufficient for the native WebRTC module. Windows/EC2 can prepare and submit EAS builds, but physical-device acceptance remains necessary. Learning direct WebRTC does not commit the product to owning every media/signaling component. Revisit the M1 approach if compatibility blocks both-device builds, operating the relay is disproportionate, or the owner prioritizes telephone integration over the learning experiment.
