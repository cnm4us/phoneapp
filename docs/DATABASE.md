# Database and migration workflow

Status: **development/test persistence and foreground account integration implemented, 2026-11-18**. Existing MariaDB 10.6.22 hosts isolated `phoneapp` (development) and `phoneapp_test` (disposable tests). MariaDB Connector/Node.js 3.5.5 and the versioned SQL runner are selected in [decision 0005](decisions/0005-database-foundation.md); [plan 0008](plans/0008-database-foundation.md) executes the persistence prerequisite of [0007](plans/0007-provider-patient-calls-transcripts.md).

Through migration 0005 both targets have 24 domain tables plus `schema_migrations`; the seed defines three synthetic patients and four initially disabled users with patient-account/care-team bindings; redemption activates only the enrolled synthetic users. Base seed creates no calls/tokens/recordings/transcripts/login subjects. The optional account workflow now persists enrollment/session hashes, logical calls/events and observed intervals; media rooms and legacy POC rooms remain transient. Synthetic enrollment/redemption and smoke testing can create synthetic auth subjects/call history. No other application's schema or data was changed; no MariaDB service/configuration change was needed.

## Implemented schema

| Tables | Purpose / boundaries |
| --- | --- |
| `users`, `patients` | App actor and primary role separate from stable patient record. Future external issuer/subject; disabled accounts can be unenrolled. |
| `patient_accounts`, `patient_assignments` | Patient/caregiver bindings and staff care relationships, with revocation. Account APIs enforce current role and relationship access; each future media endpoint must do so as well. |
| `patient_phone_numbers` | Multiple E.164 contacts, owner/relationship/preference/SMS/contact permission; shared numbers allowed. |
| `devices`, `device_credentials`, `push_deliveries` | Native installation ownership, encrypted provider registration, rotating device credentials and transactional call push delivery under 0011. |
| `calls`, `call_participants`, `call_events` | Logical call, retry identity, outcomes, role snapshots, endpoint relationships and immutable events. Observed connection seconds are not approved/billable time. |
| `consent_events` | Per-participant recording/transcription decisions, policy version and offsets. Capture service/all-party policy still to implement. |
| `recording_assets` | Private object references, status/offsets/hash/retention metadata; no audio files, buckets or playback URLs created. |
| `transcription_jobs`, `transcript_versions`, `transcript_segments` | Retry/job metadata, attributed timestamped draft versions and append-only corrections; no worker/STT provider implemented. |
| `enrollment_codes`, `auth_sessions` | One-use synthetic enrollment/session hashes, expiry and revocation; browser credentials remain in memory; native device credentials use Keychain/Keystore under 0011. |
| `call_runtime`, `call_presence` | Caller/answering-session ownership, ringing/setup/call deadlines, media report freshness and aggregate measured milliseconds. |
| `audio_messages`, `message_media_grants` | Call-independent patient messages, durable asset/processing/expiry state and hashed short-lived session/operation-bound transfer grants under 0012. |
| `activity_observations`, `activity_reviews` | Original integer seconds plus separate append-only review decisions; no billing allocation/eligibility calculation. |

Composite foreign keys keep event/consent/media/transcript participants within the same call, and call-derived activity within the proper patient. Default recording is off. DB constraints do not enforce authenticated patient access or call transition ordering by themselves; 0009 now enforces those in transactional account APIs. Staff eligibility, all-party recording consent, native push lifecycle and media retention policy require subsequent services/tests. Retention duration, storage vendor and production identity provider remain open. Null retention expiry is not an approved real-data retention policy. Deletion defaults to restricted foreign keys, revocation and explicit status; no blanket cascade deletion.

## Commands and secrets

See [tools](TOOLS.md) for exact commands. Secrets live only in ignored `.env.database` (600), with a tracked names-only [.env.database.example](../.env.database.example). The socket is `/run/mysqld/mysqld.sock`; database/identity names are fixed by code rather than an arbitrary connection URL. Use runtime credentials for application work, migration credentials for DDL. `db:provision` creates only the two project databases/local identities; `db:grants` gives explicit runtime writes after reviewed tables exist. Neither rotates existing passwords.

`phoneapp_app` has project SELECT and reviewed table INSERT/UPDATE grants; immutable histories receive INSERT only, with no DELETE, DDL or migration-ledger writes. `phoneapp_migrate` can migrate only development; `phoneapp_test` can operate only the disposable test schema. No global privileges or GRANT OPTION. Provisioning needs local sudo/socket administration; normal migration/check/seed tools use the dedicated accounts.

## Ownership and access

The user authorizes the agent to design and manage database changes and migrations as part of requested work. Routine reversible migrations in an identified development/test environment do not need repeated permission. A new thread should first read [current state](PROJECT_STATE.md), [tools/access](TOOLS.md), and the active plan.

Use dedicated project dev/test environments. Never reuse another application's database or assume an endpoint is disposable. Verify the environment before any write. Production/destructive operations need explicit authorization covering the action; existing authorization should be honored without asking twice.

