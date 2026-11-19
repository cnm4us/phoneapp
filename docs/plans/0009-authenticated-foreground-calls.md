# 0009 Authenticated directory and foreground patient calls

Status: complete for implementation, automated verification and development rollout; physical handset acceptance pending. Updated: 2026-11-18.

## Outcome and scope

Implement the next bounded stage of [0007](0007-provider-patient-calls-transcripts.md): owner-enrolled synthetic provider/patient accounts, assigned Patient A/B/C directory, patient call options with App Audio/Video only, foreground incoming Answer/Decline, and shared persistent call history. Use one shared native app with server-assigned roles plus the browser companion for testing. Supports PAT-01/04, TEAM-02, COM-10 (foreground portion), REP-03, OPS-01/02. No external identity provider, native push/locked ringing, capture, playback, transcription, SMS or billing is enabled here.

## Current evidence

0008 provides MariaDB dev/test schemas and disabled synthetic accounts. Existing WebRTC rooms/quality/audio routing work independently. Owner said proceed after the database checkpoint. Build this iteration in an isolated worktree so Metro/live calls are unaffected until verified deployment.

## Implementation steps

- [x] Inspect persistence, signaling/media adapters, native/browser UI and active infrastructure.
- [x] Add an additive migration for hashed enrollment/session tokens and durable foreground-call runtime/presence.
- [x] Implement owner-only synthetic enrollment tooling, expiring/revocable sessions, server-assigned roles and authorized directory/history APIs.
- [x] Add transactionally serialized call create/answer/decline/cancel/end/timeout, first-session answer ownership, idempotency and backend-observed duration intervals.
- [x] Bridge authorized call participants to private signaling rooms without share codes; recheck session/relationship on media join.
- [x] Add native/browser enrollment/directory/incoming/history UI while preserving manual POC calling and quality controls.
- [x] Verify clean install/upgrade, API isolation/retry/race/restart/session behavior and real browser media; typecheck/regression/native JS exports.
- [x] Apply tested development migration/grants, deploy project-only services/assets, create private enrollment handoff, update continuity/evidence, commit/push.

## Data and configuration

Append `0003_foreground_accounts.sql`; never rewrite 0001/0002. Add enrollment grants (one use, 24-hour expiry) and opaque session hashes (12-hour expiry, revocable), active call/session ownership, ringing/room deadlines and per-participant media presence. Owner CLI writes enrollment codes only to ignored mode-600 artifacts, never Git/URLs/logs. Accounts obtain a development issuer/subject on redemption; no password/signup/role-picker endpoint. Tokens stay in client memory (reload requires a fresh code) pending a deliberate secure storage/identity integration. Enrollment flow is for synthetic prototype users only.

Connected duration is an estimate from authenticated endpoint media-state reports, timed/aggregated by the server, with heartbeat bounds. Signaling/push/answer is not counted as media. Persist raw events; do not turn duration into approved/billable time. Server restart ends orphaned calls honestly and preserves logs. Polling foreground clients handles incoming/terminal state; background/locked delivery is outside this step.

## Acceptance and verification

| Scenario | Procedure | Expected | Actual |
| --- | --- | --- | --- |
| Schema upgrade/clean install | DB suite | Existing identity/calls preserved; all migrations replay; protected grants | Passed: v2 transcript preserved; dev grant case passes |
| Enrollment/access | API integration suite | One-use/expiry/revocation/role spoof and patient/provider isolation checked | Passed on isolated MariaDB |
| Lifecycle | API integration suite | Idempotent retries, first answer, cancel/decline/missed, restart history, bounded duration | Passed |
| Calling UI/media | Real Chromium synthetic-media scenario | Provider directory → call → patient answer → audio/video → common history, no room code | Passed with two independent Chromium contexts |
| Regression/native code | Typecheck, 50 existing tests, browser suite, both JS exports | Existing controls/POC retained; no native compilation claim | TypeScript, 50 tests, 13 browser cases, both exports pass |
| Deployment | Development migration/status and public check | New UI/API live; private enrollment handoff; no recordings or native builds | Passed: public account and legacy smoke; private code file generated |

## Risks and recovery

Enrollment tokens are credentials; public role selection is never authentication. Prototype tokens are memory-only, so app reload needs another one-use enrollment code. Production identity/secure token storage is a later explicit choice. All clinical call APIs enforce account/relationship permissions; legacy POC rooms remain capability-based and separate. Foreground incoming UI is not native background ringing. Single signaling instance owns transient media rooms; restart fails active calls and retains durable history. Migration is additive; rollback feature routes/UI without dropping history. No destructive development migration or new paid service is needed.

## Handoff

Completed: [report](../testing/2026-11-18-foreground-accounts.md) records local and public checks, migration/grants, deployment and private handoff. Owner must still perform actual iPhone/Android foreground acceptance. Next stage after this: native incoming/background lifecycle and separately consent/media storage/transcription plans. No false recording/playback controls.
