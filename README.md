# Phoneapp

A native iOS and Android communications app for capturing care-team work and reviewing patient-level time. The first milestone is a WebRTC proof of concept between the owner's iPhone and his wife's Android phone.

**Status:** native apps, browser companion, and signaling are available; physical call acceptance pending. Open [the browser companion](https://phoneapp.bawebtech.com) to join the native app from Windows or an iPad browser. Public signaling/relay checks and browser media tests pass. iOS and Android native builds succeeded. Development uses synthetic data; HIPAA implementation is a later milestone.

## Start here

- [Product requirements](docs/PRD.md): complete product scope and acceptance criteria.
- [Current project state](docs/PROJECT_STATE.md): what exists and the next action.
- [Roadmap](docs/ROADMAP.md): milestones and dependencies.
- [First implementation plan](docs/plans/0001-webrtc-poc.md): two-device WebRTC experiment.
- [Browser companion plan](docs/plans/0002-browser-companion.md): browser UI, synthetic media tests, and deployment evidence.
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

The owner uses Windows and VS Code, with this checkout on AWS EC2. EAS project `@mbcollins2/phoneapp` is linked. Expo SDK 57, React Native 0.86.3, and native WebRTC 155 are pinned in the lockfile. Expo Go cannot load this app; use a custom development build or bundled internal preview. Both native development builds are available; full physical-device acceptance remains outstanding.

```sh
npm ci
npm run typecheck
npm test
npm run test:browser
npm run doctor
npm run bundle:check
```

For local service configuration, `npm run init:local` creates private `.env.server` only if absent. See the setup guide before starting services: this host already runs `phoneapp-signaling` and `phoneapp-turn`; do not start another server on their port. The POC has no persistent patient database.

Run `npm run build:web` before starting/restarting signaling on a fresh checkout. For browser tests, install Chromium once with `npx playwright install chromium`; forced-relay testing needs configured/reachable TURN. `npm run test:browser:live` checks the deployed site using the private creator key and synthetic media; it does not operate physical devices.

Repository: <https://github.com/cnm4us/phoneapp>

## Provider and patient foreground testing

The shared native app and browser now include synthetic enrollment, an assigned patient directory, foreground App Audio/Video and durable shared call history. See [account testing commands](docs/TOOLS.md) and [plan 0009](docs/plans/0009-authenticated-foreground-calls.md). Run `npm run accounts:enroll` for private one-time codes. Original foreground builds need both clients open; native preview lifecycle testing follows plan 0011. Native locked/background calling is implemented under [0011](docs/plans/0011-native-background-incoming-calls.md), with updated preview builds/signing and physical acceptance tracked separately. Recording/transcription remain future stages.
