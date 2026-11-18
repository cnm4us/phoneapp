import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';
import { connect, loadConfiguration, safeError } from '../database/connection';
import { hash, utc } from '../server/accounts-store';
import { patientUserId, providerId } from '../database/seed';
import { status } from '../database/migrate';

async function main(): Promise<void> {
  if (process.argv.length !== 2) throw new Error('Usage: npm run accounts:enroll (development synthetic accounts only)');
  loadConfiguration();
  const db=await connect('dev');
  try {
    if ((await status(db)).pending.length) throw new Error('Apply migrations first.');
    await mkdir('artifacts/private',{ recursive:true,mode:0o700 });
    const path=`artifacts/private/enrollment-${Date.now()}.txt`;
    const file=await open(path,'wx',0o600);
    try {
      const expires=Date.now()+24*60*60_000;
      const lines=[`Synthetic test accounts only. Codes expire ${new Date(expires).toISOString()}.`, 'Each code works once. Session lasts 12 hours in app/browser memory.', 'Treat this file as a credential; do not commit or publish it.', ''];
      await db.beginTransaction();
      try {
        for (const [label,id] of [['Provider',providerId],...['A','B','C'].map(letter=>[`Patient ${letter}`,patientUserId(letter)])]) {
          const [user]=await db.query('SELECT auth_issuer FROM users WHERE id=? FOR UPDATE',[id]);
          if (!user || user.auth_issuer && user.auth_issuer !== 'phoneapp:synthetic-enrollment') throw new Error('Expected synthetic test account only.');
          const code=randomBytes(32).toString('base64url');
          await db.query('INSERT INTO enrollment_codes (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)',[randomUUID(),id,hash(code),utc(expires)]);
          lines.push(`${label}: ${code}`);
        }
        await file.writeFile(lines.join('\n')+'\n');
        await db.commit();
      } catch(error) { await db.rollback(); throw error; }
      console.log(`One-use codes saved to ${path} (600). Open it privately in VS Code.`);
    } finally { await file.close(); }
  } finally { await db.end(); }
}
main().catch(error=>{ console.error(safeError(error)); process.exitCode=1; });
