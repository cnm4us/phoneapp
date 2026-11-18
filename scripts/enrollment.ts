import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';
import { connect, loadConfiguration, safeError } from '../database/connection';
import { hash, utc } from '../server/accounts-store';
import { patientUserId, providerId } from '../database/seed';
import { status } from '../database/migrate';

async function main(): Promise<void> {
  const args=process.argv.slice(2);if(args.length>1||args[0]&&!['provider','patient-a'].includes(args[0]))throw new Error('Usage: npm run accounts:enroll [-- provider|patient-a] (development synthetic accounts only)');
  loadConfiguration();
  const db=await connect('dev');
  try {
    if ((await status(db)).pending.length) throw new Error('Apply migrations first.');
    await mkdir('artifacts/private',{ recursive:true,mode:0o700 });
    const path=`artifacts/private/enrollment-${Date.now()}.txt`;
    const file=await open(path,'wx',0o600);
    try {
      const expires=Date.now()+24*60*60_000;
      const lines=[`Synthetic test accounts only. Codes expire ${new Date(expires).toISOString()}.`, 'Each code works once. Browser session lasts 12 hours in memory; native sign-in is stored securely on the phone.', 'Treat this file as a credential; do not commit or publish it.', ''];
      await db.beginTransaction();
      try {
        const subjects=args[0]==='provider'?[['Provider',providerId]]:args[0]==='patient-a'?[['Patient A',patientUserId('A')]]:[['Provider',providerId],...['A','B','C'].map(letter=>[`Patient ${letter}`,patientUserId(letter)])];
        for (const [label,id] of subjects) {
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
