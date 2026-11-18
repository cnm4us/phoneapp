# Architecture decision records

Create a numbered record for consequential choices. Include context, decision/status, consequences, and what would trigger revisiting it. Use proposed, accepted, or superseded explicitly; link a replacement when superseded.

- [0001 Project direction](0001-project-direction.md): established workflow and proposed POC approach.
- [0002 WebRTC implementation](0002-webrtc-implementation.md): selected dependencies, signaling, development hosting, and verification boundaries.

Avoid freezing speculative details. Versions, service setup, and commands belong in the relevant implementation plan and tool inventory.

- [0003 Adaptive call quality](0003-adaptive-quality.md): shared presets, directional ceilings and adaptation.
- [0004 Native audio output](0004-native-audio-output.md): private earpiece and speaker routing.
- [0005 Database foundation](0005-database-foundation.md): local MariaDB, isolated identities and explicit SQL migrations; replaces tentative PostgreSQL for development.

- [0006 Foreground accounts](0006-foreground-accounts.md): synthetic one-time enrollment, authorized role screens, private foreground calls and durable history.

- [0007 Native incoming calls](0007-native-incoming-calls.md): device-bound restoration, native call control, transactional delivery and honest background media observations.
