# Current project state

Updated: 2026-11-16. Completed milestone: **M0 foundation**. Next milestone: **M1 WebRTC proof of concept**, ready to start.

## Implemented

- Repository documentation, requirements, agent instructions, roadmap, architecture proposal, and decision record.
- Database/migration policy and tools/access inventory.
- Testing strategy, device-test report template, documentation checker, and a ready-to-enable GitHub Actions template.

No application scaffold, signaling service, database, migration runner, media provider, app test suite, or EAS build has been created. Automated GitHub Actions checks are not enabled: available GitHub credentials cannot write workflow files. The template can be enabled later; this does not block app implementation or local testing.

## Active plan and next action

Active plan: [0001 WebRTC proof of concept](plans/0001-webrtc-poc.md), **ready for implementation; not started**.

Next action: inspect current upstream Expo/WebRTC compatibility, scaffold the native TypeScript project and minimal signaling service on a feature branch, then add focused signaling tests. The current request delivers the planning foundation; app implementation follows in the next work item.

## Decisions and constraints

- One native iOS/Android codebase; EAS cloud builds; Windows/VS Code with an EC2 checkout.
- Physical test devices: owner's iPhone and wife's Android. Models/OS versions and device access are not yet recorded.
- First experiment: foreground two-person WebRTC audio/video using synthetic data, with separate-network and forced TURN tests.
- HIPAA implementation is deferred. No recording/transcription or real patient work in M1.
- Agent manages future database changes via migrations. PostgreSQL is proposed for persistent product data; no DB/provider/ORM is selected or provisioned.
- [Decision 0001](decisions/0001-project-direction.md) separates established direction from provisional implementation choices.

## External setup still needed for M1

- Verify EAS CLI/account session; link a project, choose app identifiers, register/provision the iPhone, and create both device builds.
- Set up a public secure signaling endpoint and authenticated TURN. No domain, TURN provider, or credentials have been supplied.
- Owners install builds and perform physical-device tests. This EC2 session cannot currently control either phone.

These do not prevent scaffolding, automated signaling checks, and preparing configuration/runbooks.

## Verification

- Server inspection: 2 vCPUs, 7.6 GiB RAM, approximately 38 GB free disk at project initialization.
- Git, GitHub CLI authentication, Node 22.21.1, npm 10.9.4, and Python 3 were observed. Docker and `psql` were not found on PATH. Recheck capabilities before depending on them.
- Documentation check: passed locally (17 required artifacts, 16 Markdown files, 34 unique PRD requirements). See [work log](WORK_LOG.md).
- Native builds and physical-device tests: **not run**.

## Resume prompt

“Read AGENTS.md, docs/PROJECT_STATE.md, docs/TOOLS.md, and the active plan. Continue implementing the WebRTC proof of concept. Preserve the documented milestone boundaries and update the handoff artifacts with verified results.”
