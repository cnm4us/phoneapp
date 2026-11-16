# Phoneapp

A native iOS and Android communications app for capturing care-team work and reviewing patient-level time. The first milestone is a WebRTC proof of concept between the owner's iPhone and his wife's Android phone.

**Status:** documentation foundation only. No app, backend, database, or EAS builds exist yet. Development uses synthetic data; HIPAA implementation is a later milestone.

## Start here

- [Product requirements](docs/PRD.md): complete product scope and acceptance criteria.
- [Current project state](docs/PROJECT_STATE.md): what exists and the next action.
- [Roadmap](docs/ROADMAP.md): milestones and dependencies.
- [First implementation plan](docs/plans/0001-webrtc-poc.md): two-device WebRTC experiment.
- [Agent instructions](AGENTS.md): how to resume and maintain this repository.
- [Tools and access](docs/TOOLS.md): verified capabilities, connection setup, and commands.
- [Database workflow](docs/DATABASE.md): ownership and migration policy.
- [Testing strategy](docs/TESTING.md): automated checks and physical-device evidence.
- [Architecture](docs/ARCHITECTURE.md), [decisions](docs/decisions/README.md), and [work log](docs/WORK_LOG.md).

## Check the documentation

From the repository root, with Python 3 installed:

```sh
python3 scripts/check_project.py
```

On Windows, use `py -3 scripts/check_project.py` if `python3` is unavailable. This validates the documentation foundation; it does not test WebRTC or build an app.

## Development environment

The owner uses Windows and VS Code, with this checkout on AWS EC2. EAS will compile custom development builds for the physical iPhone and Android phone. Expo Go cannot load the proposed native WebRTC library. The owner already has Expo/EAS and Apple Developer accounts; project linking and device registration remain to be done.

Repository: <https://github.com/cnm4us/phoneapp>
