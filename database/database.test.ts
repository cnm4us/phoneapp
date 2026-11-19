import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { Connection } from 'mariadb';
import { connect, loadConfiguration } from './connection';
import { history, migrate, migrationDirectory, status } from './migrate';
import { patientId, patientUserId, providerId, seed } from './seed';

// Destructive operations have no configurable database identifier or dev path.
async function resetDisposable(connection: Connection): Promise<void> {
  const [actual] = await connection.query('SELECT DATABASE() AS db, CURRENT_USER() AS account');
  assert.equal(actual.db, 'phoneapp_test');
  assert.equal(actual.account, 'phoneapp_test@localhost');
  const tables = await connection.query("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA='phoneapp_test' AND TABLE_TYPE='BASE TABLE'");
  await connection.query('SET FOREIGN_KEY_CHECKS=0');
  try {
    for (const { name } of tables) await connection.query(`DROP TABLE \`phoneapp_test\`.${connection.escapeId(name)}`);
  } finally {
    await connection.query('SET FOREIGN_KEY_CHECKS=1');
  }
}

function rejected(code: string): (error: unknown) => boolean {
  return error => (error as { code?: string }).code === code;
}

async function addCall(connection: Connection, letter = 'A'): Promise<{ call: string; staff: string; patient: string }> {
  const call = randomUUID();
  const staff = randomUUID();
  const patient = randomUUID();
  await connection.query('INSERT INTO calls (id,patient_id,initiated_by_user_id,client_request_key) VALUES (?,?,?,?)', [call, patientId(letter), providerId, call]);
  await connection.query("INSERT INTO call_participants (id,call_id,user_id,role_snapshot,label_snapshot) VALUES (?,?,?,'practitioner','Synthetic Provider'), (?,?,?,'patient','Synthetic Patient')", [staff, call, providerId, patient, call, patientUserId(letter)]);
  return { call, staff, patient };
}

