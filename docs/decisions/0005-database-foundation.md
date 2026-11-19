# 0005 Local MariaDB and explicit SQL migrations

Status: accepted for synthetic development on 2026-11-17. Implements [plan 0008](../plans/0008-database-foundation.md).

## Context and decision

Owner authorizes creating/evolving the Phoneapp schema. The EC2 host already runs MariaDB 10.6.22 with local administrator access. Use this server with isolated `phoneapp` and disposable `phoneapp_test` databases; leave other projects and host configuration alone. This replaces the earlier tentative PostgreSQL suggestion for development, without selecting a future production host.

Pin the official MariaDB Connector/Node.js **3.5.5**, which supports Node 20+; this project uses Node 22. Use parameterized SQL, UTC sessions and strict SQL mode. No ORM is necessary for the initial domain schema. Backend-only code lives in `database/` and is excluded from EAS source archives; native/browser code does not import the connector or credentials.

Use one small explicit SQL migration runner with numbered files, SHA-256 checksums, an advisory lock and `running/applied/failed` ledger states. Statements have explicit `-- migrate:split` boundaries; stored procedures, delimiter parsing and automatic ORM schema synchronization are outside this runner. Migrate through CLI, never automatically at call-service startup. Keep existing migrations immutable; introduce changes through new files. Evaluate an established migration framework again if procedural SQL, multi-instance deployment or a larger backend warrants it.

## Isolation and integrity

`phoneapp_app@localhost` reads the project schema and receives explicit table-level insert/update grants. It cannot run DDL, write migration history, update/delete immutable event/transcript/activity history, or access another database. `phoneapp_migrate@localhost` has schema-local migration privileges; `phoneapp_test@localhost` has privileges only on the disposable test schema. No global grants or GRANT OPTION. Unix socket passwords live in an ignored mode-600 `.env.database`; administrative provisioning uses existing sudo/socket authentication. Normal tooling does not use root.

UUID records separate patients, app accounts and devices. Auth subjects are placeholders for a later identity provider, not a home-grown password login. Seeded accounts are disabled with no authentication subject. Shared contact numbers are indexed for candidate lookup, not globally unique. Composite foreign keys keep participants, consent, transcript attribution and optional call-derived activity in the proper call/patient scope. Raw observed seconds and append-only reviews are separate; no billing allocation or reimbursement logic exists.

Media rows contain private storage references, not audio blobs/public signed URLs. Device token fields reserve encrypted values plus lookup hashes; no token encryption/key service is implemented or token seeded. Consent events retain each participant's decision and call offset; the future capture service must enforce applicable all-party policy before capture. The DB alone does not establish authorization, recording consent or push delivery. Retention is unresolved; null expiry does not authorize real-data capture/indefinite retention.

## Failure and recovery

MariaDB DDL causes implicit commits, so wrapping schema migrations in a transaction cannot promise rollback. Persist a dirty row before execution and refuse any subsequent migration until reviewed recovery. Test verifies actual partial DDL persistence, blocked retries, and disposable-schema reset/replay. There is no development reset, automatic down migration or automatic dirty-row clearing. Preserve data and inspect partial objects before a reviewed repair; destructive/data-bearing changes require a backup/recovery rehearsal.

## References

- [Official connector Promise API](https://mariadb.com/docs/connectors/mariadb-connector-nodejs/connector-nodejs-promise-api), including UTC handling and error SQL/parameter behavior.
- [Official implicit commit reference](https://mariadb.com/docs/server/reference/sql-statements/transactions/sql-statements-that-cause-an-implicit-commit).
- [Official connector package](https://www.npmjs.com/package/mariadb); version/Node engine verified through npm metadata before installation.