Keep connection values in ignored environment configuration or a designated secret store. Record only environment aliases, credential locations, and verified connection status in `TOOLS.md`. Prefer least-privilege runtime credentials with separate migration credentials when appropriate.

## Established persistence contract

The foundation implements the following contract; preserve it for future environments:

1. Select the engine/provider, driver/ORM if any, and one migration system; record the tradeoffs in a decision record.
2. Add a reproducible local/dev/test bootstrap, committed migration files, and a synthetic seed/reset procedure scoped to an explicitly disposable target.
3. Define required secret names in an example configuration without credentials.
4. Provide actual connectivity, schema-status, migrate, seed, and test commands in `TOOLS.md`.
5. Run a clean database install and record evidence. Do not call the DB ready based only on a proposed schema.

## Every schema change

1. Describe purpose, affected tables/data, compatibility, expected lock/runtime behavior, and recovery in the feature plan.
2. Inspect current schema and migration history for the named target.
3. Add an ordered, uniquely identified migration in the selected tool's migration directory. Keep migrations in Git; never silently mutate schema at app startup or use schema-sync shortcuts against shared DBs.
4. Run on a disposable/test target first. Check constraints, indexes, foreign keys, affected data, and application queries. Test clean installation and an upgrade from the previously supported schema.
5. For potentially destructive changes, take/rehearse a backup or use an expand/backfill/contract sequence. Use transactions when supported and appropriate; document exceptions.
6. Apply to the intended development target, inspect migration status, and record environment alias, migration IDs, outcome, and recovery evidence.
7. Update the schema summary and plan/state. Application startup/deployment should report mismatches clearly.

Never rewrite a migration already applied to a shared environment. Add a forward correction. A down migration is useful only if it preserves/recoverably restores required data; a tested forward repair or backup restoration may be the correct recovery.

## Data conventions to preserve

- Stable internal patient IDs; names/phone numbers are not primary identity.
- Phone numbers normalized with country code while retaining contact ownership/relationship. Shared numbers must not be globally unique to one patient.
- UTC event timestamps, integer-second durations, explicit practice reporting timezone.
- Historical actor/role, observed values, reviewed corrections, and review history.
- Unique provider event/message identifiers for idempotency; logical encounters distinct from individual call legs.
- Referential integrity and explicit retention/deletion behavior when recording/transcription is added.

## Execution and recovery

The runner in [database/migrate.ts](../database/migrate.ts) checks contiguous numbered files and SHA-256 history, obtains a per-target advisory lock, records running/applied/failed state, and refuses drift, future history, gaps, or unfinished migrations. SQL files use explicit `-- migrate:split` lines; one statement per block, no stored-program delimiter syntax. Status is read-only. Check pending migrations before feature use; application startup has no automatic DDL. Account APIs require a current schema when enabled; existing manual POC rooms remain independent. No automatic startup DDL.

MariaDB DDL implicitly commits. A failed/running ledger row means partial objects may exist; do not clear it or retry blindly. Stop writes to the affected feature, inspect committed statements and preserve data. Prepare/rehearse an explicit repair or restore before reconciling the ledger against the committed schema. There is no generic development reset/down/repair command. Future destructive/data-bearing changes need backup/recovery evidence before application.

`npm run test:db` is explicitly destructive **only** to `phoneapp_test`: it verifies both exact database and authenticated test identity, holds a suite lock, drops only schema-qualified test tables, replays migrations, and leaves a clean synthetic directory. This is the rehearsed disposable recovery, not a backup restoration test for populated development/production. Do not use the test database for anything valuable. Runtime permission checks use development reads/denied statements and a rolled-back no-op update.

## Migration ledger

| Date | Environment alias | Migration IDs | Outcome | Evidence / recovery |
| --- | --- | --- | --- | --- |
| 2026-11-17 | Test: `phoneapp_test` | `0001_identity_calls.sql`, `0002_transcripts_activity.sql` | Applied; clean install and upgrade preservation passed | [Database report](testing/2026-11-17-database-foundation.md); partial-DDL failure blocked and disposable reset/replay verified. |
| 2026-11-17 | Development: `phoneapp` | Same two migrations | Applied after test success; no pending migrations; A/B/C seeded | Runtime connectivity/UTC/permission suite passed; no existing development data required recovery. |

| 2026-11-18 | Test and development | `0003_foreground_accounts.sql` | Applied after clean/upgrade and access/lifecycle/browser-media checks | [Foreground report](testing/2026-11-18-foreground-accounts.md); additive tables preserve previous schema/data; runtime grants verified. |

Use `npm run db:status` (or `npm run db:status -- test`) to validate applied checksums/states and list pending migrations. Never edit an applied migration; append the next numbered SQL file and update the plan/ledger.

## Account workflow and recovery

[Decision 0006](decisions/0006-foreground-accounts.md) defines synthetic enrollment and foreground calls. `ENABLE_ACCOUNT_CALLS=true` enables runtime integration after explicit migrations/grants. `accounts:enroll` issues only the fixed synthetic accounts' one-time credentials to a new ignored mode-600 file; it does not enable an account until redemption. Runtime account tables permit INSERT/UPDATE but no DELETE. Public APIs derive roles server-side, enforce current relationships/participants and session ownership, and do not create media/storage/transcription jobs.