test('isolated MariaDB schema, migrations, and domain integrity', async t => {
  loadConfiguration();
  const db = await connect('test', 'migration');
  const [locked] = await db.query("SELECT GET_LOCK('phoneapp:test-suite',0) AS acquired");
  if(Number(locked.acquired)!==1){await db.end();assert.fail('Another DB test is active');}
  try {
    await t.test('clean install and v1/v2/v3 upgrades preserve directory, calls and transcripts', async () => {
      await resetDisposable(db);
      assert.deepEqual(await migrate(db, { through: '0001_identity_calls.sql' }), ['0001_identity_calls.sql']);
      await seed(db);
      const { call } = await addCall(db);
      assert.deepEqual(await migrate(db,{through:'0002_transcripts_activity.sql'}), ['0002_transcripts_activity.sql']);
      const transcript=randomUUID();
      await db.query('INSERT INTO transcript_versions (id,call_id,version_number) VALUES (?,?,1)',[transcript,call]);
      assert.deepEqual(await migrate(db,{through:'0004_native_devices_push.sql'}), ['0003_foreground_accounts.sql','0004_native_devices_push.sql']);
      const installation=randomUUID(),proof='a'.repeat(64);
      await db.query("INSERT INTO devices(id,user_id,installation_id,platform,app_identifier) VALUES(?,?,?,'ios','synthetic-upgrade')",[installation,providerId,randomUUID()]);
      await db.query('INSERT INTO device_credentials(token_hash,device_id,expires_at) VALUES(?,?,?)',[proof,installation,'2099-01-01']);
      assert.deepEqual(await migrate(db,{through:'0005_audio_messages.sql'}), ['0005_audio_messages.sql']);
      const legacy=randomUUID(),asset=randomUUID()+'.m4a';await db.query("INSERT INTO audio_messages(id,patient_id,sender_id,recipient_staff_id,sender_label,sender_role,request_key,state,output_key,duration_ms,created_at,published_at,expires_at) VALUES(?,?,?,?,'Synthetic Provider','practitioner',?,'available',?,1000,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),'2099-01-01')",[legacy,patientId('A'),providerId,providerId,randomUUID(),asset]);
      assert.deepEqual(await migrate(db), ['0006_video_messages.sql','0007_communication_registry.sql']);const [legacyMessage]=await db.query('SELECT id,media_kind,output_key,duration_ms FROM audio_messages WHERE id=?',[legacy]);assert.equal(legacyMessage.id,legacy);assert.equal(legacyMessage.media_kind,'audio');assert.equal(legacyMessage.output_key,asset);assert.equal(legacyMessage.duration_ms,1000);const [wrapper]=await db.query('SELECT id,patient_id FROM communications WHERE media_message_id=?',[legacy]);assert.equal(wrapper.patient_id,patientId('A'));
      const [credential]=await db.query('SELECT token_hash FROM device_credentials WHERE device_id=?',[installation]);assert.equal(credential.token_hash,proof);
      const [preserved]=await db.query('SELECT id FROM transcript_versions WHERE id=?',[transcript]);
      assert.equal(preserved.id,transcript);
      const [row] = await db.query('SELECT id FROM calls WHERE id=?', [call]);
      assert.equal(row.id, call);
      const [count] = await db.query('SELECT COUNT(*) AS n FROM patients');
      assert.equal(Number(count.n), 3);
      assert.deepEqual(await migrate(db), []);
      await seed(db);
      const [users] = await db.query('SELECT COUNT(*) AS n FROM users');
      assert.equal(Number(users.n), 4);
      const [settings] = await db.query('SELECT @@session.time_zone AS tz');
      assert.equal(settings.tz, '+00:00');
    });

    await t.test('shared phone numbers are valid; malformed contacts and unknown patient are rejected', async () => {
      for (const letter of ['A', 'B']) await db.query("INSERT INTO patient_phone_numbers (id,patient_id,phone_e164,relationship) VALUES (?,?,'+12025550100','synthetic shared caregiver')", [randomUUID(), patientId(letter)]);
      await assert.rejects(db.query("INSERT INTO patient_phone_numbers (id,patient_id,phone_e164,relationship) VALUES (?,?,'invalid','self')", [randomUUID(), patientId('A')]), rejected('ER_CONSTRAINT_FAILED'));
      await assert.rejects(db.query("INSERT INTO patient_accounts (patient_id,user_id,relationship) VALUES (?,?,'self')", [randomUUID(), patientUserId('A')]), rejected('ER_NO_REFERENCED_ROW_2'));
      await assert.rejects(db.query("UPDATE users SET status='active' WHERE id=?", [patientUserId('A')]), rejected('ER_CONSTRAINT_FAILED'));
    });

    await t.test('retry IDs deduplicate calls/events; event participants cannot cross calls', async () => {
      const a = await addCall(db);
      const b = await addCall(db, 'B');
      await assert.rejects(db.query('INSERT INTO calls (id,patient_id,initiated_by_user_id,client_request_key) VALUES (?,?,?,?)', [randomUUID(), patientId('A'), providerId, a.call]), rejected('ER_DUP_ENTRY'));
      const sql = "INSERT INTO call_events (id,call_id,participant_id,source,source_event_key,event_type,occurred_at) VALUES (?,?,?,'synthetic','event-1','connected',UTC_TIMESTAMP(3))";
      await db.query(sql, [randomUUID(), a.call, a.staff]);
      await assert.rejects(db.query(sql, [randomUUID(), a.call, a.staff]), rejected('ER_DUP_ENTRY'));
      await assert.rejects(db.query(sql.replace("'event-1'", "'cross-event'"), [randomUUID(), a.call, b.patient]), rejected('ER_NO_REFERENCED_ROW_2'));
      const consent = "INSERT INTO consent_events (id,call_id,participant_id,purpose,decision,policy_version,source_event_key,call_offset_ms,occurred_at) VALUES (?,?,?,'recording','granted','synthetic-v1','consent-1',0,UTC_TIMESTAMP(3))";
      await db.query(consent, [randomUUID(), a.call, a.staff]);
      await assert.rejects(db.query(consent, [randomUUID(), a.call, b.patient]), rejected('ER_NO_REFERENCED_ROW_2'));
      const [defaults] = await db.query('SELECT recording_requested,transcription_status FROM calls WHERE id=?', [a.call]);
      assert.equal(defaults.recording_requested, 0);
      assert.equal(defaults.transcription_status, 'off');
    });

    await t.test('device belongs to participant account and revoked tokens remain distinguishable', async () => {
      const a = await addCall(db);
      const device = randomUUID();
      await db.query("INSERT INTO devices (id,user_id,installation_id,platform,app_identifier) VALUES (?,?,?,'ios','synthetic.app')", [device, patientUserId('A'), randomUUID()]);
      await assert.rejects(db.query('UPDATE call_participants SET device_id=? WHERE id=?', [device, a.staff]), rejected('ER_NO_REFERENCED_ROW_2'));
      await db.query('UPDATE call_participants SET device_id=? WHERE id=?', [device, a.patient]);
      await assert.rejects(db.query("UPDATE devices SET push_token_hash=REPEAT('a',64) WHERE id=?", [device]), rejected('ER_CONSTRAINT_FAILED'));
      await db.query('UPDATE devices SET revoked_at=UTC_TIMESTAMP(3) WHERE id=?', [device]);
    });

    await t.test('transcript versions and endpoint attribution preserve call scope', async () => {
      const a = await addCall(db);
      const b = await addCall(db, 'B');
      const v1 = randomUUID();
      const v2 = randomUUID();
      await db.query('INSERT INTO transcript_versions (id,call_id,version_number) VALUES (?,?,1)', [v1, a.call]);
      await db.query("INSERT INTO transcript_versions (id,call_id,version_number,supersedes_id,created_by_user_id,change_reason) VALUES (?,?,2,?,?,'Synthetic correction')", [v2, a.call, v1, providerId]);
      const segment = "INSERT INTO transcript_segments (id,call_id,transcript_version_id,participant_id,sequence_number,start_offset_ms,end_offset_ms,speaker_label,text) VALUES (?,?,?,?,0,0,1000,'Synthetic Patient','Test words only')";
      await db.query(segment, [randomUUID(), a.call, v1, a.patient]);
      await assert.rejects(db.query(segment.replace(',0,0,1000', ',1,0,1000'), [randomUUID(), b.call, v1, b.patient]), rejected('ER_NO_REFERENCED_ROW_2'));
      await assert.rejects(db.query('INSERT INTO transcript_versions (id,call_id,version_number) VALUES (?,?,1)', [randomUUID(), a.call]), rejected('ER_DUP_ENTRY'));
      await assert.rejects(db.query("INSERT INTO recording_assets (id,call_id,status) VALUES (?,?,'ready')", [randomUUID(), a.call]), rejected('ER_CONSTRAINT_FAILED'));
      await assert.rejects(db.query("INSERT INTO recording_assets (id,call_id,status,deleted_at,object_key) VALUES (?,?,'deleted',UTC_TIMESTAMP(3),'must-not-remain')", [randomUUID(), a.call]), rejected('ER_CONSTRAINT_FAILED'));
    });

    await t.test('raw seconds remain separate from review; duration/call-patient constraints reject invalid data', async () => {
      const a = await addCall(db);
      const observation = randomUUID();
      const sql = "INSERT INTO activity_observations (id,patient_id,staff_user_id,call_id,activity_type,source,source_event_key,started_at,ended_at,observed_seconds) VALUES (?,?,?,?,'app_call','synthetic',?,'2026-11-17 10:00:00','2026-11-17 10:01:00',?)";
      await db.query(sql, [observation, patientId('A'), providerId, a.call, observation, 60]);
      await db.query("INSERT INTO activity_reviews (id,observation_id,reviewer_user_id,decision,reviewed_seconds,reason) VALUES (?,?,?,'corrected',45,'Synthetic correction')", [randomUUID(), observation, providerId]);
      const [raw] = await db.query('SELECT observed_seconds FROM activity_observations WHERE id=?', [observation]);
      assert.equal(raw.observed_seconds, 60);
      await assert.rejects(db.query(sql, [randomUUID(), patientId('A'), providerId, a.call, randomUUID(), 61]), rejected('ER_CONSTRAINT_FAILED'));
      await assert.rejects(db.query(sql, [randomUUID(), patientId('B'), providerId, a.call, randomUUID(), 30]), rejected('ER_NO_REFERENCED_ROW_2'));
      await assert.rejects(db.query("UPDATE calls SET state='ended' WHERE id=?", [a.call]), rejected('ER_CONSTRAINT_FAILED'));
    });

    await t.test('migration lock prevents concurrent execution and drift/future history stop execution', async () => {
      const other = await connect('test', 'migration');
      try {
        await other.query("SELECT GET_LOCK('phoneapp:migrate:phoneapp_test',0)");
        await assert.rejects(migrate(db), /Another database migration/);
      } finally { await other.end(); }
      await db.beginTransaction();
      try {
        await db.query("UPDATE schema_migrations SET checksum=REPEAT('0',64) WHERE name='0001_identity_calls.sql'");
        await assert.rejects(status(db), /history differs/);
      } finally { await db.rollback(); }
      await db.beginTransaction();
      try {
        await db.query("INSERT INTO schema_migrations (name,checksum,state) VALUES ('9999_future.sql',REPEAT('0',64),'applied')");
        await assert.rejects(status(db), /history differs/);
      } finally { await db.rollback(); }
    });

    await t.test('partial DDL failure stays dirty; disposable reset/replay recovers a clean schema', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'phoneapp-migration-'));
      try {
        await cp(migrationDirectory, directory, { recursive: true });
        await writeFile(join(directory, '0008_failure.sql'), 'CREATE TABLE recovery_probe (id INT PRIMARY KEY);\n-- migrate:split\nTHIS IS INTENTIONALLY INVALID SQL;');
        await assert.rejects(migrate(db, { directory }), rejected('ER_PARSE_ERROR'));
        assert.equal((await history(db)).at(-1)?.state, 'failed');
        await assert.rejects(migrate(db, { directory }), /Unfinished migration/);
        const [probe] = await db.query("SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='recovery_probe'");
        assert.equal(Number(probe.n), 1, 'DDL was committed before failure');
        await resetDisposable(db);
        assert.equal((await migrate(db)).length, 7);
        await seed(db);
        const [counts] = await db.query('SELECT (SELECT COUNT(*) FROM calls) AS calls, (SELECT COUNT(*) FROM transcription_jobs) AS jobs, (SELECT COUNT(*) FROM recording_assets) AS assets');
        assert.deepEqual([counts.calls, counts.jobs, counts.assets].map(Number), [0, 0, 0]);
        assert.equal((await status(db)).pending.length, 0);
      } finally { await rm(directory, { recursive: true, force: true }); }
    });
  } finally {
    await db.end();
  }
});
