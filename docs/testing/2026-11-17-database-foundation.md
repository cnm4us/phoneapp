# Database foundation verification — 2026-11-17

Scope: [plan 0008](../plans/0008-database-foundation.md), local synthetic MariaDB persistence only. Node 22.21.1, MariaDB 10.6.22, official Node connector 3.5.5. Existing server/other application configuration and records untouched.

## Executed evidence

| Check | Actual result |
| --- | --- |
| `npm run db:provision` | Created only `phoneapp` / `phoneapp_test` and three localhost-scoped accounts; private generated `.env.database` mode 600. |
| `npm run test:db` | Eight subscenarios passed; Node reports 9 passing tests including their wrapper. Clean v1 installation with seeded directory/call, v2 upgrade preserves existing rows; rerun is a no-op. |
| Integrity scenarios | Shared E.164 contacts accepted; invalid number/unknown patient, duplicate request/event, wrong-call participant/consent/segment, wrong-owner device, incomplete push token, invalid transcript version/media state and invalid duration rejected. Raw 60 seconds remains unchanged after a separate 45-second review. |
| Migration safety scenarios | Independent connection's advisory lock excludes runner. Changed checksum and future history rejected. Intentional third migration creates a probe then fails; partial DDL remains and dirty history blocks retry. Exact disposable schema reset/replay recovers, removing the probe. |
| `npm run db:migrate` | Development applied `0001_identity_calls.sql` and `0002_transcripts_activity.sql` after test success. 16 domain tables plus ledger. |
| `npm run db:grants` | Explicit runtime table grants, no global/GRANT OPTION privileges; immutable histories insert-only. |
| `npm run db:seed` / `db:status` / `db:check` | Runtime identity reads current schema with no pending migration, UTC `+00:00`, 3 synthetic patients / 4 disabled users. No real identities, tokens or media seeded. |
| `npm run test:db:permissions` | One case passed: DDL/ledger update/immutable-history mutation/system-table SELECT/other project-test DB access denied. Assigned synthetic directory readable; no-op update rolled back. |
| `npm run typecheck` | App/server/browser/browser tests and database TypeScript passed. |
| `npm test` | All 50 existing unit/server/routing tests passed; browser build completed. |

Initial test assertions for cross-call events and segments reused existing deduplication keys, so uniqueness rejected them before FK evaluation. Corrected only the synthetic test inputs to isolate the intended FK checks; full DB suite then passed. Applied migration files were not edited after execution.

## Limits

No authenticated HTTP/API queries or provider/patient screens are implemented. DB grants and foreign keys are not row-level patient authorization or recording-consent enforcement. Test rows for calls/consent/transcripts exercise structure only and are removed during disposable recovery; no audio captured/stored/transcribed. No native build, physical-device acceptance, push delivery, object storage, recording playback, paid provider or clinical/billing behavior is established. Existing calling service remains in-memory and was not restarted.

Disposable reset/replay is a tested recovery for synthetic test data, not a backup restoration of populated development/production. See [database recovery contract](../DATABASE.md). Future data-bearing changes need appropriate backup/forward-repair evidence.
