# 0008 Phoneapp database foundation

Status: complete. Updated: 2026-11-17.

## Outcome and scope

Execute the persistence prerequisite of [0007](0007-provider-patient-calls-transcripts.md), supporting PAT-01–04, TEAM-01–02, REP-03, TX-01–06, TIME-05, OPS-01–02. Owner authorizes creating and evolving an isolated Phoneapp schema. Create development/test databases, restricted identities, SQL migrations, synthetic patient directory, and repeatable verification. Prepare call/history/consent/media/transcript/activity structures. Existing foreground calling stays independent; no authentication API, push, recording, transcription worker, storage service, or new native build is activated here.

## Current evidence

Before implementation, local MariaDB 10.6.22 was running and Unix-socket administration via sudo worked; neither `phoneapp` nor `phoneapp_test` existed. Both are now provisioned and verified as recorded below. Other projects share this host and must be untouched. Node 22 supports MariaDB Connector/Node.js 3.5.5 (requires Node 20+). See [decision 0005](../decisions/0005-database-foundation.md).

## Implementation steps

- [x] Inspect scope, existing MariaDB, repository conventions, connector requirements, and implicit DDL commits.
- [x] Create ordered SQL migrations with checksum/dirty-state tracking and a per-database advisory lock.
- [x] Provision only `phoneapp` and `phoneapp_test`, separate development runtime/migration identities and an isolated test identity; keep generated credentials private.
- [x] Apply migrations on test first; verify clean install, upgrade preservation, constraints, event idempotency, migration concurrency/drift/failure handling, and runtime grants.
- [x] Apply development migrations and transactionally seed disabled synthetic users and Patient A/B/C without recordings or push tokens.
- [x] Update PRD, roadmap, database/tools/testing/state/work log; run checks and record evidence.

## Data and configuration

`database/migrations/0001_identity_calls.sql`: users, patients, patient-account/care-team bindings, phone contacts, device registrations, logical calls, participants, and lifecycle events.

`0002_transcripts_activity.sql`: consent events, private recording references, transcription jobs, transcript versions/segments, raw activity observations and append-only reviews. `schema_migrations` tracks execution/checksums. All domain IDs are UUID strings, timestamps UTC, activity durations integer seconds, transcript offsets integer milliseconds. Contacts can share a number. Authentication subjects and device tokens are separate identities. No automatic startup DDL.

Secrets: ignored `.env.database`, mode 600, with socket and dedicated passwords. Example configuration contains names only. SQL statements use explicit `-- migrate:split` boundaries (no general SQL parser). MariaDB DDL is not transactional: a started/failed migration blocks further work until reviewed recovery. Test reset is restricted to the exact disposable `phoneapp_test` database and named test user. Development has no reset command.

## Acceptance and verification

| Scenario | Procedure | Expected | Actual |
| --- | --- | --- | --- |
| Reproducible schema | `npm run test:db` | Clean install; 0001 data preserved by 0002; repeat migrations no-op | Passed |
| Integrity | Same suite | FK, consent scope, shared numbers, durations, duplicate events, version history verified | Passed |
| Migration safety | Same suite | Drift/dirty/future history rejected; concurrent runner excluded; disposable failure recovery rehearsed | Passed, including actual partial DDL persistence |
| Permissions | `npm run test:db:permissions` | Runtime cannot DDL, alter migration ledger, change immutable events, or access system tables | Passed |
| Development readiness | `npm run db:migrate`, `db:grants`, `db:seed`, `db:status`, `db:check` | Latest migrations applied; A/B/C synthetic directory; runtime connection verified | Passed: 3 patients, 4 disabled users, UTC, no pending migrations |
| Regression | `npm run typecheck`, `npm test`, docs/whitespace checks | Existing call code continues passing | TypeScript and 50 tests pass; docs/whitespace pass |

## Risks and recovery

MariaDB DDL implicitly commits. Do not claim rollback for partially applied DDL or blindly retry it. Failed migration retains a dirty ledger row; inspect partial objects, preserve data, and prepare a reviewed recovery. For disposable test only, reset/recreate the schema and replay committed files. Development destructive recovery requires a backup/rehearsal and authorization appropriate to its data. Application access isolation and consent enforcement need future authenticated services; FKs and DB roles do not implement patient authorization by themselves. No retention duration is assumed, and null expiry is not approval for indefinite real-data retention.

## Handoff

Completed this bounded foundation; [verification report](../testing/2026-11-17-database-foundation.md) records exact outcomes and limits. Next implement authenticated provider/patient directory and durable call lifecycle under 0007. Resolve identity provider, enrollment, binary packaging, consent/retention, media capture/storage and transcription choices before their dependent features. Native incoming calls remain a separate device-tested gate.
