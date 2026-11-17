# Phoneapp

A native iOS and Android communications app for capturing care-team work and reviewing patient-level time. The first milestone is a WebRTC proof of concept between the owner's iPhone and his wife's Android phone.

**Status:** native app and signaling implementation available; physical-phone acceptance pending. HTTPS/WebSocket signaling is running at `https://phoneapp.bawebtech.com`; authenticated public TURN UDP/TCP/TLS probes pass. The Android native build succeeded; iPhone signing/build setup is in progress. Development uses synthetic data; HIPAA implementation is a later milestone.

## Start here

- [Product requirements](docs/PRD.md): complete product scope and acceptance criteria.
- [Current project state](docs/PROJECT_STATE.md): what exists and the next action.
- [Roadmap](docs/ROADMAP.md): milestones and dependencies.
- [First implementation plan](docs/plans/0001-webrtc-poc.md): two-device WebRTC experiment.
- [Agent instructions](AGENTS.md): how to resume and maintain this repository.
- [Tools and access](docs/TOOLS.md): verified capabilities, connection setup, and commands.
- [Database workflow](docs/DATABASE.md): ownership and migration policy.
- [Testing strategy](docs/TESTING.md): automated checks and physical-device evidence.
- [POC setup and operation](docs/SETUP.md): services, builds, test-key location, and two-phone instructions.
- [Architecture](docs/ARCHITECTURE.md), [decisions](docs/decisions/README.md), and [work log](docs/WORK_LOG.md).

## Check the documentation

From the repository root, with Python 3 installed:

```sh
python3 scripts/check_project.py
```

On Windows, use `py -3 scripts/check_project.py` if `python3` is unavailable. This validates the documentation foundation; it does not test WebRTC or build an app.

## Development environment

The owner uses Windows and VS Code, with this checkout on AWS EC2. EAS project `@mbcollins2/phoneapp` is linked. Expo SDK 57, React Native 0.86.3, and native WebRTC 155 are pinned in the lockfile. Expo Go cannot load this app; use a custom development build. iPhone provisioning and physical-device testing remain outstanding.

```sh
npm ci
npm run typecheck
npm test
npm run doctor
npm run bundle:check
```

For local service configuration, `npm run init:local` creates private `.env.server` only if absent. See the setup guide before starting services: this host already runs `phoneapp-signaling` and `phoneapp-turn`; do not start another server on their port. The POC has no persistent patient database.

Repository: <https://github.com/cnm4us/phoneapp>
