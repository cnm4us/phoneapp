import { loadEnvFile } from 'node:process';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import mariadb, { type Connection } from 'mariadb';

export type Target = 'dev' | 'test';
export type Identity = 'runtime' | 'migration';

export function loadConfiguration(): void {
  const file = resolve('.env.database');
  if ((statSync(file).mode & 0o077) !== 0) throw new Error('Database secret file must have mode 600');
  loadEnvFile(file);
}

export async function connect(target: Target, identity: Identity = 'runtime'): Promise<Connection> {
  if (!['dev', 'test'].includes(target)) throw new Error('Unknown database target');
  const user = target === 'test' ? 'phoneapp_test' : identity === 'migration' ? 'phoneapp_migrate' : 'phoneapp_app';
  const key = target === 'test' ? 'PHONEAPP_TEST_PASSWORD' : identity === 'migration' ? 'PHONEAPP_MIGRATION_PASSWORD' : 'PHONEAPP_RUNTIME_PASSWORD';
  const password = process.env[key];
  if (!password) throw new Error(`Missing ${key}; run npm run db:provision`);
  const database = target === 'test' ? 'phoneapp_test' : 'phoneapp';
  const connection = await mariadb.createConnection({
    socketPath: process.env.PHONEAPP_DB_SOCKET || '/run/mysqld/mysqld.sock',
    user, password, database, timezone: '+00:00', dateStrings: true,
    multipleStatements: false, connectTimeout: 5_000,
  });
  try {
    const [actual] = await connection.query('SELECT DATABASE() AS db, CURRENT_USER() AS account');
    if (actual.db !== database || actual.account !== `${user}@localhost`) throw new Error('Unexpected database identity');
    await connection.query("SET SESSION sql_mode = 'STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ZERO_IN_DATE,NO_ZERO_DATE,NO_ENGINE_SUBSTITUTION'");
    return connection;
  } catch (error) {
    await connection.end();
    throw error;
  }
}

// DB errors can contain SQL parameters (including future tokens/transcripts).
// CLI output deliberately excludes driver messages, query text, and stacks.
export function safeError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  return code && /^ER_[A-Z0-9_]+$/.test(code) ? code : error instanceof Error && !code ? error.message : 'Database operation failed';
}
