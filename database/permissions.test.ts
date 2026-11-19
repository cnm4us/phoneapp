import assert from 'node:assert/strict';
import test from 'node:test';
import { connect, loadConfiguration } from './connection';
import { status } from './migrate';
import { patientId, providerId } from './seed';

test('development runtime identity has scoped DML and protected history', async () => {
  loadConfiguration();
  const db = await connect('dev');
  const denied = (error: unknown): boolean => ['ER_TABLEACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR'].includes((error as { code: string }).code);
  try {
    assert.equal((await status(db)).pending.length, 0);
    await assert.rejects(db.query('CREATE TABLE permission_probe (id INT)'), denied);
    await assert.rejects(db.query("UPDATE schema_migrations SET state='failed' WHERE 1=0"), denied);
    for (const table of ['call_events', 'consent_events', 'activity_observations', 'activity_reviews', 'transcript_versions', 'transcript_segments', 'communications']) {
      await assert.rejects(db.query(`UPDATE ${table} SET id=id WHERE 1=0`), denied);
      await assert.rejects(db.query(`DELETE FROM ${table} WHERE 1=0`), denied);
    }
    for(const table of ['enrollment_codes','auth_sessions','call_runtime','call_presence','device_credentials','push_deliveries','audio_messages','message_media_grants']) {
      await db.query(`UPDATE ${table} SET ${table==='call_runtime'||table==='call_presence'?'call_id=call_id':['device_credentials','message_media_grants'].includes(table)?'token_hash=token_hash':'id=id'} WHERE 1=0`);
      await assert.rejects(db.query(`DELETE FROM ${table} WHERE 1=0`),denied);
    }
    await assert.rejects(db.query('SELECT User FROM mysql.user LIMIT 0'), denied);
    await assert.rejects(db.query('USE phoneapp_test'), denied);
    await db.beginTransaction();
    try {
      const rows = await db.query('SELECT p.id FROM patients p JOIN patient_assignments a ON a.patient_id=p.id WHERE a.staff_user_id=? AND a.revoked_at IS NULL', [providerId]);
      assert.equal(rows.length, 3);
      await db.query('UPDATE patients SET display_name=display_name WHERE id=?', [patientId('A')]);
    } finally { await db.rollback(); }
  } finally { await db.end(); }
});