Logical calls survive service restarts; transient WebRTC rooms do not. On shutdown/startup, unfinished account calls are retained as Failed, with bounded observed intervals. Foreground ring timeout is 60 seconds, setup timeout 45 seconds, maximum four-hour call; API cleanup runs every five seconds. No down migration is required to disable the feature: set its flag false and restart the project service while preserving all tables/history. Future data-bearing/destructive schema changes still require backup/recovery evidence.

## Native incoming-call schema work

[0011](plans/0011-native-background-incoming-calls.md) now implements the device/session and delivery expansion in immutable migration 0004 below; current applied history is 0001–0004. Keep the original browser/session ownership path and append a new numbered migration for further changes.

## Native calls migration 0004

`0004_native_devices_push.sql` is applied to isolated test and development targets. Adds device environment metadata, nullable session/winning-device bindings, refresh credential rotation/retry ciphertext and transactional push delivery records. Existing browser/session columns and all previous migrations remain unchanged. Runtime receives only scoped SELECT/INSERT/UPDATE on the two new mutable tables, no DELETE or DDL; permission suite passes. Clean install and v2→v3→v4 upgrade preserve existing transcripts/calls; dirty-DDL recovery test now uses the next synthetic migration number.

Before development application, a private `phoneapp-before-0004.sql` single-transaction snapshot was retained under the isolated worktree's `artifacts/private/native-calls/` (600). Migration and grants applied successfully; ledger current. No destructive backfill/down migration. Disable native calling via feature flag without dropping history. Restore is a separately planned operator action; never reset development from the test harness.

Refresh credentials have a fixed 90-day enrollment deadline, rotating one-hour access sessions (browser remains 12 hours). Same request UUID permits a 60-second encrypted response retry; other reuse of a spent token revokes device sessions and push binding. Device revocation does not rely on a client-supplied installation ID. Duration still requires actual media observations; a native system answer or transport keepalive is not connected/billable seconds.

| 2026-11-18 | Test and development | `0004_native_devices_push.sql` | Applied; clean/upgrade/recovery and runtime grants/permissions pass | [Native evidence](testing/2026-11-18-native-background-calls.md); additive migration, private scoped pre-migration snapshot retained. |

## Audio-message expansion 0005

[0012](plans/0012-audio-messages-shared-history.md) implements `0005_audio_messages.sql` in test/development after clean/v4-upgrade/recovery checks and a private development snapshot. Adds `audio_messages` and `message_media_grants` with runtime SELECT/INSERT/UPDATE only; no DELETE/DDL. Existing call/recording/transcription constraints remain intact. Upgrade fixtures preserve calls, transcripts and native credential rows. Message assets/processing leases are stored on the message row; bytes live in the private filesystem. Authorization is checked at each history/send/grant/upload/play operation. Published messages use current patient relationships; calls retain participant access. Short-lived grants are hashed, session/message/operation-bound, expire after 2 minutes and are one-use for upload.

Message expiry preserves metadata and removes bytes with retries/orphan cleanup; published history does not disappear when app enrollment changes. Time-observation/review tables receive no message-duration credit. Scoped metadata/media restore was rehearsed on an isolated synthetic fixture; no development restore was performed. Retention and backup configuration are in [tools](TOOLS.md) and [ADR 0008](decisions/0008-audio-messages.md).

| Date | Environment alias | Migration | Outcome | Evidence |
| --- | --- | --- | --- | --- |
| 2026-11-18 | Test and development | `0005_audio_messages.sql` | Applied, scoped grants and permissions pass | [Audio-message report](testing/2026-11-18-audio-messages.md); private pre-migration snapshot under ignored audio-messages artifacts. |

## Browser session persistence (0013; no schema migration)

[0013](plans/0013-persistent-browser-sign-in.md) reuses hashed `auth_sessions` tokens and existing expiry/revocation columns for fixed 30-day browser-cookie sessions. Restoration does not extend the deadline; authenticated same-origin legacy adoption extends the existing browser row once without changing its ID or native-device binding. Generic bearer enrollment remains 12h and native device credentials retain their 0011 lifecycle. Logout revokes only the current browser session. No migration file, table, grant or encryption key change; migration ledger remains 0001–0005. No raw cookie/code is persisted in DB.

## Planned video-message expansion (0014)

[Plan 0014](plans/0014-video-messages.md) proposes the next unused additive migration, expected 0006. Expand `audio_messages` with a default-audio media kind, verified output metadata and nullable video/poster fields; preserve legacy table names, all existing IDs/FKs and audio history. Add a scoped thumbnail grant operation and test old/new API contracts. No migration file, DDL, grants or data changes were made for this planning request; the implemented ledger remains 0001–0005. Recheck the ledger, rehearse 0005 upgrade/data preservation and combined metadata/files restore in the disposable target before development application. Details/limits remain proposed in the plan.
