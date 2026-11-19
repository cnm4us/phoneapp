import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Connection } from 'mariadb';

export const migrationDirectory = resolve(__dirname, 'migrations');
type Migration = { name: string; checksum: string; statements: string[] };
type Entry = { name: string; checksum: string; state: string };

async function files(directory: string): Promise<Migration[]> {
  const names = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort();
  if (!names.length || names.some((name, index) => !name.startsWith(`${String(index + 1).padStart(4, '0')}_`) || !/^\d{4}_[a-z0-9_]+\.sql$/.test(name))) {
    throw new Error('Migration files must have contiguous numbered names');
  }
  return Promise.all(names.map(async name => {
    const sql = await readFile(`${directory}/${name}`, 'utf8');
    return { name, checksum: createHash('sha256').update(sql).digest('hex'), statements: sql.split(/^-- migrate:split\s*$/m).map(s => s.trim()).filter(Boolean) };
  }));
}

export async function history(connection: Connection): Promise<Entry[]> {
  const [table] = await connection.query("SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schema_migrations'");
  if (Number(table.n) === 0) return [];
  return connection.query('SELECT name, checksum, state FROM schema_migrations ORDER BY name');
}

export async function status(connection: Connection, directory = migrationDirectory): Promise<{ applied: string[]; pending: string[] }> {
  const migrations = await files(directory);
  const entries = await history(connection);
  for (const [index, row] of entries.entries()) {
    const migration = migrations[index];
    if (!migration || row.name !== migration.name || row.checksum !== migration.checksum) throw new Error('Migration history differs from committed files; stop and inspect');
    if (row.state !== 'applied') throw new Error('Unfinished migration; inspect partial DDL and follow documented recovery');
  }
  return { applied: entries.map(row => row.name), pending: migrations.slice(entries.length).map(row => row.name) };
}

export async function migrate(connection: Connection, options: { directory?: string; through?: string } = {}): Promise<string[]> {
  const directory = options.directory || migrationDirectory;
  const migrations = await files(directory);
  if (options.through && !migrations.some(m => m.name === options.through)) throw new Error('Unknown migration target');
  const [{ db }] = await connection.query('SELECT DATABASE() AS db');
  const lock = `phoneapp:migrate:${db}`;
  const [acquired] = await connection.query('SELECT GET_LOCK(?, 0) AS acquired', [lock]);
  if (Number(acquired.acquired) !== 1) throw new Error('Another database migration is running');
  try {
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      state ENUM('running','applied','failed') NOT NULL,
      started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      applied_at DATETIME(3) NULL
    ) ENGINE=InnoDB`);
    const current = await status(connection, directory);
    const applied: string[] = [];
    for (const migration of migrations.slice(current.applied.length)) {
      if (options.through && migration.name > options.through) break;
      await connection.query("INSERT INTO schema_migrations (name,checksum,state) VALUES (?,?,'running')", [migration.name, migration.checksum]);
      try {
        for (const sql of migration.statements) await connection.query(sql);
        await connection.query("UPDATE schema_migrations SET state='applied', applied_at=CURRENT_TIMESTAMP(3) WHERE name=?", [migration.name]);
        applied.push(migration.name);
      } catch (error) {
        await connection.query("UPDATE schema_migrations SET state='failed' WHERE name=?", [migration.name]).catch(() => {});
        throw error;
      }
    }
    return applied;
  } finally {
    await connection.query('SELECT RELEASE_LOCK(?)', [lock]);
  }
}
