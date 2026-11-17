# Database and migration workflow

Status: no database, schema, application DB account, migration runner, or DB connection configuration exists for Phoneapp. Existing EC2 MariaDB 10.6.22 is active on loopback port 3306; local Unix-socket administrator access was verified read-only on 2026-11-17 via sudo. No Phoneapp-named schema was found. PostgreSQL was previously proposed; the existing MariaDB is another available option. Project engine/provider/driver/migration choices remain open. M1 still uses temporary in-memory signaling state.

Inspection used only server version/current administrative identity and a count of schema names containing phoneapp; no other application tables or records were read or changed. This administrator connection is for scoped provisioning/migrations, not the future runtime identity. Establish a dedicated Phoneapp dev/test database and least-privilege application/migration accounts before implementation. Audio playback is now requested; private file/object storage should hold recordings while the DB stores authorized call metadata, transcript text/segments, and media references. Storage/retention choices remain open.

## Ownership and access

The user authorizes the agent to design and manage database changes and migrations as part of requested work. Routine reversible migrations in an identified development/test environment do not need repeated permission. A new thread should first read [current state](PROJECT_STATE.md), [tools/access](TOOLS.md), and the active plan.

Use dedicated project dev/test environments. Never reuse another application's database or assume an endpoint is disposable. Verify the environment before any write. Production/destructive operations need explicit authorization covering the action; existing authorization should be honored without asking twice.

Keep connection values in ignored environment configuration or a designated secret store. Record only environment aliases, credential locations, and verified connection status in `TOOLS.md`. Prefer least-privilege runtime credentials with separate migration credentials when appropriate.

## Establishing persistence

The first plan requiring a DB must:

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

## Migration ledger

No migrations have been created or applied. When persistence begins, record entries below or link to generated migration history without copying sensitive endpoints.

| Date | Environment alias | Migration IDs | Outcome | Evidence / recovery |
| --- | --- | --- | --- | --- |
| 2026-11-16 | None | None | Documentation only | M1 does not require persistence. |
