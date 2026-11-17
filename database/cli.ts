import { connect, loadConfiguration, safeError } from './connection';
import { migrate, status } from './migrate';
import { seed } from './seed';

async function main(): Promise<void> {
  const [command, target = 'dev', ...extra] = process.argv.slice(2);
  if (!['check', 'status', 'migrate', 'seed'].includes(command) || !['dev', 'test'].includes(target) || extra.length) {
    throw new Error('Usage: database/cli.ts check|status|migrate|seed [dev|test]');
  }
  loadConfiguration();
  const connection = await connect(target as 'dev' | 'test', command === 'migrate' ? 'migration' : 'runtime');
  try {
    if (command === 'migrate') console.log({ target, applied: await migrate(connection) });
    else {
      const current = await status(connection);
      if (command === 'status') console.log({ target, ...current });
      else {
        if (current.pending.length) throw new Error('Schema is behind; run migrations before use');
        if (command === 'seed') await seed(connection);
        const [info] = await connection.query('SELECT VERSION() AS version, DATABASE() AS db, @@session.time_zone AS timezone');
        const [counts] = await connection.query('SELECT (SELECT COUNT(*) FROM patients) AS patients, (SELECT COUNT(*) FROM users) AS users');
        console.log({ target, ...info, patients: Number(counts.patients), users: Number(counts.users), schema: 'current' });
      }
    }
  } finally {
    await connection.end();
  }
}

main().catch(error => { console.error(safeError(error)); process.exitCode = 1; });
