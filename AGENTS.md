# Agent instructions

## Resume at the start of every thread

1. Read this file, [current state](docs/PROJECT_STATE.md), and [tools/access](docs/TOOLS.md).
2. Check `git status --short --branch` and the relevant recent history. Preserve user changes.
3. Read the active plan linked from current state, its referenced PRD requirements, and relevant architecture/decision records. Read [database](docs/DATABASE.md) before schema work and [testing](docs/TESTING.md) before verification.
4. Continue from recorded evidence. Treat old chat context as supplemental. If code and notes disagree, inspect the code and correct the notes.

## Product and scope

- Build native iOS and Android apps using Expo/React Native development builds and EAS cloud builds. The owner works on Windows; the repository is on EC2.
- Immediate objective: a foreground WebRTC audio/video proof of concept on the owner's iPhone and his wife's Android phone. See [PRD](docs/PRD.md) for later features.
- Use fictitious patients and nonclinical test conversations. HIPAA implementation, real-patient use, recording, billing automation, and production operation are outside the first milestone.
- Distinguish recorded activity, measured duration, staff-approved time, and billing eligibility. Never equate a timer with a payable claim.
- The user wants iterative implementation and authorizes agent management of database changes/migrations. Complete routine implementation, tests, documentation, and reversible development migrations within the requested scope without repeated permission requests.
- Access credentials, paid services, device actions, or production/destructive changes may require user involvement. Prepare everything independently possible first, then ask only for what is missing. Honor permissions already granted in the conversation.

## Planning and continuity

- For substantial changes, create the next numbered plan in `docs/plans/` using [the template](docs/plans/TEMPLATE.md). Keep the current plan's steps and evidence updated as work proceeds.
- Small fixes can use a concise work-log entry. Do not create multiple competing active plans for the same work.
- Record consequential technical choices in `docs/decisions/`; distinguish accepted user constraints from proposed stack choices.
- Before stopping, update `docs/PROJECT_STATE.md` with the actual result, exact next action, active plan, checks run, and unresolved dependencies. Append a dated entry to `docs/WORK_LOG.md`.
- Put stable commands and connection instructions in `docs/TOOLS.md`, database changes in `docs/DATABASE.md`, and test outcomes in the active plan or linked test report. Link information instead of duplicating it.
- Mark unavailable tools, unrun tests, and proposed commands explicitly. Never claim a device test, deployment, migration, or cloud build succeeded without evidence.
- Use subagents only when the user or applicable higher-level instructions explicitly request delegation. These artifacts support any future agent; they do not require a multi-agent runtime.

## Implementation conventions

- Prefer TypeScript for the app/backend when scaffolding. Pin compatible Expo, React Native, WebRTC, and config-plugin versions and commit the package-manager lockfile. Verify current upstream compatibility first.
- Keep the first experiment small: one app, a minimal signaling service, and STUN/TURN configuration. A durable database is not required to prove media exchange.
- Keep provider credentials on the backend. Public mobile build variables are visible to users; an `EXPO_PUBLIC_` value is never a secret.
- Use UTC for persisted timestamps and explicit timezones for reporting/month boundaries. Store duration in seconds; avoid rounding each small activity upward.
- Use backend evidence for durable call records. A client timer is a display, not the authoritative billing record. Account for retries, duplicate events, and multiple call legs when those features arrive.
- Do not change infrastructure or databases belonging to other projects on this EC2 host.
- Add meaningful tests for behavior and failure modes. Browser mocks cannot prove native camera, microphone, or call behavior.

## Database ownership

- Follow `docs/DATABASE.md`: version-controlled migrations, isolated dev/test targets, recorded execution, and verification. No undocumented manual DDL or automatic schema synchronization against shared databases.
- Never edit an applied/shared migration to change history. Add a new migration. Rehearse recovery and preserve data before destructive changes.
- Record target aliases and secret locations, never passwords, tokens, database URLs containing credentials, or patient data.

## Git and checks

- Bootstrap documentation may be committed on the empty repository's `main`. Subsequent implementation uses a descriptive feature branch unless the user requests otherwise.
- Keep commits coherent. Never force-push, discard others' changes, or merge/deploy unrelated work.
- Run `python3 scripts/check_project.py` for documentation changes, plus relevant app/backend/migration checks as they become available. Add real commands to `docs/TOOLS.md` when implemented.
- Keep secrets, build/signing files, private test captures, database dumps, and recordings out of Git. This repository was public when initialized.
- Before reporting completion, inspect the diff and status, summarize what changed and what was verified, and identify any remaining physical-device or external-service steps.
